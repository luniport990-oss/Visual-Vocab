import { GoogleGenAI, Type } from "@google/genai";
import { QuizResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to strip the header from base64 string if present
const cleanBase64 = (data: string) => {
  return data.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
};

/**
 * Unified generation function.
 * @param word The target word
 * @param sentence The example sentence (optional)
 * @param drawingBase64 The base64 string of the user's drawing (optional)
 * @param mode 'submit' (use user drawing) or 'generate' (use AI to create image)
 */
export const generateQuiz = async (
  word: string, 
  sentence: string, 
  drawingBase64: string | null,
  mode: 'submit' | 'generate'
): Promise<QuizResult> => {
  
  // --- 1. Prepare Image Generation/Handling ---
  let imagePromise;
  
  if (mode === 'submit') {
    // Mode: Submit (Use original drawing)
    if (!drawingBase64) {
      throw new Error("You must draw a picture to use 'Submit' mode.");
    }
    // We resolve immediately with the original data. 
    // We mark it to identify it didn't come from Gemini.
    imagePromise = Promise.resolve({ isOriginal: true, data: drawingBase64 });

  } else {
    // Mode: Generate (AI Image)
    if (drawingBase64) {
      // Scenario: Drawing provided -> Sketch-to-Image
      const contextClause = sentence ? ` and the context of the sentence: "${sentence}"` : "";
      const imagePrompt = `Turn this rough sketch into a high-quality, colorful, realistic illustration that clearly represents the concept of '${word}'${contextClause}. Do not include any text inside the generated image.`;
  
      imagePromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: cleanBase64(drawingBase64)
              }
            },
            { text: imagePrompt }
          ]
        }
      });
    } else if (sentence.trim()) {
      // Scenario: No drawing, but sentence provided -> Text-to-Image
      imagePromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `Create a high-quality, semi-realistic illustration for the following sentence: "${sentence}". Focus visually on the concept of: ${word}. No text in image.` }
          ]
        }
      });
    } else {
      throw new Error("Please provide either a drawing or a sentence to generate an image.");
    }
  }

  // --- 2. Prepare Text Generation Request ---
  // We use AI for text processing in BOTH modes to ensure the blanking logic handles 
  // morphology (e.g., run/running) correctly and validates the sentence.
  let textPromise;
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      originalSentence: { type: Type.STRING },
      blankedSentence: { type: Type.STRING },
    },
    required: ["originalSentence", "blankedSentence"]
  };

  if (sentence.trim()) {
    // Scenario: Sentence provided -> Just blank it out
    textPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `I have a sentence: "${sentence}". 
      I have a target word: "${word}".
      Return a JSON object with the "originalSentence" (as provided) and a "blankedSentence" where the target word (and any morphological variations of it) is replaced with "______".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });
  } else {
    // Scenario: No sentence -> Generate one
    textPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a clear, educational English example sentence using the word "${word}". 
      Then, create a version of that sentence where the word "${word}" (and its variations like plurals/conjugations) is replaced by "______".
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });
  }

  // --- 3. Execute Parallel Requests ---
  const [imageResponse, textResponse] = await Promise.all([imagePromise, textPromise]);

  // Extract Image
  let finalImageUrl = "";
  
  if ('isOriginal' in imageResponse) {
      // It was the submitted drawing
      finalImageUrl = imageResponse.data;
  } else {
      // It was an AI generation response
      if (imageResponse.candidates && imageResponse.candidates[0].content.parts) {
        for (const part of imageResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            finalImageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }
  }

  if (!finalImageUrl) {
    throw new Error("Failed to generate or process image.");
  }

  // Extract Text
  const jsonText = textResponse.text || "{}";
  const textData = JSON.parse(jsonText);

  return {
    imageUrl: finalImageUrl,
    originalSentence: textData.originalSentence,
    blankedSentence: textData.blankedSentence,
    targetWord: word
  };
};