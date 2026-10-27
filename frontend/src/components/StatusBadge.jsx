import React from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';

/**
 * StatusBadge: Nhãn trạng thái kiểm chứng 3 lớp chuẩn Clinical Healthcare SaaS
 */
export default function StatusBadge({ type, active = false, label, variant = 'default' }) {
  const configs = {
    user_responded: {
      text: label || 'Bác đã phản hồi',
      activeBg:
        'bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] border-[#99F6E4] dark:border-[#0D9488]/40',
      iconColor: 'text-[#0D9488] dark:text-[#2DD4BF]',
      inactiveBg:
        'bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-slate-700/80'
    },
    device_recorded: {
      text: label || 'Camera đã ghi nhận',
      activeBg:
        'bg-[#F0F4F8] dark:bg-sky-950/40 text-[#0B1F3A] dark:text-sky-300 border-[#BCCCDC] dark:border-sky-800/60',
      iconColor: 'text-[#0B1F3A] dark:text-sky-400',
      inactiveBg:
        'bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-slate-700/80'
    },
    caregiver_confirmed: {
      text: label || 'Gia đình đã duyệt',
      activeBg:
        'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      inactiveBg:
        'bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-slate-700/80'
    },
    need_verify: {
      text: label || 'Chờ xác minh',
      activeBg:
        'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      iconColor: 'text-amber-600 dark:text-amber-400',
      inactiveBg:
        'bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-slate-700/80'
    },
    alert: {
      text: label || 'Cảnh báo',
      activeBg:
        'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60',
      iconColor: 'text-red-600 dark:text-red-400',
      inactiveBg:
        'bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-slate-700/80'
    }
  };

  const current = configs[type] || configs.user_responded;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-colors whitespace-nowrap ${
        active ? current.activeBg : current.inactiveBg
      } ${variant === 'compact' ? 'px-2 py-0.5 text-[11px]' : ''}`}
    >
      {type === 'alert' && active ? (
        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${current.iconColor}`} />
      ) : active ? (
        <Check className={`w-3.5 h-3.5 stroke-[2.5] shrink-0 ${current.iconColor}`} />
      ) : (
        <Clock className="w-3.5 h-3.5 opacity-60 shrink-0" />
      )}
      <span>{current.text}</span>
    </span>
  );
}
