'use client';

import React, { useState } from 'react';
import { TriageBoard, TriageTicketItem } from '../components/TriageBoard';
import { RecoveryTimeline, TimelineDataPoint } from '../components/RecoveryTimeline';
import { TranscriptVerifier, TranscriptTurn } from '../components/TranscriptVerifier';
import { ActionResolutionModal } from '../components/ActionResolutionModal';
import { Stethoscope, Activity, Radio, ShieldCheck, PhoneCall, LayoutDashboard, UserCheck, Sliders, BarChart3 } from 'lucide-react';

const INITIAL_MOCK_TICKETS: TriageTicketItem[] = [
  {
    ticket_id: "TCK-2026-0042",
    patient_id: "PT-2026-0422",
    patient_name: "Vũ Đình Khang",
    patient_phone: "0983 892 114",
    procedure: "Nong và đặt Stent động mạch vành LAD",
    discharge_day: "D+1",
    priority_level: "RED",
    status: "OPEN",
    triggered_rules: [
      "RED_FLAG: Đau thắt ngực cấp tính > 10 phút lan vai sau đặt Stent",
      "RED_FLAG: Khó thở đột ngột kèm vã mồ hôi lạnh"
    ],
    clinical_summary: "BÁO ĐỘNG ĐỎ: Đau tức ngực tái phát sau can thiệp Stent > 10m kèm khó thở và vã mồ hôi. Nguy cơ tắc Stent cấp tính. Kích hoạt Code Red ngay lập tức!",
    evidence_quotes: [
      "Tôi thấy tức nghẹn ngực trái lan ra vai khoảng 20 phút nay rồi, thở hơi dốc và thấy vã mồ hôi hột ở trán..."
    ],
    sla_remaining_minutes: 8,
    assigned_to: "ĐD. Đặng Thanh Tâm"
  },
  {
    ticket_id: "TCK-2026-0041",
    patient_id: "PT-2026-0891",
    patient_name: "Nguyễn Văn Tuấn",
    patient_phone: "0912 345 678",
    procedure: "Phẫu thuật Cắt túi mật nội soi",
    discharge_day: "D+3",
    priority_level: "ORANGE",
    status: "IN_PROGRESS",
    triggered_rules: [
      "ORANGE_FLAG: Đau vết mổ tăng dần từ ngày thứ 3 (VAS 4 -> 6)",
      "ORANGE_FLAG: Xuất hiện sốt nhẹ 37.8°C"
    ],
    clinical_summary: "Cảnh báo mức Cam: Triệu chứng đau tăng so với D+1 kèm sốt nhẹ 37.8°C mới xuất hiện. Cần điều dưỡng gọi lại đánh giá nhiễm trùng vết mổ trong 4 giờ.",
    evidence_quotes: [
      "Từ sáng đến giờ vết mổ hạ sườn phải hơi đau nhói hơn hôm qua cô ạ, người thấy mệt và hơi âm ấm đầu đo được khoảng 37.8 độ."
    ],
    sla_remaining_minutes: 145,
    assigned_to: "ĐD. CKI Nguyễn Thu Hằng"
  },
  {
    ticket_id: "TCK-2026-0040",
    patient_id: "PT-2026-1104",
    patient_name: "Trần Thị Thu Hương",
    patient_phone: "0904 556 778",
    procedure: "Mổ lấy thai đường ngang đoạn dưới",
    discharge_day: "D+5",
    priority_level: "YELLOW",
    status: "OPEN",
    triggered_rules: [
      "YELLOW_FLAG: Chưa rõ chỉ số thân nhiệt khi có dấu hiệu cương tức tuyến vú"
    ],
    clinical_summary: "Mức Vàng: Cần gọi lại kiểm tra nhiệt độ để loại trừ sốt do tắc tia sữa.",
    evidence_quotes: [
      "Bên ngực phải thấy căng tức cứng ngắc, hôm qua có thấy người hơi ấm sốt mà chưa kịp cặp lại nhiệt độ..."
    ],
    sla_remaining_minutes: 380,
    assigned_to: "ĐD. Lê Kiều Trang"
  },
  {
    ticket_id: "TCK-2026-0039",
    patient_id: "PT-2026-0315",
    patient_name: "Phạm Văn Đức",
    patient_phone: "0936 221 990",
    procedure: "Phẫu thuật Thay khớp gối toàn phần TKA",
    discharge_day: "D+7",
    priority_level: "GREEN",
    status: "RESOLVED",
    triggered_rules: [
      "GREEN_FLAG: Điểm đau giảm VAS 2/10, vận động tốt, không sốt"
    ],
    clinical_summary: "Mức Xanh: Hồi phục đúng tiến độ, vết mổ khô, đã tự chống gậy đi bộ 15 phút.",
    evidence_quotes: [
      "Gối bớt sưng nhiều rồi bác sĩ ạ, hôm nay tôi đã tự chống gậy đi quanh phòng được 15 phút..."
    ],
    sla_remaining_minutes: 720,
    assigned_to: "ĐD. Phạm Văn Quyền"
  }
];

const MOCK_TIMELINE: TimelineDataPoint[] = [
  {
    day: "D+1",
    date: "2026-10-21",
    pain_vas: 4,
    temperature: 36.8,
    wound_condition: "Khô ráo, băng sạch",
    triage_level: "GREEN",
    verbatim: "Vết mổ hơi nhức một chút khi ho, tôi đã đi lại nhẹ được."
  },
  {
    day: "D+3",
    date: "2026-10-23",
    pain_vas: 6,
    temperature: 37.8,
    wound_condition: "Đỏ nhẹ quanh chân chỉ, không mủ",
    triage_level: "ORANGE",
    verbatim: "Từ sáng đến giờ vết mổ hơi đau nhói hơn hôm qua, người thấy mệt và hơi âm ấm đầu 37.8 độ."
  }
];

