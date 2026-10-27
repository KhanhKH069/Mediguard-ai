import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * SeniorButton: Nút bấm công thái học cao cấp cho người cao tuổi (WCAG AAA)
 * Tối ưu cho giao diện Healthcare SaaS: rõ ràng, tin cậy, phản hồi xúc giác tinh tế
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
      'bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59] text-white border border-[#0F766E] shadow-saas-md',
    warning:
      'bg-amber-50 hover:bg-amber-100/80 active:bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 dark:border-amber-800/70 shadow-saas',
    danger:
      'bg-red-50 hover:bg-red-100/80 active:bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200 border border-red-200 dark:border-red-800/70 shadow-saas',
    blue:
      'bg-[#0B1F3A] hover:bg-[#16325B] active:bg-[#061326] text-white border border-[#061326] shadow-saas-md',
    neutral:
      'bg-white hover:bg-slate-50 active:bg-slate-100 text-[#0B1F3A] dark:bg-[#0E1E36] dark:text-white border border-slate-200 dark:border-slate-700 shadow-saas'
  };

  const iconBoxStyles = {
    primary: 'bg-white/15 text-white border-white/25',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
    danger: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
    blue: 'bg-white/15 text-white border-white/25',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-white border-slate-200 dark:border-slate-700'
  };

  const sublabelStyles = {
    primary: 'text-teal-50/90',
    warning: 'text-amber-800/85 dark:text-amber-200/80',
    danger: 'text-red-800/85 dark:text-red-200/80',
    blue: 'text-slate-200',
    neutral: 'text-slate-600 dark:text-slate-300'
  };

  const arrowStyles = {
    primary: 'bg-white/15 text-white',
    warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    danger: 'bg-red-500/15 text-red-800 dark:text-red-300',
    blue: 'bg-white/15 text-white',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-white'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[82px] sm:min-h-[90px] px-5 sm:px-6 py-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed select-none text-left cursor-pointer group ${
        variantStyles[variant] || variantStyles.primary
      } ${className}`}
    >
      <div className="flex items-center gap-4 sm:gap-5">
        {Icon && (
          <div
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 border ${
              iconBoxStyles[variant] || iconBoxStyles.primary
            }`}
          >
            <Icon className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
          </div>
        )}
        <div>
          <div className="text-lg sm:text-xl font-display font-bold tracking-tight leading-snug">
            {children}
          </div>
          {sublabel && (
            <div
              className={`text-xs sm:text-sm font-sans font-medium mt-0.5 leading-normal ${
                sublabelStyles[variant] || sublabelStyles.primary
              }`}
            >
              {sublabel}
            </div>
          )}
        </div>
      </div>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 hidden sm:flex transition-transform group-hover:translate-x-0.5 ${
          arrowStyles[variant] || arrowStyles.primary
        }`}
      >
        <ChevronRight className="w-5 h-5 stroke-[2.25]" />
      </div>
    </button>
  );
}
