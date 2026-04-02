import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tesseract from 'tesseract.js';
import { callAI } from '../../utils/ai';
import { useSafeMode } from '../../context/SafeModeContext';
import { generateComplaintPDF } from '../../utils/pdf';

export const Shield = () => {
  const { isSafeMode, safeBlurClass } = useSafeMode();
  const [imagePreview, setImagePreview] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleClear = () => {
      setImagePreview(null);
      setBase64Image(null);
      setReport(null);
    };
    window.addEventListener('clear-legal-forms', handleClear);
    return () => window.removeEventListener('clear-legal-forms', handleClear);
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    setIsProcessing(true);
    setReport(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      processImageForOCR(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const processImageForOCR = (dataUrl) => {
    const img = new window.Image();
    img.onload = async () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const contrast = avg > 128 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = contrast;
      }
      ctx.putImageData(imageData, 0, 0);
      try {
        const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
        analyzeWithClaude(text, dataUrl);
      } catch (err) {
        alert("OCR Failed: " + err.message);
        setIsProcessing(false);
      }
    };
    img.src = dataUrl;
  };

  const analyzeWithClaude = async (extractedText, rawBase64) => {
    try {
      const prompt = `I am submitting a screenshot of online harassment. 
      Extracted Text from OCR: "${extractedText}". 
      Analyze this text/image. Identify strict BNS 2023 law sections violated. Format as LegalShe STRICT RULES. DO NOT output the abusive text.`;
      const aiResponse = await callAI(prompt, rawBase64);
      setReport(aiResponse);
      setBase64Image(rawBase64);
    } catch (err) {
      alert("AI Analysis Failed: " + err.message);
    }
    setIsProcessing(false);
  };

  const formatShieldResponse = (text) => {
    if (!text) return null;
    return (
      <motion.div
        className={`mt-10 space-y-5 ${safeBlurClass}`}
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Alert header */}
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-full bg-legal-red/15 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <span className="material-icons-round text-legal-red text-xl">gpp_bad</span>
          </motion.div>
          <h3 className="font-display font-bold text-2xl text-legal-red">Violation Detected</h3>
        </div>

        {/* Report card */}
        <div className="relative rounded-[20px] p-[1px]">
          <div className="absolute inset-0 rounded-[20px] opacity-30" style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(239,68,68,0.1))'
          }} />
          <div className="relative rounded-[19px] bg-[#0e0e14]/90 backdrop-blur-[16px] p-6 text-left whitespace-pre-wrap leading-[1.8] text-[0.92rem] text-[#CBD5E1]">
            {text}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-4 mt-6">
          <motion.button
            onClick={() => generateComplaintPDF({ incidentDescription: text, lawSection: "BNS 2023 / IT Act" })}
            className="relative overflow-hidden px-7 py-3 rounded-[50px] font-display font-bold text-[0.88rem] cursor-pointer"
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '50px',
            }} />
            <span className="relative z-10 text-legal-red flex items-center gap-2">
              <span className="material-icons-round text-base">picture_as_pdf</span>
              Download Draft FIR (PDF)
            </span>
          </motion.button>
          <motion.button
            onClick={() => { setImagePreview(null); setReport(null); setBase64Image(null); }}
            className="px-7 py-3 rounded-[50px] font-display font-bold text-[0.88rem] text-white cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="flex items-center gap-2">
              <span className="material-icons-round text-base">delete_forever</span>
              Destroy Evidence Securely
            </span>
          </motion.button>
        </div>
      </motion.div>
    );
  };

  return (
    <section id="shield" className="relative z-10 py-28 overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)' }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-legal-red/[0.03] blur-[150px]" />
        <div className="absolute bottom-0 left-[20%] w-[350px] h-[350px] rounded-full bg-legal-purple/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-[800px] mx-auto px-8 text-center">
        {/* Header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="inline-flex items-center gap-2.5 px-5 py-2 rounded-btn mb-7"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(124,58,237,0.06))',
              border: '1px solid rgba(239,68,68,0.15)',
            }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(239,68,68,0.1)' }}
          >
            <span className="material-icons-round text-legal-red text-[1rem]">shield</span>
            <span className="text-legal-red text-[0.7rem] font-bold tracking-[0.2em] uppercase">AI Evidence Analyzer</span>
          </motion.div>

          <h2 className="font-display text-[2.8rem] sm:text-[3.2rem] font-extrabold leading-[1.1] mb-5">
            <span className="text-white">Online Harassment </span>
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-legal-red via-legal-gold to-legal-red bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
                Shield
              </span>
              <span className="absolute -bottom-2 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-legal-red/50 to-transparent rounded-full" />
            </span>
          </h2>
          <p className="text-legal-subtle text-[1.05rem] leading-[1.7] max-w-[600px] mx-auto">
            Upload a screenshot of the abuse. Our AI extracts the text, identifies the <span className="text-legal-red font-medium">exact legal violation</span> under BNS 2023, and generates a draft police complaint.
          </p>
        </motion.div>

        {/* Upload zone */}
        <motion.div
          className={`relative mb-10 ${safeBlurClass}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="relative rounded-[24px] p-[1px] group">
            <div
              className={`absolute inset-0 rounded-[24px] transition-opacity duration-500 ${isDragOver || isProcessing ? 'opacity-70' : 'opacity-25 group-hover:opacity-50'}`}
              style={{
                background: isProcessing
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(245,158,11,0.3))'
                  : isDragOver
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.6), rgba(16,185,129,0.4))'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(124,58,237,0.15))',
                backgroundSize: '300% 300%',
                animation: 'borderGlow 6s ease-in-out infinite',
              }}
            />
            <div
              className={`relative rounded-[23px] bg-[#0e0e14]/90 backdrop-blur-[20px] p-12 transition-all duration-300 cursor-pointer ${isDragOver ? 'scale-[1.01]' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => { if (!isProcessing) fileInputRef.current.click(); }}
            >
              <AnimatePresence mode="wait">
                {!imagePreview ? (
                  <motion.div
                    key="upload"
                    className="flex flex-col items-center pointer-events-none"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <motion.div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <span className="material-icons-round text-3xl text-legal-subtle">upload_file</span>
                    </motion.div>
                    <p className="text-white font-semibold mb-2 text-[1rem]">Drag and drop a screenshot here</p>
                    <p className="text-legal-subtle/50 text-sm mb-6">JPEG, PNG, or WebP</p>
                    <motion.button
                      className="px-7 py-2.5 rounded-[50px] font-semibold text-sm pointer-events-auto cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Browse Files
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="preview"
                    className="flex flex-col items-center"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <img src={imagePreview} alt="Evidence" className="max-w-full h-[200px] object-contain rounded-lg blur-md mb-4 opacity-70" />
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-icons-round text-legal-green text-sm">verified_user</span>
                      <p className="text-legal-green font-semibold text-sm">Image secured & blurred for your protection.</p>
                    </div>
                    {isProcessing && (
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="w-4 h-4 rounded-full border-2 border-legal-gold/40 border-t-legal-gold"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        <p className="text-legal-gold text-sm font-bold animate-pulse">Extracting Evidence & Analyzing Laws...</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              <input
                type="file" ref={fileInputRef} className="hidden" accept="image/*"
                onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
              />
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </motion.div>

        {report && formatShieldResponse(report)}
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 200% center; }
          50% { background-position: 0% center; }
        }
        @keyframes borderGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  );
};
