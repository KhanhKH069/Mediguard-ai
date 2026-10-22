import React from 'react';

/**
 * Hiệu ứng thanh sóng âm thanh chuyển động sống động (Neon Equalizer) khi AI Assistant đang nói
 */
export default function AudioEqualizer({ isSpeaking = true, className = '' }) {
  if (!isSpeaking) return null;

  return (
    <div className={`flex items-center gap-1.5 h-6 px-3 py-1 bg-blue-500/10 dark:bg-cyan-500/15 rounded-full border border-blue-400/30 dark:border-cyan-400/40 shadow-sm ${className}`}>
      <span className="w-1.5 bg-blue-600 dark:bg-cyan-400 rounded-full animate-[equalize_0.6s_ease-in-out_infinite_alternate]" style={{ height: '70%' }} />
      <span className="w-1.5 bg-indigo-600 dark:bg-emerald-400 rounded-full animate-[equalize_0.8s_ease-in-out_infinite_alternate_0.2s]" style={{ height: '100%' }} />
      <span className="w-1.5 bg-sky-500 dark:bg-cyan-300 rounded-full animate-[equalize_0.5s_ease-in-out_infinite_alternate_0.4s]" style={{ height: '50%' }} />
      <span className="w-1.5 bg-blue-500 dark:bg-teal-400 rounded-full animate-[equalize_0.7s_ease-in-out_infinite_alternate_0.1s]" style={{ height: '85%' }} />
      <span className="w-1.5 bg-indigo-500 dark:bg-cyan-400 rounded-full animate-[equalize_0.6s_ease-in-out_infinite_alternate_0.3s]" style={{ height: '60%' }} />
      <span className="text-xs font-bold text-blue-700 dark:text-cyan-300 ml-1 font-mono tracking-tight">AI Đang Nói</span>
    </div>
  );
}