const MOCK_TRANSCRIPT_TURNS: TranscriptTurn[] = [
  {
    id: "t1",
    speaker: "ai",
    text: "Dạ xin chào, tôi là MediGuard - Trợ lý AI theo dõi sức khỏe Bệnh viện. Tôi xin phép được nói chuyện với bác Nguyễn Văn Tuấn được không ạ?",
    timestamp: "08:30:05",
    audio_offset_seconds: 0,
    has_symptom: false
  },
  {
    id: "t2",
    speaker: "patient",
    text: "Vâng, tôi là Tuấn đây cô nhé.",
    timestamp: "08:30:12",
    audio_offset_seconds: 7,
    has_symptom: false
  },
  {
    id: "t3",
    speaker: "ai",
    text: "Dạ chào bác Tuấn. Hôm nay là ngày thứ 3 sau xuất viện, bác thấy vết mổ của mình cảm thấy thế nào ạ?",
    timestamp: "08:30:18",
    audio_offset_seconds: 13,
    has_symptom: false
  },
  {
    id: "t4",
    speaker: "patient",
    text: "Từ sáng đến giờ vết mổ hạ sườn phải hơi đau nhói hơn hôm qua cô ạ, người thấy mệt và hơi âm ấm đầu đo được khoảng 37.8 độ.",
    timestamp: "08:30:26",
    audio_offset_seconds: 21,
    has_symptom: true,
    symptom_category: "pain_worsening_fever"
  },
  {
    id: "t5",
    speaker: "ai",
    text: "Dạ ghi nhận bác có đau tăng và sốt nhẹ 37.8 độ. Bác kiểm tra xem băng gạc có bị ướt hoặc rỉ dịch mủ không ạ?",
    timestamp: "08:30:38",
    audio_offset_seconds: 33,
    has_symptom: false
  },
  {
    id: "t6",
    speaker: "patient",
    text: "Băng hơi đỏ quanh chân chỉ nhưng chưa thấy mủ cô ạ.",
    timestamp: "08:30:45",
    audio_offset_seconds: 40,
    has_symptom: true,
    symptom_category: "wound_erythema"
  }
];

export default function DashboardHome() {
  const [tickets, setTickets] = useState<TriageTicketItem[]>(INITIAL_MOCK_TICKETS);
  const [selectedTicketForVerify, setSelectedTicketForVerify] = useState<TriageTicketItem | null>(null);
  const [selectedTicketForResolve, setSelectedTicketForResolve] = useState<TriageTicketItem | null>(null);
  const [activeTab, setActiveTab] = useState<'triage' | 'timeline' | 'transcript'>('triage');

  const handleResolve = (ticketId: string, actionType: string, notes: string) => {
    setTickets(prev =>
      prev.map(t =>
        t.ticket_id === ticketId
          ? { ...t, status: 'RESOLVED', clinical_summary: `[ĐÃ XỬ LÝ - ${actionType}] ${notes}` }
          : t
      )
    );
    alert(`Đã hoàn thành vòng lặp xử lý cho phiếu ${ticketId}!`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Telemetry Header */}
      <header className="bg-slate-900 text-slate-300 text-xs px-6 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Voice Gateway: <strong>Stringee / OmiCall Connected</strong></span>
          </div>
          <div>STT Engine: <strong className="text-white">Deepgram Nova-2 (vi)</strong></div>
          <div>LLM Triage: <strong className="text-white">Gemini 2.5 Flash / Pro (Deterministic)</strong></div>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Tuân thủ Nghị định 13/2023/NĐ-CP</span>
        </div>
      </header>

      {/* Main Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
              MEDIGUARD <span className="text-blue-600">CARE</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              B2B SaaS Clinical Voice AI • Hàng Đợi Phân Loại & Theo Dõi Sau Xuất Viện
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('triage')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'triage' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hàng Đợi Triage ({tickets.filter(t => t.status !== 'RESOLVED').length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'timeline' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dòng Thời Gian Phục Hồi
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'transcript' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đối Chiếu Băng Ghi Âm (5s Audit)
          </button>
        </div>
      </nav>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {activeTab === 'triage' && (
          <TriageBoard
            tickets={tickets}
            onSelectTicket={(t) => {
              setSelectedTicketForVerify(t);
              setActiveTab('transcript');
            }}
            onOpenResolveModal={(t) => setSelectedTicketForResolve(t)}
          />
        )}

        {activeTab === 'timeline' && (
          <RecoveryTimeline
            patientName="Nguyễn Văn Tuấn"
            procedureName="Phẫu thuật Cắt túi mật nội soi"
            timeline={MOCK_TIMELINE}
          />
        )}

        {activeTab === 'transcript' && (
          <TranscriptVerifier
            patientName={selectedTicketForVerify?.patient_name || "Nguyễn Văn Tuấn"}
            callDate="2026-10-23 lúc 08:30"
            audioDuration="2 phút 15 giây"
            turns={MOCK_TRANSCRIPT_TURNS}
            onPlaySnippet={(offsetSec) => {
              console.log(`Playing 5s snippet from offset: ${offsetSec}s`);
            }}
          />
        )}
      </main>

      {/* Closed-Loop Action Resolution Modal */}
      {selectedTicketForResolve && (
        <ActionResolutionModal
          ticket={selectedTicketForResolve}
          onClose={() => setSelectedTicketForResolve(null)}
          onSubmitResolution={handleResolve}
        />
      )}
    </div>
  );
}
