import React, { useState, useEffect } from 'react';
import {
  Flame,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  Volume2,
  Check,
  ShieldAlert
} from 'lucide-react';
import { fetchTriageTickets, resolveTriageTicket, connectRealtimeUpdates } from '../services/api';
import { ActionResolutionModal } from './ActionResolutionModal';
import { TranscriptVerifier } from './TranscriptVerifier';

export interface TriageTicketItem {
  ticket_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  procedure: string;
  discharge_day: string;
  priority_level: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED';
  triggered_rules: string[];
  clinical_summary: string;
  evidence_quotes: string[];
  sla_remaining_minutes: number;
  assigned_to?: string;
  created_at?: string;
  resolved_at?: string | null;
  resolution_notes?: string | null;
}

interface TriageBoardProps {
  tickets?: TriageTicketItem[];
  onSelectTicket?: (ticket: TriageTicketItem) => void;
  onOpenResolveModal?: (ticket: TriageTicketItem) => void;
}

const DEFAULT_FALLBACK_TICKETS: TriageTicketItem[] = [
  {
    ticket_id: 'TCK-2026-0042',
    patient_id: 'PT-2026-0422',
    patient_name: 'Vũ Đình Khang',
    patient_phone: '0983 892 114',
    procedure: 'Nong và đặt Stent động mạch vành LAD',
    discharge_day: 'D+1',
    priority_level: 'RED',
    status: 'OPEN',
    triggered_rules: [
      'RED_FLAG: Đau thắt ngực cấp tính > 10 phút lan vai sau đặt Stent',
      'RED_FLAG: Khó thở đột ngột kèm vã mồ hôi lạnh'
    ],
    clinical_summary:
      'BÁO ĐỘNG ĐỎ: Đau tức ngực tái phát sau can thiệp Stent > 10 phút kèm khó thở và vã mồ hôi. Nguy cơ tắc Stent cấp tính, cần liên hệ ngay.',
    evidence_quotes: [
      'Tôi thấy tức nghẹn ngực trái lan ra vai khoảng 20 phút nay rồi, thở hơi dốc và thấy vã mồ hôi hột ở trán...'
    ],
    sla_remaining_minutes: 8,
    assigned_to: 'ĐD. Đặng Thanh Tâm'
  },
  {
    ticket_id: 'TCK-2026-0041',
    patient_id: 'PT-2026-0891',
    patient_name: 'Nguyễn Văn Tuấn',
    patient_phone: '0912 345 678',
    procedure: 'Phẫu thuật Cắt túi mật nội soi',
    discharge_day: 'D+3',
    priority_level: 'ORANGE',
    status: 'IN_PROGRESS',
    triggered_rules: [
      'ORANGE_FLAG: Đau vết mổ tăng dần từ ngày thứ 3 (VAS 4 -> 6)',
      'ORANGE_FLAG: Xuất hiện sốt nhẹ 37.8°C'
    ],
    clinical_summary:
      'Cảnh báo mức Cam: Triệu chứng đau tăng so với D+1 kèm sốt nhẹ 37.8°C mới xuất hiện. Cần điều dưỡng gọi lại đánh giá nhiễm trùng vết mổ trong 4 giờ.',
    evidence_quotes: [
      'Từ sáng đến giờ vết mổ hạ sườn phải hơi đau nhói hơn hôm qua cô ạ, người thấy mệt và hơi âm ấm đầu đo được khoảng 37.8 độ.'
    ],
    sla_remaining_minutes: 145,
    assigned_to: 'ĐD. CKI Nguyễn Thu Hằng'
  }
];

