import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClaudeAPI } from '../../hooks/useClaudeAPI';
import { ANALYZER_SYSTEM_PROMPT } from '../../utils/systemPrompts';
import { useSafeMode } from '../../context/SafeModeContext';

const LANGUAGES = [
  { id: 'te-IN', label: 'TELUGU', name: 'తెలుగు', color: 'legal-gold' },
  { id: 'hi-IN', label: 'HINDI', name: 'हिन्दी', color: 'legal-red' },
  { id: 'en-IN', label: 'ENGLISH', name: 'English', color: 'legal-purple' },
];

export const Analyzer = () => {
  const { isSafeMode, safeBlurClass } = useSafeMode();
  const [activeLang, setActiveLang] = useState('en-IN');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [recognition, setRecognition] = useState(null);
  const [parsedResult, setParsedResult] = useState(null);

  // Claude API hook
  const { callClaude, loading: isAnalyzing, error } = useClaudeAPI();

  useEffect(() => {
    const handleClear = () => {
      setTranscript('');
      setAiResponse(null);
      setParsedResult(null);
    };
    window.addEventListener('clear-legal-forms', handleClear);

    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let finalTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          finalTranscript += e.results[i][0].transcript;
        }
        setTranscript(finalTranscript);
      };
      rec.onend = () => setIsRecording(false);
      rec.onerror = (event) => {
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          alert('Microphone permission denied. Please enable it in your browser settings.');
        } else {
          alert(`Voice input error: ${event.error}`);
        }
      };
      setRecognition(rec);
    }
    return () => window.removeEventListener('clear-legal-forms', handleClear);
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (!isRecording) {
      recognition.lang = activeLang;
      recognition.start();
      setIsRecording(true);
    } else {
      recognition.stop();
      setIsRecording(false);
    }
  };

  // Parse Claude's structured text response into an object
  const parseAnalyzerResponse = (text) => {
    const severityMatch = text.match(/Severity:\s*(\d+)\/10/i);
    const confidenceMatch = text.match(/Confidence:\s*(\d+)%/i);
    const categoryMatch = text.match(/Category:\s*(.+)/i);
    const bnsMatch = text.match(/BNS Sections?:\s*(.+)/i);

    return {
      raw: text,
      severity: severityMatch ? parseInt(severityMatch[1]) : null,
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : null,
      category: categoryMatch ? categoryMatch[1].trim() : null,
      bnsSections: bnsMatch ? bnsMatch[1].trim() : null,
    };
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    setAiResponse(null);
    setParsedResult(null);
    try {
      const response = await callClaude(
        [{ role: 'user', content: `Analyze this harassment scenario: ${transcript}` }],
        ANALYZER_SYSTEM_PROMPT,
        1024
      );
      setAiResponse(response);
      setParsedResult(parseAnalyzerResponse(response));
    } catch (err) {
      // error state is already set by useClaudeAPI
    }
  };

  const formatResponse = (text) => {
    if (!text) return null;
    return (
      <motion.div
        className={`mt-8 space-y-5 ${safeBlurClass}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <motion.div
            className="w-8 h-8 rounded-full bg-legal-gold/15 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <span className="material-icons-round text-legal-gold text-lg">check_circle</span>
          </motion.div>
          <h3 className="font-display font-bold text-xl text-legal-gold">Analysis Complete</h3>
        </div>

        {/* Parsed metrics row */}
        {parsedResult && (parsedResult.severity || parsedResult.confidence || parsedResult.category) && (
          <div className="flex flex-wrap gap-3 mb-4">
            {parsedResult.category && (
              <span className="text-[0.78rem] font-semibold px-4 py-1.5 rounded-btn" style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(124,58,237,0.05))',
                border: '1px solid rgba(124,58,237,0.2)',
                color: '#D2BBFF',
              }}>
                {parsedResult.category}
              </span>
            )}
            {parsedResult.severity && (
              <span className="text-[0.78rem] font-semibold px-4 py-1.5 rounded-btn" style={{
                background: `linear-gradient(135deg, rgba(${parsedResult.severity > 6 ? '239,68,68' : '245,158,11'},0.1), rgba(${parsedResult.severity > 6 ? '239,68,68' : '245,158,11'},0.05))`,
                border: `1px solid rgba(${parsedResult.severity > 6 ? '239,68,68' : '245,158,11'},0.2)`,
                color: parsedResult.severity > 6 ? '#EF4444' : '#F59E0B',
              }}>
                Severity: {parsedResult.severity}/10
              </span>
            )}
            {parsedResult.confidence && (
              <span className="text-[0.78rem] font-semibold px-4 py-1.5 rounded-btn" style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
                border: '1px solid rgba(16,185,129,0.2)',
                color: '#10B981',
              }}>
                Confidence: {parsedResult.confidence}%
              </span>
            )}
          </div>
        )}

        {/* Severity progress bar */}
        {parsedResult && parsedResult.severity && (
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: parsedResult.severity > 6
                  ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                  : 'linear-gradient(90deg, #10B981, #F59E0B)',
              }}
              initial={{ width: '0%' }}
              animate={{ width: `${parsedResult.severity * 10}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        )}

        <div className="relative rounded-[20px] p-[1px]">
          <div className="absolute inset-0 rounded-[20px] opacity-25" style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(124,58,237,0.2))'
          }} />
          <div className="relative rounded-[19px] bg-[#0e0e14]/90 backdrop-blur-[16px] p-6 text-left whitespace-pre-wrap leading-[1.8] text-[0.92rem] text-[#CBD5E1]">
            {text}
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <motion.button
            onClick={() => { setTranscript(''); setAiResponse(null); setParsedResult(null); }}
            className="px-6 py-2.5 rounded-btn text-white text-sm font-semibold transition-all cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="flex items-center gap-2">
              <span className="material-icons-round text-base">delete_sweep</span>
              Clear & Secure
            </span>
          </motion.button>
          <motion.a
            href="#shield"
            className="px-6 py-2.5 rounded-btn text-sm font-semibold transition-all cursor-pointer flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(124,58,237,0.06))',
              border: '1px solid rgba(124,58,237,0.2)',
              color: '#D2BBFF'
            }}
            whileHover={{ scale: 1.03, borderColor: 'rgba(124,58,237,0.4)' }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="material-icons-round text-base">photo_camera</span>
            Report Harassment (OCR)
          </motion.a>
        </div>
      </motion.div>
    );
  };

  return (
    <section id="analyzer" className="relative z-10 py-28 overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-[20%] w-[500px] h-[500px] rounded-full bg-legal-purple/[0.04] blur-[140px]" />
        <div className="absolute bottom-0 left-[10%] w-[400px] h-[400px] rounded-full bg-legal-gold/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-[1100px] mx-auto px-8">
        {/* Header */}
        <motion.div
          className="flex justify-between items-start mb-10 flex-wrap gap-4"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-left">
            <h2 className="font-display text-[2.8rem] sm:text-[3.2rem] font-extrabold leading-[1.1] mb-3">
              <span className="text-white">Tell Us </span>
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-legal-purpleLight via-legal-gold to-legal-purpleLight bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
                  What Happened
                </span>
              </span>
            </h2>
            <p className="text-legal-subtle text-[1.05rem]">In your words. In your language.</p>
          </div>
          <motion.span
            className="text-[0.7rem] font-bold tracking-[0.15em] uppercase px-4 py-2 rounded-btn whitespace-nowrap flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
              border: '1px solid rgba(16,185,129,0.15)',
              color: '#10B981',
            }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(16,185,129,0.1)' }}
          >
            <div className="relative">
              <span className="material-icons-round text-sm">lock</span>
              <motion.div
                className="absolute -inset-1 rounded-full bg-legal-green/30 blur-sm"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            IN-MEMORY ONLY
          </motion.span>
        </motion.div>

        {/* Language Switcher */}
        <motion.div
          className="flex justify-start gap-3 mb-10"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {LANGUAGES.map(lang => (
            <motion.button
              key={lang.id}
              onClick={() => setActiveLang(lang.id)}
              className={`relative px-6 py-3 rounded-[16px] text-[0.78rem] font-bold tracking-wide transition-all flex flex-col items-center gap-1 cursor-pointer overflow-hidden ${
                activeLang === lang.id
                  ? 'text-white border-transparent'
                  : 'text-legal-subtle border-white/[0.06] hover:border-white/15'
              }`}
              style={{
                border: activeLang === lang.id ? 'none' : '1px solid',
                borderColor: activeLang === lang.id ? 'transparent' : 'rgba(255,255,255,0.06)',
              }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              {activeLang === lang.id && (
                <motion.div
                  className="absolute inset-0"
                  layoutId="langActive"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">{lang.label}</span>
              <span className={`relative z-10 text-[0.6rem] font-normal ${activeLang === lang.id ? 'text-white/70' : 'text-legal-subtle/40'}`}>
                {lang.name}
              </span>
            </motion.button>
          ))}
        </motion.div>

        {/* Textarea Card */}
        <motion.div
          className={`relative mb-10 ${safeBlurClass}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {/* Animated gradient border */}
          <div className="relative rounded-[24px] p-[1px] group">
            <div
              className="absolute inset-0 rounded-[24px] opacity-30 group-focus-within:opacity-70 transition-opacity duration-700"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(245,158,11,0.3), rgba(124,58,237,0.2))',
                backgroundSize: '300% 300%',
                animation: 'borderGlow 6s ease-in-out infinite',
              }}
            />
            <div className="relative rounded-[23px] bg-[#0e0e14]/90 backdrop-blur-[20px] overflow-hidden">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full p-7 pr-44 bg-transparent text-white text-[1.05rem] leading-[1.65] outline-none min-h-[200px] resize-none placeholder:text-white/12"
                placeholder="E.g., Someone is threatening me online and morphed my photos..."
                disabled={isAnalyzing}
              />

              {/* Action bar */}
              <div className="absolute right-4 bottom-4 flex gap-3">
                <motion.button
                  onClick={toggleRecording}
                  disabled={isAnalyzing}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isRecording
                      ? 'bg-legal-red text-white shadow-[0_0_24px_rgba(239,68,68,0.5)]'
                      : 'bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.08]'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={isRecording ? { scale: [1, 1.08, 1] } : {}}
                  transition={isRecording ? { duration: 0.8, repeat: Infinity } : {}}
                >
                  <span className="material-icons-round">{isRecording ? 'stop' : 'mic'}</span>
                </motion.button>

                <motion.button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !transcript.trim()}
                  className="relative inline-flex items-center gap-2 px-7 py-3 rounded-[50px] font-bold text-[0.88rem] disabled:opacity-40 cursor-pointer overflow-hidden"
                  whileHover={!isAnalyzing && transcript.trim() ? { scale: 1.04, y: -1 } : {}}
                  whileTap={!isAnalyzing && transcript.trim() ? { scale: 0.96 } : {}}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-legal-gold to-legal-goldDark" />
                  <div
                    className="absolute inset-0 opacity-25"
                    style={{
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
                      backgroundSize: '200% 100%',
                      animation: 'shine 3s ease-in-out infinite',
                    }}
                  />
                  <span className="relative z-10 text-black font-display flex items-center gap-2">
                    {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                    <span className="material-icons-round text-[1.1rem]">auto_awesome</span>
                  </span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="flex items-center gap-3 mb-6 px-5 py-3 rounded-[14px]"
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <span className="material-icons-round text-red-400">error_outline</span>
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <motion.div
                className="w-5 h-5 rounded-full border-2 border-legal-gold/40 border-t-legal-gold"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-legal-gold text-sm font-bold tracking-widest uppercase animate-pulse">
                Legal AI Processing (BNS 2023)
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Response */}
        {aiResponse && formatResponse(aiResponse)}
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 200% center; }
          50% { background-position: 0% center; }
        }
        @keyframes shine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes borderGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  );
};
