// ==============================================================================
// MEDIGUARD CARE - RECOVERY TIMELINE COMPONENT (LAYER 4)
// Longitudinal clinical recovery trajectory (Day 1 -> Day 3 -> Day 7)
// Enables physician to assess wound evolution in 10 seconds
// ==============================================================================

import React from 'react';
import { Calendar, Activity, CheckCircle2, AlertTriangle, Flame } from 'lucide-react';

export interface TimelineDataPoint {
  day: string;             // D+1, D+3, D+7
  date: string;
  pain_vas: number;        // 0-10
  temperature: number;     // Celsius
  wound_condition: string; // Khô, Rỉ dịch, Mủ, Đỏ nhẹ
  triage_level: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  verbatim: string;
}

interface RecoveryTimelineProps {
  patientName: string;
  procedureName: string;
  timeline: TimelineDataPoint[];
}

export const RecoveryTimeline: React.FC<RecoveryTimelineProps> = ({
  patientName,
  procedureName,
  timeline
}) => {
  return (
    <div className="w-full bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Dòng Thời Gian Phục Hồi Lâm Sàng: {patientName}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Phẫu thuật: {procedureName} • Lộ trình theo dõi: Ngày 1 → Ngày 3 → Ngày 7
          </p>
        </div>
        <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
          Chuẩn HL7 FHIR Observation
        </span>
      </div>

      {/* Visual Pain & Temperature Chart Track */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl">
        {/* Pain VAS Score Bars */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase">Diễn biến Điểm Đau (VAS 0 - 10)</span>
          <div className="flex items-end gap-6 h-36 pt-4 border-b border-slate-200">
            {timeline.map((item, idx) => {
              const heightPct = Math.min(100, (item.pain_vas / 10) * 100);
              const barColor = item.pain_vas >= 7 ? 'bg-red-500' : item.pain_vas >= 4 ? 'bg-orange-500' : 'bg-emerald-500';
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="w-full flex justify-center">
                    <span className="text-xs font-bold text-slate-800">{item.pain_vas}/10</span>
                  </div>
                  <div className="w-8 bg-slate-200 rounded-t h-28 flex items-end">
                    <div className={`w-full rounded-t transition-all duration-500 ${barColor}`} style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{item.day}</span>
                  <span className="text-[10px] text-slate-400">{item.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Temperature Bars */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase">Thân nhiệt (°C)</span>
          <div className="flex items-end gap-6 h-36 pt-4 border-b border-slate-200">
            {timeline.map((item, idx) => {
              const temp = item.temperature || 36.5;
              const heightPct = Math.max(15, Math.min(100, ((temp - 36.0) / 3.0) * 100));
              const barColor = temp >= 38.5 ? 'bg-red-500' : temp >= 37.5 ? 'bg-orange-500' : 'bg-emerald-500';
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="w-full flex justify-center">
                    <span className="text-xs font-bold text-slate-800">{item.temperature}°C</span>
                  </div>
                  <div className="w-8 bg-slate-200 rounded-t h-28 flex items-end">
                    <div className={`w-full rounded-t transition-all duration-500 ${barColor}`} style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{item.day}</span>
                  <span className="text-[10px] text-slate-400">{item.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step-by-Step Chronological Cards */}
      <div className="flex flex-col gap-4">
        {timeline.map((item, idx) => (
          <div key={idx} className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col items-center">
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                  item.triage_level === 'RED'
                    ? 'bg-red-600'
                    : item.triage_level === 'ORANGE'
                    ? 'bg-orange-500'
                    : item.triage_level === 'YELLOW'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
              >
                {item.day}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">Cuộc gọi {item.day}</span>
                  <span className="text-xs text-slate-400 font-medium">({item.date})</span>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    item.triage_level === 'RED'
                      ? 'bg-red-100 text-red-700'
                      : item.triage_level === 'ORANGE'
                      ? 'bg-orange-100 text-orange-700'
                      : item.triage_level === 'YELLOW'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {item.triage_level}
                </span>
              </div>

              <p className="text-xs italic text-slate-700 bg-slate-50 p-2.5 rounded-lg border-l-2 border-blue-500">
                "{item.verbatim}"
              </p>

              <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
                <span><strong>Đau:</strong> VAS {item.pain_vas}/10</span>
                <span><strong>Thân nhiệt:</strong> {item.temperature}°C</span>
                <span><strong>Vết mổ:</strong> {item.wound_condition}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


export default RecoveryTimeline;