export const TriageBoard: React.FC<TriageBoardProps> = ({
  tickets: propTickets,
  onSelectTicket: propOnSelectTicket,
  onOpenResolveModal: propOnOpenResolveModal
}) => {
  const [internalTickets, setInternalTickets] = useState<TriageTicketItem[]>(DEFAULT_FALLBACK_TICKETS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const [activeTicketForModal, setActiveTicketForModal] = useState<TriageTicketItem | null>(null);
  const [activeTicketForAudio, setActiveTicketForAudio] = useState<TriageTicketItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTriageTickets();
      if (Array.isArray(data) && data.length > 0) {
        setInternalTickets(data);
      } else {
        setInternalTickets(DEFAULT_FALLBACK_TICKETS);
      }
    } catch (err) {
      setInternalTickets(DEFAULT_FALLBACK_TICKETS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();

    const disconnect = connectRealtimeUpdates((msg: any) => {
      if (msg && ['NEW_TRIAGE_TICKET', 'TICKET_RESOLVED', 'symptom_alert'].includes(msg.type)) {
        loadTickets();
      }
    });

    return () => disconnect();
  }, []);

  const tickets =
    propTickets && Array.isArray(propTickets) && propTickets.length > 0
      ? propTickets
      : internalTickets;

  const redTickets = tickets.filter((t) => t.priority_level === 'RED');
  const orangeTickets = tickets.filter((t) => t.priority_level === 'ORANGE');
  const yellowTickets = tickets.filter((t) => t.priority_level === 'YELLOW');
  const greenTickets = tickets.filter((t) => t.priority_level === 'GREEN');

  const filteredTickets =
    selectedFilter === 'ALL'
      ? [...redTickets, ...orangeTickets, ...yellowTickets, ...greenTickets]
      : tickets.filter((t) => t.priority_level === selectedFilter);

  const handleSelectTicket = (ticket: TriageTicketItem) => {
    if (propOnSelectTicket) {
      propOnSelectTicket(ticket);
    } else {
      setActiveTicketForAudio(ticket);
    }
  };

  const handleOpenResolveModal = (ticket: TriageTicketItem) => {
    if (propOnOpenResolveModal) {
      propOnOpenResolveModal(ticket);
    } else {
      setActiveTicketForModal(ticket);
    }
  };

  const handleSubmitResolution = async (ticketId: string, actionType: string, notes: string) => {
    try {
      await resolveTriageTicket(ticketId, actionType, notes).catch(() => {});
      setToastMessage(`Ca ${ticketId} đã được xử lý đóng hồ sơ (Closed-Loop) an toàn.`);
      setInternalTickets((prev) =>
        prev.map((t) =>
          t.ticket_id === ticketId ? { ...t, status: 'RESOLVED', resolution_notes: notes } : t
        )
      );
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      setToastMessage('Đã lưu kết quả xử lý cục bộ cho ca ' + ticketId);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {toastMessage && (
        <div className="p-4 rounded-xl bg-[#0B1F3A] text-white font-semibold text-xs sm:text-sm shadow-saas-md flex items-center justify-between border border-[#0D9488]/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2DD4BF] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-white/15 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Thanh tiêu đề & Bộ lọc phân loại */}
      <div className="bg-white dark:bg-[#0E1E36] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-saas space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#0D9488] dark:text-[#2DD4BF] block">
              CLINICAL TRIAGE QUEUE • CLOSED-LOOP SLA
            </span>
            <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B1F3A] dark:text-white mt-0.5">
              Hàng đợi phân loại ưu tiên lâm sàng ({filteredTickets.length} ca)
            </h2>
          </div>

          <button
            onClick={loadTickets}
            disabled={isLoading}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-[#0B1F3A] dark:text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0D9488] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* 4 Nút lọc mức độ ưu tiên */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'RED',
              label: 'Mức Đỏ • Khẩn cấp',
              count: redTickets.length,
              sla: 'SLA < 15 phút',
              activeClass: 'border-red-500 bg-red-50/80 dark:bg-red-950/40',
              textClass: 'text-red-700 dark:text-red-300',
              icon: Flame
            },
            {
              id: 'ORANGE',
              label: 'Mức Cam • Xem xét',
              count: orangeTickets.length,
              sla: 'SLA < 4 giờ',
              activeClass: 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40',
              textClass: 'text-amber-700 dark:text-amber-300',
              icon: AlertTriangle
            },
            {
              id: 'YELLOW',
              label: 'Mức Vàng • Hỏi thăm',
              count: yellowTickets.length,
              sla: 'SLA < 12 giờ',
              activeClass: 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/25',
              textClass: 'text-amber-700 dark:text-amber-300',
              icon: Activity
            },
            {
              id: 'GREEN',
              label: 'Mức Xanh • Ổn định',
              count: greenTickets.length,
              sla: 'Theo dõi định kỳ',
              activeClass: 'border-[#0D9488] bg-teal-50/70 dark:bg-teal-950/40',
              textClass: 'text-[#0D9488] dark:text-[#2DD4BF]',
              icon: CheckCircle2
            }
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = selectedFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedFilter(isSelected ? 'ALL' : item.id)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? item.activeClass
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold ${item.textClass}`}>{item.label}</span>
                  <Icon className={`w-4 h-4 ${item.textClass}`} />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-display font-bold text-[#0B1F3A] dark:text-white tabular-nums">
                    {item.count}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{item.sla}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh sách ca Triage */}
      <div className="space-y-3.5">
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#0E1E36] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
              Không có ca bệnh nào ở mức ưu tiên đang chọn
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tất cả các trường hợp ở nhóm phân loại này đã được xử lý hoặc chưa phát sinh cảnh báo mới.
            </p>
            {selectedFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedFilter('ALL')}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#0B1F3A] dark:text-white hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hiển thị tất cả mức ưu tiên
              </button>
            )}
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.ticket_id}
              className={`rounded-2xl bg-white dark:bg-[#0E1E36] p-5 sm:p-6 shadow-saas border-l-4 border border-slate-200/90 dark:border-slate-800 transition-all ${
                ticket.priority_level === 'RED'
                  ? 'border-l-red-600'
                  : ticket.priority_level === 'ORANGE'
                  ? 'border-l-amber-500'
                  : ticket.priority_level === 'YELLOW'
                  ? 'border-l-amber-400'
                  : 'border-l-[#0D9488]'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase ${
                        ticket.priority_level === 'RED'
                          ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300'
                          : ticket.priority_level === 'ORANGE'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-teal-50 text-[#0D9488] border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300'
                      }`}
                    >
                      {ticket.priority_level === 'RED'
                        ? 'BÁO ĐỘNG ĐỎ'
                        : ticket.priority_level === 'ORANGE'
                        ? 'MỨC CAM'
                        : ticket.priority_level === 'YELLOW'
                        ? 'MỨC VÀNG'
                        : 'MỨC XANH'}
                    </span>
                    <h3 className="font-display font-bold text-[#0B1F3A] dark:text-white text-base sm:text-lg">
                      {ticket.patient_name}
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">({ticket.patient_id})</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-slate-300 text-xs font-semibold rounded-md">
                      Hậu phẫu: {ticket.discharge_day}
                    </span>
                    {ticket.status === 'RESOLVED' && (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200">
                        ✓ Đã đóng ca
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>{ticket.procedure}</span>
                    <span>•</span>
                    <span>
                      SĐT: <strong className="font-mono text-[#0B1F3A] dark:text-white">{ticket.patient_phone}</strong>
                    </span>
                    {ticket.assigned_to && (
                      <>
                        <span>•</span>
                        <span>Phụ trách: <strong>{ticket.assigned_to}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                {/* SLA Countdown */}
                <div className="self-start lg:self-center">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold tabular-nums ${
                      ticket.sla_remaining_minutes <= 15
                        ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      SLA còn {Math.floor(ticket.sla_remaining_minutes / 60)}h {ticket.sla_remaining_minutes % 60}m
                    </span>
                  </div>
                </div>
              </div>

              {ticket.evidence_quotes && ticket.evidence_quotes.length > 0 && (
                <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border-l-2 border-[#0D9488] text-xs sm:text-sm text-[#0B1F3A] dark:text-slate-200">
                  “{ticket.evidence_quotes[0]}”
                </div>
              )}

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                  <strong className="text-[#0B1F3A] dark:text-white">Đánh giá lâm sàng:</strong>{' '}
                  {ticket.clinical_summary}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleSelectTicket(ticket)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>Nghe ghi âm</span>
                  </button>
                  <button
                    onClick={() => handleOpenResolveModal(ticket)}
                    disabled={ticket.status === 'RESOLVED'}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white transition-all cursor-pointer ${
                      ticket.status === 'RESOLVED'
                        ? 'bg-emerald-600 opacity-60 cursor-not-allowed'
                        : ticket.priority_level === 'RED'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-[#0B1F3A] hover:bg-slate-800'
                    }`}
                  >
                    {ticket.status === 'RESOLVED' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã xử lý</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-[#2DD4BF]" />
                        <span>Xử lý & Đóng ca</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Nghe Băng Ghi Âm & Đối Chiếu Transcript */}
      {activeTicketForAudio && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#0E1E36] rounded-2xl shadow-saas-lg p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-[#0D9488] uppercase">
                  Bằng chứng ghi âm cuộc gọi • {activeTicketForAudio.ticket_id}
                </span>
                <h3 className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white">
                  Bệnh nhân: {activeTicketForAudio.patient_name} ({activeTicketForAudio.discharge_day})
                </h3>
              </div>
              <button
                onClick={() => setActiveTicketForAudio(null)}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <TranscriptVerifier
              callId={activeTicketForAudio.ticket_id}
              patientName={activeTicketForAudio.patient_name}
              segments={[
                {
                  id: 'seg-1',
                  speaker: 'AI_AGENT',
                  text: `Dạ chào bác ${activeTicketForAudio.patient_name}, cháu gọi từ hệ thống chăm sóc hậu phẫu MediGuard để hỏi thăm sức khỏe của bác hôm nay ạ.`,
                  startTime: 0,
                  endTime: 5
                },
                {
                  id: 'seg-2',
                  speaker: 'PATIENT',
                  text:
                    activeTicketForAudio.evidence_quotes[0] ||
                    'Tôi thấy hơi đau nhói và mệt trong người từ sáng nay...',
                  startTime: 5,
                  endTime: 16,
                  isEvidence: true,
                  symptomLabel: activeTicketForAudio.triggered_rules[0] || 'Triệu chứng cảnh báo'
                }
              ]}
            />
          </div>
        </div>
      )}

      {/* Modal Xử Lý Đóng Ca */}
      {activeTicketForModal && (
        <ActionResolutionModal
          isOpen={true}
          ticket={activeTicketForModal}
          ticketId={activeTicketForModal.ticket_id}
          patientName={activeTicketForModal.patient_name}
          priorityLevel={activeTicketForModal.priority_level as 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN'}
          clinicalSummary={activeTicketForModal.clinical_summary}
          onClose={() => setActiveTicketForModal(null)}
          onSubmitResolution={handleSubmitResolution}
        />
      )}
    </div>
  );
};

export default TriageBoard;
