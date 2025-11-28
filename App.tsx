import React, { useState } from 'react';
import { QuizResult } from './types';
import { generateQuiz } from './services/gemini';
import DrawingCanvas from './components/DrawingCanvas';
import { Sparkles, Loader2, CheckCircle2, XCircle, RefreshCcw, Download, HelpCircle, X, Send, BookOpen } from 'lucide-react';

const App: React.FC = () => {
  const [showManual, setShowManual] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const [word, setWord] = useState('');
  const [sentence, setSentence] = useState('');
  const [drawingData, setDrawingData] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [userGuess, setUserGuess] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exampleSentences = [
    "Her teacher encouraged her not to __________ the project.",
    "She started to __________ how to build a drone that uses solar energy.",
    "Alice’s smart idea began to __________ the world.",
    "She decided to __________ the oldest parts of the machine.",
    "Alice began to __________ that her drone had a problem.",
    "She worked hard to __________ the design of the small solar battery.",
    "Alice and her teacher were ready to ___________ the new, light drone."
  ];

  const handleQuizGeneration = async (mode: 'submit' | 'generate') => {
    setError(null);
    setResult(null);
    setUserGuess('');
    setFeedback(null);

    if (!word.trim()) {
      setError("Please enter a target word.");
      return;
    }

    if (mode === 'submit' && !drawingData) {
      setError("Please draw a picture to use 'Submit' mode.");
      return;
    }

    if (mode === 'generate' && !sentence.trim() && !drawingData) {
      setError("Please provide either an example sentence OR a drawing for generation.");
      return;
    }

    setIsLoading(true);

    try {
      const data = await generateQuiz(word, sentence, drawingData, mode);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while creating the quiz.");
    } finally {
      setIsLoading(false);
    }
  };

  const checkAnswer = () => {
    if (!result) return;
    if (userGuess.toLowerCase().trim() === result.targetWord.toLowerCase().trim()) {
      setFeedback('correct');
    } else {
      setFeedback('incorrect');
    }
  };

  const reset = () => {
    setResult(null);
    setWord('');
    setSentence('');
    setDrawingData(null);
    setUserGuess('');
    setFeedback(null);
    setError(null);
  };

  const downloadImage = async () => {
    if (!result) return;

    try {
      // 1. Create and Load Image
      const img = new Image();
      img.crossOrigin = "anonymous"; // Safe-guard for potential CORS issues

      const imageLoadPromise = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      // Set src AFTER attaching listeners to avoid race conditions
      img.src = result.imageUrl;
      await imageLoadPromise;

      // 2. Setup Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      // Use high resolution for better quality
      const cardWidth = 1200; 
      // Calculate height based on aspect ratio
      const aspectRatio = img.height > 0 ? img.height / img.width : 1;
      const imgHeight = cardWidth * aspectRatio;
      
      // Text layout configuration
      ctx.font = 'bold 48px serif'; 
      const padding = 60;
      const textMaxWidth = cardWidth - (padding * 2);
      const lineHeight = 70;
      
      // Wrap text logic
      const words = result.blankedSentence.split(' ');
      let line = '';
      const lines = [];
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > textMaxWidth && n > 0) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      // Calculate total height
      const textSectionHeight = (lines.length * lineHeight) + (padding * 2);
      const totalHeight = imgHeight + textSectionHeight;

      // Set canvas dimensions
      canvas.width = cardWidth;
      canvas.height = totalHeight;

      // 3. Draw Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 4. Draw Image
      ctx.drawImage(img, 0, 0, cardWidth, imgHeight);

      // 5. Draw Separator Line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, imgHeight);
      ctx.lineTo(cardWidth, imgHeight);
      ctx.stroke();

      // 6. Draw Text
      ctx.fillStyle = '#1e293b'; // Slate 800
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 48px serif'; // Re-set font just in case

      lines.forEach((l, i) => {
        // Calculate Y position for each line
        const yPos = imgHeight + padding + (i * lineHeight) + (lineHeight/2);
        ctx.fillText(l.trim(), cardWidth / 2, yPos);
      });

      // 7. Add Watermark
      ctx.fillStyle = '#94a3b8'; // Slate 400
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Visual Vocab', cardWidth - 30, totalHeight - 20);

      // 8. Trigger Download
      const link = document.createElement('a');
      link.download = `visual-vocab-${result.targetWord.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (e) {
      console.error("Error generating download image:", e);
      // Fallback: Download just the image if canvas generation fails
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = `visual-vocab-${result.targetWord}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const selectExample = (ex: string) => {
    setSentence(ex);
    setShowExamples(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4 font-sans relative">
      
      {/* Manual Modal */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowManual(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <HelpCircle className="text-indigo-600" /> How to use
            </h3>
            <ol className="space-y-3 text-slate-600 text-sm leading-relaxed list-decimal list-inside marker:text-indigo-600 marker:font-bold">
              <li><span className="font-medium text-slate-800">퀴즈로 내고 싶은 어휘를 고른다</span> <br/><span className="text-xs text-slate-500 ml-4 block mt-1">(research, realize, eliminate, abandon, improve, launch, influence 등)</span></li>
              <li><span className="font-medium text-slate-800">예문을 작성한다.</span></li>
              <li><span className="font-medium text-slate-800">어휘와 예문에 해당하는 그림을 그린다.</span></li>
              <li><span className="font-medium text-slate-800">제출하기 또는 생성하기 버튼을 클릭한다.</span></li>
              <li><span className="font-medium text-slate-800">짝과 서로의 퀴즈를 푼다.</span></li>
            </ol>
            <div className="mt-6 text-center">
              <button 
                onClick={() => setShowManual(false)}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors w-full"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Example Sentences Modal */}
      {showExamples && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
            <button 
              onClick={() => setShowExamples(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen className="text-indigo-600" /> Example Sentences
            </h3>
            <div className="overflow-y-auto pr-2 space-y-2">
               {exampleSentences.map((ex, index) => (
                 <button
                   key={index}
                   onClick={() => selectExample(ex)}
                   className="w-full text-left p-3 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors text-slate-700 text-sm leading-relaxed group"
                 >
                   <span className="font-bold text-indigo-400 mr-2 group-hover:text-indigo-600">{index + 1}.</span>
                   {ex}
                 </button>
               ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
               <p className="text-xs text-slate-400">Click a sentence to use it.</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-8 text-center w-full max-w-lg flex flex-col items-center relative">
        {/* Left Button: Examples */}
        <button
          onClick={() => setShowExamples(true)}
          className="absolute left-0 top-1 text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 group"
          title="View Examples"
        >
          <BookOpen size={24} />
          <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 hidden sm:inline">Examples</span>
        </button>

        <div className="flex items-center justify-center gap-3 mb-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <Sparkles size={24} />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Visual Vocab</h1>
        </div>
        <p className="text-slate-500 text-sm">Create AI vocabulary quizzes instantly.</p>
        
        {/* Right Button: Manual */}
        <button 
          onClick={() => setShowManual(true)}
          className="absolute right-0 top-1 text-slate-400 hover:text-indigo-600 transition-colors"
          title="How to use"
        >
          <HelpCircle size={24} />
        </button>
      </header>

      <main className="w-full max-w-lg">
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-300">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-lg font-medium text-slate-700">Processing your quiz...</p>
            <p className="text-sm text-slate-400">Please wait a moment</p>
          </div>
        )}

        {/* Input Form */}
        {!result && !isLoading && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 space-y-6">
              
              {/* 1. Target Word */}
              <div>
                <label htmlFor="word" className="block text-sm font-bold text-slate-700 mb-2">
                  1. Target Word <span className="text-red-500">*</span> <span className="font-normal text-slate-500 text-xs">(research, realize, eliminate, abandon, improve, launch, influence)</span>
                </label>
                <input
                  id="word"
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder=""
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              {/* 2. Example Sentence */}
              <div>
                <div className="flex items-center justify-between mb-2">
                    <label htmlFor="sentence" className="block text-sm font-bold text-slate-700">
                    2. Example Sentence <span className="font-normal text-slate-400 ml-1">(Optional if drawing provided)</span>
                    </label>
                    <button 
                        onClick={() => setShowExamples(true)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                    >
                        <BookOpen size={14} /> View Examples
                    </button>
                </div>
                <textarea
                  id="sentence"
                  rows={3}
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  placeholder=""
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* 3. Draw Picture */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  3. Draw Picture <span className="font-normal text-slate-400">(Required for Submit, Optional for Generate)</span>
                </label>
                <DrawingCanvas onImageReady={setDrawingData} />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                  <XCircle size={16} /> {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleQuizGeneration('submit')}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Send size={18} /> Submit
                </button>
                
                <button
                  type="button"
                  onClick={() => handleQuizGeneration('generate')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} /> Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result Card */}
        {result && (
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-500">
            {/* Image Area */}
            <div className="relative aspect-square w-full bg-slate-100 group">
              <img 
                src={result.imageUrl} 
                alt="Generated Quiz" 
                className="w-full h-full object-contain bg-white"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-t-2xl pointer-events-none" />
              
              {/* Download Button Overlay */}
              <button 
                onClick={downloadImage}
                className="absolute top-4 right-4 bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 p-2 rounded-full shadow-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Download Image"
              >
                <Download size={20} />
              </button>
            </div>

            {/* Quiz Content */}
            <div className="p-8">
              <div className="mb-8 text-center">
                 <p className="text-xl md:text-2xl text-slate-700 font-serif leading-relaxed">
                    {result.blankedSentence}
                 </p>
              </div>

              {/* Interaction Area */}
              <div className="space-y-4">
                 {feedback !== 'correct' ? (
                   <div className="flex gap-2">
                     <input
                        type="text"
                        value={userGuess}
                        onChange={(e) => setUserGuess(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                        placeholder="Type the missing word..."
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                        disabled={feedback === 'correct'}
                     />
                     <button
                        onClick={checkAnswer}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition-all"
                     >
                        Check
                     </button>
                   </div>
                 ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center animate-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-center gap-2 text-green-700 font-bold text-lg mb-1">
                            <CheckCircle2 size={24} /> Correct!
                        </div>
                        <p className="text-green-800">The word is <span className="font-bold underline">{result.targetWord}</span>.</p>
                    </div>
                 )}

                 {feedback === 'incorrect' && (
                    <p className="text-red-500 text-center font-medium animate-in shake">
                        Not quite! Try again.
                    </p>
                 )}
              </div>
            </div>

            {/* Footer / Reset */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center px-8">
                <button 
                    onClick={downloadImage}
                    className="text-slate-500 hover:text-indigo-600 font-medium text-sm flex items-center gap-2 transition-colors"
                >
                    <Download size={16} /> Download
                </button>

                <button 
                    onClick={reset}
                    className="text-slate-500 hover:text-indigo-600 font-medium text-sm flex items-center gap-2 transition-colors"
                >
                    <RefreshCcw size={16} /> Create New
                </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;