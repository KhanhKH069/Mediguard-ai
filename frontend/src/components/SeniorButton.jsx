import React from 'react';

/**
 * SeniorButton: Nút bấm thiết kế chuẩn Y tế Công thái học cho người cao tuổi (WCAG AAA)
 * - Nút 3D tactile siêu to (chiều cao tối thiểu 72px)
 * - Font Outfit đậm, độ tương phản sắc nét
 * - Hiệu ứng nhấn chân thực như nút vật lý, tạo cảm giác an tâm khi chạm
 */
export default function SeniorButton({
  children,
  onClick,
  variant = 'primary', // 'primary' | 'warning' | 'danger' | 'blue' | 'neutral'
  icon: Icon,
  disabled = false,
  className = '',
  sublabel = ''
}) {
  const variantStyles = {
    primary:
      'bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 text-white border-b-4 border-emerald-800 shadow-glow-emerald',
    warning:
      'bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 active:to-amber-700 text-white border-b-4 border-amber-800 shadow-glow-amber',
    danger:
      'bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:from-rose-700 active:to-rose-800 text-white border-b-4 border-rose-900 shadow-glow-rose',
    blue:
      'bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:from-blue-700 active:to-blue-800 text-white border-b-4 border-blue-900 shadow-glow-blue',
    neutral:
      'bg-gradient-to-b from-slate-100 to-slate-200 hover:from-slate-50 hover:to-slate-100 active:from-slate-200 active:to-slate-300 text-slate-800 border-b-4 border-slate-400 shadow-sm'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[76px] px-6 py-4 rounded-3xl font-display font-extrabold flex items-center justify-between gap-4 transition-all duration-150 transform active:translate-y-1 active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none select-none text-left ${
        variantStyles[variant] || variantStyles.primary
      } ${className}`}
    >
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm shadow-inner">
            <Icon className="w-8 h-8 text-white stroke-[2.5]" />
          </div>
        )}
        <div>
          <div className="text-xl md:text-2xl tracking-tight leading-tight">{children}</div>
          {sublabel && (
            <div className="text-xs md:text-sm font-sans font-medium text-white/90 mt-0.5">
              {sublabel}
            </div>
          )}
        </div>
      </div>
      <div className="text-white/60 font-mono text-sm hidden sm:block">➔</div>
    </button>
  );
}
