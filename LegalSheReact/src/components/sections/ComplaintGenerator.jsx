import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClaudeAPI } from '../../hooks/useClaudeAPI';
import { COMPLAINT_SYSTEM_PROMPT } from '../../utils/systemPrompts';
import { useSafeMode } from '../../context/SafeModeContext';
import jsPDF from 'jspdf';

const HARASSMENT_TYPES = [
  { value: '', label: 'Select type of incident...', icon: '' },
  { value: 'cyberbullying', label: 'Cyberbullying / Online Abuse', icon: 'language' },
  { value: 'stalking', label: 'Cyberstalking', icon: 'person_search' },
  { value: 'morphed_images', label: 'Morphed / Non-Consensual Images', icon: 'broken_image' },
  { value: 'sextortion', label: 'Sextortion / Blackmail', icon: 'report' },
  { value: 'workplace', label: 'Workplace Harassment (POSH)', icon: 'business' },
  { value: 'threats', label: 'Threats / Intimidation', icon: 'warning' },
  { value: 'domestic', label: 'Domestic Violence', icon: 'home' },
  { value: 'dowry', label: 'Dowry Harassment', icon: 'money_off' },
  { value: 'eve_teasing', label: 'Eve Teasing / Street Harassment', icon: 'directions_walk' },
  { value: 'other', label: 'Other', icon: 'more_horiz' },
];

const LOADING_PHRASES = [
  'Understanding your situation...',
  'Identifying applicable BNS 2023 sections...',
  'Mapping incident to legal framework...',
  'Drafting formal complaint language...',
  'Structuring the FIR template...',
  'Finalizing your draft...',
];

