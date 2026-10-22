import React from 'react';

/**
 * SeniorButton: Nút bấm thiết kế riêng cho người cao tuổi
 * - Chiều cao tối thiểu 64px (h-16 trở lên)
 * - Cỡ chữ to (text-xl đến text-2xl)
 * - Độ tương phản cao, bo góc lớn, hiệu ứng nhấn rõ ràng
 */
export default function SeniorButton({
  children,
  onClick,
  variant = 'primary', // 'primary' (xanh lá), 'warning' (vàng/cam), 'danger' (đỏ), 'blue'
  icon: Icon,
  disabled = false,
  className = ''
}) {
  const variantStyles = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-700/30',
    warning: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-amber-600/30',
    danger: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-700/30',
    blue: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-700/30',
    neutral: 'bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 shadow-slate-300'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[64px] px-6 py-4 rounded-2xl text-xl md:text-2xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant] || variantStyles.primary} ${className}`}
    >
      {Icon && <Icon className="w-8 h-8 flex-shrink-0" />}
      <span>{children}</span>
    </button>
  );
}
