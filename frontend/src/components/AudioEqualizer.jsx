import React from 'react';

/**
 * Thanh nhịp âm thanh y tế khi phát lời nhắc hoặc đối thoại giọng nói
 */
export default function AudioEqualizer({ isSpeaking = true, className = '' }) {
  if (!isSpeaking) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 h-6 px-3 py-1 bg-[#F0FDFA] dark:bg-[#0D9488]/20 rounded-full border border-[#99F6E4] dark:border-[#0D9488]/40 ${className}`}>
      <span className="w-1 bg-[#0D9488] dark:bg-[#2DD4BF] rounded-full animate-[equalize_0.6s_ease-in-out_infinite_alternate]" style={{ height: '70%' }} />
      <span className="w-1 bg-[#0B1F3A] dark:bg-sky-400 rounded-full animate-[equalize_0.8s_ease-in-out_infinite_alternate_0.2s]" style={{ height: '100%' }} />
      <span className="w-1 bg-[#0D9488] dark:bg-[#2DD4BF] rounded-full animate-[equalize_0.5s_ease-in-out_infinite_alternate_0.4s]" style={{ height: '55%' }} />
      <span className="w-1 bg-[#0D9488] dark:bg-[#2DD4BF] rounded-full animate-[equalize_0.7s_ease-in-out_infinite_alternate_0.1s]" style={{ height: '85%' }} />
      <span className="text-xs font-semibold text-[#0F766E] dark:text-[#5EEAD4] ml-1">Đang phát âm thanh</span>
    </div>
  );
}
