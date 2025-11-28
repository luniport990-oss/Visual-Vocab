export interface QuizResult {
  imageUrl: string;
  originalSentence: string;
  blankedSentence: string;
  targetWord: string;
}

export interface DrawingData {
  word: string;
  imageData: string; // Base64
}

export interface SentenceData {
  word: string;
  sentence: string;
}
