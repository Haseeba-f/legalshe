import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClaudeAPI } from '../../hooks/useClaudeAPI';
import { QUICK_CHECK_SYSTEM_PROMPT } from '../../utils/systemPrompts';
import { useSafeMode } from '../../context/SafeModeContext';

export const QuickChecker = () => {
  const { safeBlurClass } = useSafeMode();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);

  // Claude API hook — 300 token limit for quick answers
  const { callClaude, loading: isChecking, error } = useClaudeAPI();

  const parseQuickCheckResponse = (text) => {
    const verdictMatch = text.match(/Verdict:\s*(YES|NO|DEPENDS)/i);
    const reasonMatch = text.match(/Reason:\s*(.+?)(?=BNS Reference:|$)/is);
    const bnsMatch = text.match(/BNS Reference:\s*(.+)/i);

    return {
      verdict: verdictMatch ? verdictMatch[1].toUpperCase() : 'DEPENDS',
      reason: reasonMatch ? reasonMatch[1].trim() : text,
      bnsReference: bnsMatch ? bnsMatch[1].trim() : 'N/A',
    };
  };

  const handleCheck = async () => {
    if (!query.trim()) return;
    setResult(null);
    try {
      const response = await callClaude(
        [{ role: 'user', content: `Is this legal in India? ${query}` }],
        QUICK_CHECK_SYSTEM_PROMPT,
        300
      );
      setResult(parseQuickCheckResponse(response));
    } catch (err) {
      // error already set by useClaudeAPI hook
    }
  };

  const getVerdictStyle = (verdict) => {
    switch (verdict) {
      case 'YES':
        return { color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)', icon: 'check_circle', emoji: '✅' };
      case 'NO':
        return { color: '#EF4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)', icon: 'dangerous', emoji: '❌' };
      default:
        return { color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', icon: 'warning', emoji: '⚠️' };
    }
  };

  return (
    <section className="relative z-10 py-20 overflow-hidden">
      {/* Subtle divider glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-legal-purple/[0.03] blur-[130px]" />
      </div>

      <div className="relative max-w-[720px] mx-auto px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-btn mb-5"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(245,158,11,0.04))',
              border: '1px solid rgba(124,58,237,0.1)',
            }}
          >
            <span className="material-icons-round text-legal-purple text-sm">bolt</span>
            <span className="text-legal-purpleLight text-[0.65rem] font-bold tracking-[0.15em] uppercase">Instant Check</span>
          </motion.div>

          <h2 className="font-display font-extrabold text-[2.2rem] sm:text-[2.5rem] mb-2">
            <span className="text-white">"Is This </span>
            <span className="bg-gradient-to-r from-legal-purpleLight to-legal-gold bg-clip-text text-transparent">Legal?</span>
            <span className="text-white">"</span>
          </h2>
          <p className="text-legal-subtle/60 text-sm mb-8">Quick gut-check. Type a short scenario for an instant BNS 2023 classification.</p>
        </motion.div>

        {/* Search Card */}
        <motion.div
          className={`relative ${safeBlurClass}`}
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="relative rounded-[50px] p-[1px] group">
            <div
              className="absolute inset-0 rounded-[50px] opacity-20 group-focus-within:opacity-60 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(245,158,11,0.3))',
                backgroundSize: '300% 300%',
                animation: 'borderGlow 6s ease-in-out infinite',
              }}
            />
            <div className="relative rounded-[49px] bg-[#0e0e14]/90 backdrop-blur-[20px] flex items-center p-2 pl-6">
              <input
                type="text"
                className="flex-1 bg-transparent text-white outline-none placeholder-white/15 text-[0.92rem] py-2"
                placeholder="E.g., My boss is messaging me late at night..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                disabled={isChecking}
              />
              <motion.button
                onClick={handleCheck}
                disabled={isChecking || !query.trim()}
                className="relative px-7 py-2.5 rounded-[50px] font-display font-bold text-[0.82rem] disabled:opacity-40 cursor-pointer overflow-hidden"
                whileHover={!isChecking && query.trim() ? { scale: 1.04 } : {}}
                whileTap={!isChecking && query.trim() ? { scale: 0.96 } : {}}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-legal-purple to-[#5B21B6] rounded-[50px]" />
                <span className="relative z-10 text-white flex items-center gap-1.5">
                  {isChecking ? (
                    <>
                      <motion.div
                        className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      Checking
                    </>
                  ) : (
                    <>
                      <span className="material-icons-round text-[1rem]">search</span>
                      Check
                    </>
                  )}
                </span>
              </motion.button>
            </div>
          </div>

          {/* Error state */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="mt-4 flex items-center gap-3 px-5 py-3 rounded-[14px] text-left"
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

          {/* Structured Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                className="mt-6 rounded-[18px] p-5 text-left space-y-3"
                style={{
                  background: getVerdictStyle(result.verdict).bg,
                  border: `1px solid ${getVerdictStyle(result.verdict).border}`,
                }}
                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Verdict row */}
                <div className="flex items-center gap-3">
                  <motion.span
                    className="material-icons-round text-xl"
                    style={{ color: getVerdictStyle(result.verdict).color }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
                  >
                    {getVerdictStyle(result.verdict).icon}
                  </motion.span>
                  <span
                    className="font-display font-bold text-[1.1rem]"
                    style={{ color: getVerdictStyle(result.verdict).color }}
                  >
                    {getVerdictStyle(result.verdict).emoji} {result.verdict}
                  </span>
                </div>

                {/* Reason */}
                {result.reason && (
                  <p className="text-[0.9rem] text-[#CBD5E1] leading-relaxed pl-9">
                    {result.reason}
                  </p>
                )}

                {/* BNS Reference */}
                {result.bnsReference && result.bnsReference !== 'N/A' && (
                  <div className="pl-9">
                    <span
                      className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold px-3 py-1 rounded-btn"
                      style={{
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(124,58,237,0.05))',
                        border: '1px solid rgba(124,58,237,0.2)',
                        color: '#D2BBFF',
                      }}
                    >
                      <span className="material-icons-round text-[0.85rem]">policy</span>
                      {result.bnsReference}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <style>{`
        @keyframes borderGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  );
};
