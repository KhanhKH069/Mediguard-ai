import React from 'react';

/**
 * StatusBadge: Hiển thị 3 trạng thái độc lập theo đúng quy chuẩn MediGuard AI
 */
export default function StatusBadge({ type, active = false, label }) {
  const configs = {
    user_responded: {
      text: label || 'Đã phản hồi',
      activeBg: 'bg-blue-100 text-blue-800 border-blue-300',
      inactiveBg: 'bg-slate-100 text-slate-400 border-slate-200'
    },
    device_recorded: {
      text: label || 'Đã ghi nhận thao tác',
      activeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      inactiveBg: 'bg-slate-100 text-slate-400 border-slate-200'
    },
    caregiver_confirmed: {
      text: label || 'Người nhà đã xác nhận',
      activeBg: 'bg-purple-100 text-purple-800 border-purple-300',
      inactiveBg: 'bg-slate-100 text-slate-400 border-slate-200'
    },
    need_verify: {
      text: label || 'Cần xác minh',
      activeBg: 'bg-amber-100 text-amber-800 border-amber-300',
      inactiveBg: 'bg-slate-100 text-slate-400 border-slate-200'
    }
  };

  const current = configs[type] || configs.user_responded;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs md:text-sm font-semibold border ${
        active ? current.activeBg : current.inactiveBg
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-current' : 'bg-slate-300'}`} />
      {current.text}
    </span>
  );
}