// Floating particle component
const FloatingParticle = ({ delay, duration, x, y, size }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      left: x,
      top: y,
      background: `radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)`,
    }}
    animate={{
      y: [0, -30, 0],
      opacity: [0, 0.6, 0],
      scale: [0.8, 1.2, 0.8],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

export const ComplaintGenerator = () => {
  const { safeBlurClass } = useSafeMode();
  const [formData, setFormData] = useState({
    harassmentType: '',
    incidentDate: '',
    incidentLocation: '',
    description: '',
  });
  const [draftComplaint, setDraftComplaint] = useState(null);
  const [detectedLaw, setDetectedLaw] = useState('');
  const [step, setStep] = useState(1);
  const [loadingPhrase, setLoadingPhrase] = useState(0);
  const [copied, setCopied] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const textareaRef = useRef(null);
  const charCount = formData.description.length;

  // Claude API hook
  const { callClaude, loading: isGenerating, error } = useClaudeAPI();

  useEffect(() => {
    const handleClear = () => {
      setFormData({ harassmentType: '', incidentDate: '', incidentLocation: '', description: '' });
      setDraftComplaint(null);
      setDetectedLaw('');
      setStep(1);
      setDisclaimerAccepted(false);
    };
    window.addEventListener('clear-legal-forms', handleClear);
    return () => window.removeEventListener('clear-legal-forms', handleClear);
  }, []);

  // Rotate loading phrases
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setLoadingPhrase(prev => (prev + 1) % LOADING_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGenerate = async () => {
    if (!formData.description.trim()) return;
    setLoadingPhrase(0);

    const typeLabel = HARASSMENT_TYPES.find(t => t.value === formData.harassmentType)?.label || 'Unspecified';
    const userPrompt = `Generate complaint letter for:
Name: [YOUR NAME]
Date: ${formData.incidentDate || 'Not specified'}
Type of Harassment: ${typeLabel}
Location: ${formData.incidentLocation || 'Not specified'}
Organization/Person Involved: [To be filled]
Description: ${formData.description}
Witnesses: None`;

    try {
      const response = await callClaude(
        [{ role: 'user', content: userPrompt }],
        COMPLAINT_SYSTEM_PROMPT,
        1024
      );

      // Extract any detected law sections from response
      const lawMatch = response.match(/APPLICABLE LEGAL PROVISIONS.*?\n([\s\S]+?)(?=\n\nWITNESSES|\n\nPRAYER)/i);
      const lawSection = lawMatch ? lawMatch[1].trim() : 'BNS 2023';
      setDetectedLaw(lawSection);
      setDraftComplaint(response);
      setStep(2);
    } catch (err) {
      // error already set by hook
    }
  };

  // jsPDF-based download
  const handleDownloadPDF = () => {
    if (!draftComplaint) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 7;
    let yPosition = margin;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMAL COMPLAINT LETTER', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight * 2;

    // Body text — auto-wrap and paginate
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const lines = doc.splitTextToSize(draftComplaint, contentWidth);

    lines.forEach((line) => {
      if (yPosition > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    });

    // Footer with disclaimer
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Generated by LegalShe. Verify with a qualified lawyer before filing. False complaints are an offence under BNS Section 182.',
      pageWidth / 2,
      footerY,
      { align: 'center', maxWidth: contentWidth }
    );

    // Filename: complaint_<date>.pdf
    const safeDate = (formData.incidentDate || new Date().toLocaleDateString()).replace(/\//g, '-');
    doc.save(`complaint_${safeDate}.pdf`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draftComplaint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setFormData({ harassmentType: '', incidentDate: '', incidentLocation: '', description: '' });
    setDraftComplaint(null);
    setDetectedLaw('');
    setStep(1);
    setCopied(false);
    setDisclaimerAccepted(false);
  };

  const isFormReady = formData.description.trim() && disclaimerAccepted;

  return (
    <section id="complaint" className="relative z-10 py-28 overflow-hidden">
      {/* Section-local ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-legal-purple/[0.04] blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-legal-gold/[0.03] blur-[120px]" />
      </div>

      {/* Floating particles */}
      <FloatingParticle delay={0} duration={6} x="10%" y="20%" size="8px" />
      <FloatingParticle delay={1.5} duration={5} x="85%" y="15%" size="6px" />
      <FloatingParticle delay={3} duration={7} x="70%" y="70%" size="10px" />
      <FloatingParticle delay={2} duration={4.5} x="20%" y="80%" size="5px" />
      <FloatingParticle delay={4} duration={6.5} x="50%" y="10%" size="7px" />

      <div className="relative max-w-[860px] mx-auto px-8">

        {/* ── Header ── */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Pill badge */}
          <motion.div
            className="inline-flex items-center gap-2.5 px-5 py-2 rounded-btn mb-7"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(124,58,237,0.08) 100%)',
              border: '1px solid rgba(245,158,11,0.15)',
            }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(245,158,11,0.15)' }}
          >
            <span className="material-icons-round text-legal-gold text-[1rem]">auto_awesome</span>
            <span className="text-legal-gold text-[0.7rem] font-bold tracking-[0.2em] uppercase">AI-Powered Auto-Draft</span>
          </motion.div>

          <h2 className="font-display text-[3rem] sm:text-[3.5rem] font-extrabold leading-[1.1] mb-5">
            <span className="text-white">Complaint </span>
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-legal-purpleLight via-legal-gold to-legal-purpleLight bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
                Generator
              </span>
              {/* underline accent */}
              <span className="absolute -bottom-2 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-legal-gold/60 to-transparent rounded-full" />
            </span>
          </h2>
          <p className="text-legal-subtle text-[1.1rem] leading-[1.7] max-w-[560px] mx-auto">
            Describe your incident in <span className="text-legal-purpleLight font-medium">any language</span>. Our AI maps it to exact <span className="text-legal-gold font-medium">BNS 2023</span> laws and generates a ready-to-file draft.
          </p>
        </motion.div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center justify-center gap-3 sm:gap-5 mb-12">
          {[
            { num: 1, label: 'Describe', icon: 'edit_note' },
            { num: 2, label: 'Review & Download', icon: 'task' },
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              {i > 0 && (
                <div className="relative w-16 sm:w-24 h-[2px]">
                  <div className="absolute inset-0 bg-white/[0.06] rounded-full" />
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-legal-purple to-legal-gold"
                    initial={{ width: '0%' }}
                    animate={{ width: step >= 2 ? '100%' : '0%' }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              )}
              <motion.div
                className="flex items-center gap-2"
                animate={{ opacity: step >= s.num ? 1 : 0.35 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold relative ${
                    step >= s.num ? 'text-white' : 'text-legal-subtle'
                  }`}
                  animate={{
                    background: step >= s.num
                      ? s.num === 1 ? 'linear-gradient(135deg, #7C3AED, #5B21B6)' : 'linear-gradient(135deg, #F59E0B, #D97706)'
                      : 'rgba(255,255,255,0.06)',
                    boxShadow: step >= s.num
                      ? s.num === 1 ? '0 0 24px rgba(124,58,237,0.4)' : '0 0 24px rgba(245,158,11,0.4)'
                      : '0 0 0 transparent',
                  }}
                  transition={{ duration: 0.5 }}
                >
                  {step > s.num ? (
                    <span className="material-icons-round text-[1.1rem]">check</span>
                  ) : (
                    <span className="material-icons-round text-[1.1rem]">{s.icon}</span>
                  )}
                </motion.div>
                <span className={`text-[0.8rem] font-semibold hidden sm:block ${step >= s.num ? 'text-white' : 'text-legal-subtle'}`}>
                  {s.label}
                </span>
              </motion.div>
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Form ── */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Animated gradient border card */}
              <div className="relative rounded-[24px] p-[1px] group">
                {/* Animated border */}
                <div
                  className="absolute inset-0 rounded-[24px] opacity-40 group-hover:opacity-70 transition-opacity duration-700"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(245,158,11,0.3), rgba(124,58,237,0.2), rgba(245,158,11,0.5))',
                    backgroundSize: '300% 300%',
                    animation: 'borderGlow 6s ease-in-out infinite',
                  }}
                />
                {/* Inner card */}
                <div className={`relative rounded-[23px] bg-[#0e0e14]/90 backdrop-blur-[20px] p-8 sm:p-10 space-y-7 ${safeBlurClass}`}>

                  {/* Harassment Type */}
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 text-sm font-semibold text-legal-subtle">
                      <span className="material-icons-round text-legal-purple text-[1rem]">category</span>
                      Type of Incident
                    </label>
                    <div className="relative">
                      <select
                        name="harassmentType"
                        value={formData.harassmentType}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('type')}
                        onBlur={() => setFocusedField(null)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-[14px] px-5 py-3.5 text-white text-[0.95rem] focus:outline-none focus:border-legal-purple/40 focus:bg-white/[0.06] focus:shadow-[0_0_30px_rgba(124,58,237,0.08)] transition-all duration-300 appearance-none cursor-pointer hover:border-white/20"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
                      >
                        {HARASSMENT_TYPES.map(type => (
                          <option key={type.value} value={type.value} className="bg-[#131318] text-white">
                            {type.label}
                          </option>
                        ))}
                      </select>
                      {focusedField === 'type' && (
                        <motion.div
                          className="absolute inset-0 rounded-[14px] pointer-events-none"
                          style={{ boxShadow: '0 0 0 1px rgba(124,58,237,0.3), 0 0 30px rgba(124,58,237,0.06)' }}
                          layoutId="fieldFocus"
                        />
                      )}
                    </div>
                  </div>

                  {/* Date and Location Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2 text-sm font-semibold text-legal-subtle">
                        <span className="material-icons-round text-legal-gold text-[1rem]">calendar_today</span>
                        Date of Incident
                      </label>
                      <input
                        type="date"
                        name="incidentDate"
                        value={formData.incidentDate}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('date')}
                        onBlur={() => setFocusedField(null)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-[14px] px-5 py-3.5 text-white text-[0.95rem] focus:outline-none focus:border-legal-purple/40 focus:bg-white/[0.06] focus:shadow-[0_0_30px_rgba(124,58,237,0.08)] transition-all duration-300 [color-scheme:dark] hover:border-white/20"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2 text-sm font-semibold text-legal-subtle">
                        <span className="material-icons-round text-legal-green text-[1rem]">location_on</span>
                        Location
                      </label>
                      <input
                        type="text"
                        name="incidentLocation"
                        value={formData.incidentLocation}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('location')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="e.g. Hyderabad, Telangana"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-[14px] px-5 py-3.5 text-white text-[0.95rem] placeholder:text-white/15 focus:outline-none focus:border-legal-purple/40 focus:bg-white/[0.06] focus:shadow-[0_0_30px_rgba(124,58,237,0.08)] transition-all duration-300 hover:border-white/20"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-semibold text-legal-subtle">
                        <span className="material-icons-round text-legal-red text-[1rem]">description</span>
                        Describe what happened <span className="text-legal-red">*</span>
                      </label>
                      <span className={`text-[0.7rem] font-mono tabular-nums ${charCount > 0 ? 'text-legal-subtle' : 'text-transparent'}`}>
                        {charCount} chars
                      </span>
                    </div>
                    <p className="text-[0.75rem] text-legal-subtle/50 leading-relaxed -mt-1">
                      Write in Hindi, Telugu, English, or any language. Be as detailed as possible.
                    </p>
                    <div className="relative group/textarea">
                      <textarea
                        ref={textareaRef}
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('desc')}
                        onBlur={() => setFocusedField(null)}
                        rows={6}
                        placeholder="Describe the incident in your own words — what happened, when, who was involved, and any evidence you have..."
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-[18px] px-6 py-5 text-white text-[0.95rem] placeholder:text-white/12 focus:outline-none focus:border-legal-purple/40 focus:bg-white/[0.06] focus:shadow-[0_0_40px_rgba(124,58,237,0.06)] transition-all duration-300 resize-none leading-[1.7] hover:border-white/20"
                      />
                      {/* Textarea glow on focus */}
                      {focusedField === 'desc' && (
                        <motion.div
                          className="absolute -inset-[1px] rounded-[18px] pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          style={{
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(245,158,11,0.1))',
                            filter: 'blur(20px)',
                            zIndex: -1,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Privacy Shield */}
                  <motion.div
                    className="flex items-center gap-3 rounded-[14px] px-5 py-3.5"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(16,185,129,0.02) 100%)',
                      border: '1px solid rgba(16,185,129,0.1)',
                    }}
                    whileHover={{ borderColor: 'rgba(16,185,129,0.25)' }}
                  >
                    <div className="relative">
                      <span className="material-icons-round text-legal-green text-lg">shield</span>
                      <motion.div
                        className="absolute -inset-1 rounded-full bg-legal-green/20 blur-sm"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                    <p className="text-[0.75rem] text-legal-green/70 leading-relaxed">
                      <span className="font-bold text-legal-green/90">Zero Data Storage</span> — Processed entirely in-memory. Nothing is ever saved.
                    </p>
                  </motion.div>

                  {/* Legal Disclaimer Checkbox */}
                  <label
                    className="flex items-start gap-3.5 cursor-pointer group/check select-none"
                    htmlFor="legal-disclaimer"
                  >
                    <div className="relative mt-0.5 flex-shrink-0">
                      <input
                        type="checkbox"
                        id="legal-disclaimer"
                        checked={disclaimerAccepted}
                        onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                        className="peer sr-only"
                      />
                      {/* Custom checkbox */}
                      <div className={`w-5 h-5 rounded-[6px] border-2 transition-all duration-300 flex items-center justify-center ${
                        disclaimerAccepted
                          ? 'bg-legal-purple border-legal-purple shadow-[0_0_16px_rgba(124,58,237,0.3)]'
                          : 'border-white/20 bg-white/[0.03] group-hover/check:border-legal-purple/50'
                      }`}>
                        <motion.span
                          className="material-icons-round text-white text-[14px]"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: disclaimerAccepted ? 1 : 0,
                            opacity: disclaimerAccepted ? 1 : 0,
                          }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        >
                          check
                        </motion.span>
                      </div>
                    </div>
                    <span className={`text-[0.8rem] leading-relaxed transition-colors duration-300 ${
                      disclaimerAccepted ? 'text-white/80' : 'text-legal-subtle/70 group-hover/check:text-legal-subtle'
                    }`}>
                      I understand this is an <span className="font-semibold text-legal-gold/80">AI-generated draft</span> and will verify with a legal professional before use.
                    </span>
                  </label>

                  {/* Error state */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        className="flex items-center gap-3 rounded-[14px] px-5 py-3"
                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <span className="material-icons-round text-red-400 text-sm">error_outline</span>
                        <p className="text-red-400 text-sm">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Generate Button */}
                  <motion.button
                    onClick={handleGenerate}
                    disabled={!isFormReady || isGenerating}
                    className="relative w-full overflow-hidden rounded-[50px] cursor-pointer disabled:cursor-not-allowed"
                    whileHover={isFormReady && !isGenerating ? { scale: 1.015, y: -1 } : {}}
                    whileTap={isFormReady && !isGenerating ? { scale: 0.985 } : {}}
                  >
                    {/* Button gradient bg */}
                    <div className={`absolute inset-0 transition-all duration-500 ${
                      !isFormReady || isGenerating
                        ? 'bg-white/5'
                        : 'bg-gradient-to-r from-legal-purple via-[#9333EA] to-legal-gold'
                    }`} />

                    {/* Shine sweep animation */}
                    {isFormReady && !isGenerating && (
                      <div
                        className="absolute inset-0 opacity-30"
                        style={{
                          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
                          backgroundSize: '200% 100%',
                          animation: 'shine 3s ease-in-out infinite',
                        }}
                      />
                    )}

                    {/* Button content */}
                    <div className={`relative flex items-center justify-center gap-3 py-4.5 font-display font-bold text-[1rem] tracking-wide ${
                      !isFormReady || isGenerating ? 'text-legal-subtle' : 'text-white'
                    }`}>
                      {isGenerating ? (
                        <>
                          {/* Pulsing orb */}
                          <motion.div
                            className="w-5 h-5 rounded-full border-2 border-legal-purple/50 border-t-legal-purple"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={loadingPhrase}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ duration: 0.3 }}
                              className="text-legal-purpleLight"
                            >
                              {LOADING_PHRASES[loadingPhrase]}
                            </motion.span>
                          </AnimatePresence>
                        </>
                      ) : (
                        <>
                          <span className="material-icons-round text-xl">gavel</span>
                          Generate Draft Complaint
                        </>
                      )}
                    </div>
                  </motion.button>

                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Preview & Download ── */}
          {step === 2 && draftComplaint && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className={`space-y-7 ${safeBlurClass}`}
            >
              {/* Success flash */}
              <motion.div
                className="flex items-center justify-center gap-3 py-3"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <motion.div
                  className="w-10 h-10 rounded-full bg-legal-green/15 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <span className="material-icons-round text-legal-green text-xl">check_circle</span>
                </motion.div>
                <span className="text-sm font-semibold text-legal-green">Draft generated successfully</span>
              </motion.div>

              {/* Detected Laws Badges */}
              {detectedLaw && (
                <motion.div
                  className="flex flex-wrap items-center gap-2 justify-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <span className="material-icons-round text-legal-gold text-lg">policy</span>
                  <span className="text-[0.8rem] font-semibold text-legal-gold">Applicable Laws:</span>
                  <motion.span
                    className="text-[0.8rem] text-legal-purpleLight px-4 py-1.5 rounded-btn border font-medium"
                    style={{
                      background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(124,58,237,0.05))',
                      borderColor: 'rgba(124,58,237,0.2)',
                    }}
                    whileHover={{ scale: 1.03, borderColor: 'rgba(124,58,237,0.4)' }}
                  >
                    BNS 2023
                  </motion.span>
                </motion.div>
              )}

              {/* Complaint Preview Card */}
              <motion.div
                className="relative rounded-[24px] p-[1px]"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div
                  className="absolute inset-0 rounded-[24px] opacity-30"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(245,158,11,0.2), rgba(16,185,129,0.2))',
                  }}
                />
                <div className="relative rounded-[23px] bg-[#0e0e14]/95 backdrop-blur-[20px] overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
                    <h3 className="font-display font-bold text-lg text-white flex items-center gap-2.5">
                      <span className="material-icons-round text-legal-gold">description</span>
                      Draft Complaint Preview
                    </h3>
                    <span
                      className="text-[0.65rem] font-bold tracking-[0.15em] uppercase px-3 py-1 rounded-btn"
                      style={{
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05))',
                        border: '1px solid rgba(245,158,11,0.15)',
                        color: '#F59E0B',
                      }}
                    >
                      Draft
                    </span>
                  </div>
                  {/* Letter content */}
                  <div className="px-8 py-6 max-h-[450px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(124,58,237,0.3) transparent' }}>
                    <pre
                      className="text-[0.9rem] text-[#CBD5E1] leading-[1.85] whitespace-pre-wrap font-body"
                      style={{ fontFamily: 'inherit', fontVariantLigatures: 'common-ligatures' }}
                    >
                      {draftComplaint}
                    </pre>
                  </div>
                  {/* Card footer meta */}
                  <div className="flex items-center gap-4 px-8 py-3 border-t border-white/[0.04] bg-white/[0.015]">
                    <span className="text-[0.7rem] text-legal-subtle/50 font-mono">
                      {draftComplaint.split(' ').length} words
                    </span>
                    <span className="text-white/10">·</span>
                    <span className="text-[0.7rem] text-legal-subtle/50 font-mono">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {/* Download PDF */}
                <motion.button
                  onClick={handleDownloadPDF}
                  disabled={!draftComplaint}
                  className="relative flex-1 overflow-hidden rounded-[50px] cursor-pointer disabled:opacity-40"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-legal-purple via-[#9333EA] to-legal-gold" />
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
                      backgroundSize: '200% 100%',
                      animation: 'shine 3s ease-in-out infinite',
                    }}
                  />
                  <div className="relative flex items-center justify-center gap-2.5 py-4 text-white font-display font-bold text-[0.95rem] tracking-wide">
                    <span className="material-icons-round">picture_as_pdf</span>
                    Download as PDF
                  </div>
                </motion.button>

                {/* Copy to clipboard */}
                <motion.button
                  onClick={handleCopy}
                  disabled={!draftComplaint}
                  className="relative flex-1 overflow-hidden rounded-[50px] cursor-pointer group disabled:opacity-40"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="relative flex items-center justify-center gap-2.5 py-4 font-display font-bold text-[0.95rem] tracking-wide transition-colors duration-300">
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.div
                          key="copied"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-2 text-legal-green"
                        >
                          <span className="material-icons-round">check</span>
                          Copied!
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-2 text-white group-hover:text-legal-purpleLight transition-colors"
                        >
                          <span className="material-icons-round">content_copy</span>
                          Copy to Clipboard
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
              </motion.div>

              {/* Start Over */}
              <motion.button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-btn text-legal-subtle/60 hover:text-legal-red text-sm font-semibold transition-all cursor-pointer group"
                whileHover={{ scale: 1.01 }}
              >
                <span className="material-icons-round text-base group-hover:rotate-[-360deg] transition-transform duration-700">restart_alt</span>
                Start Over
              </motion.button>

              {/* Disclaimer */}
              <motion.div
                className="rounded-[14px] px-5 py-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.03) 0%, rgba(245,158,11,0.01) 100%)',
                  border: '1px solid rgba(245,158,11,0.1)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-start gap-3">
                  <span className="material-icons-round text-legal-gold/70 text-lg mt-0.5">info</span>
                  <p className="text-[0.75rem] text-legal-gold/50 leading-relaxed">
                    <strong className="text-legal-gold/70">Important:</strong> This is an AI-generated draft for reference only. Have it reviewed by a legal professional before filing. Filing false complaints is illegal (BNS 2023 Section 182). LegalShe does not provide official legal counsel.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes borderGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          0%, 100% { background-position: 200% center; }
          50% { background-position: 0% center; }
        }
        @keyframes shine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </section>
  );
};
