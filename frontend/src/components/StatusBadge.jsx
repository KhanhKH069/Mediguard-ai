import React from 'react';

/**
 * StatusBadge: Hiển thị 3 trạng thái độc lập theo đúng quy chuẩn MediGuard AI
 * User Responded / Device Recorded / Caregiver Confirmed
 */
export default function StatusBadge({ type, active = false, label }) {
  const configs = {
    user_responded: {
      text: label || 'Bác Đã Phản Hồi',
      activeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 ring-1 ring-emerald-400/30',
      dotColor: 'bg-emerald-500 shadow-sm shadow-emerald-400',
      inactiveBg: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/60',
      inactiveDot: 'bg-slate-300 dark:bg-slate-600'
    },
    device_recorded: {
      text: label || 'Thiết Bị / Camera Ghi Nhận',
      activeBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/60 ring-1 ring-blue-400/30',
      dotColor: 'bg-blue-500 shadow-sm shadow-blue-400',
      inactiveBg: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/60',
      inactiveDot: 'bg-slate-300 dark:bg-slate-600'
    },
    caregiver_confirmed: {
      text: label || 'Người Nhà Đã Duyệt',
      activeBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700/60 ring-1 ring-purple-400/30',
      dotColor: 'bg-purple-500 shadow-sm shadow-purple-400',
      inactiveBg: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/60',
      inactiveDot: 'bg-slate-300 dark:bg-slate-600'
    },
    need_verify: {
      text: label || 'Chờ Xác Minh',
      activeBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/30',
      dotColor: 'bg-amber-500 shadow-sm shadow-amber-400',
      inactiveBg: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/60',
      inactiveDot: 'bg-slate-300 dark:bg-slate-600'
    }
  };

  const current = configs[type] || configs.user_responded;

  return (
    <span
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-semibold border transition-all ${
        active ? current.activeBg : current.inactiveBg
      }`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {active && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dotColor}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? current.dotColor : current.inactiveDot}`} />
      </span>
      <span>{current.text}</span>
    </span>
  );
}
