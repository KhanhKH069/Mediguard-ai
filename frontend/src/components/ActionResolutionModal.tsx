import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  PhoneCall,
  Calendar,
  AlertOctagon,
  FileText,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { TriageTicketItem } from './TriageBoard';

interface ActionResolutionModalProps {
  isOpen?: boolean;
  ticket?: TriageTicketItem | null;
  ticketId?: string;
  patientName?: string;
  priorityLevel?: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  clinicalSummary?: string;
  onClose: () => void;
  onSubmitResolution: (ticketId: string, actionType: string, notes: string) => void;
}

export const ActionResolutionModal: React.FC<ActionResolutionModalProps> = ({
  isOpen = true,
  ticket = null,
  ticketId: propTicketId,
  patientName: propPatientName,
  priorityLevel: propPriorityLevel,
  clinicalSummary: propClinicalSummary,
  onClose,
  onSubmitResolution
}) => {
  const [selectedAction, setSelectedAction] = useState<string>('call_patient');
  const [resolutionNote, setResolutionNote] = useState<string>(
    'Đã gọi điện kiểm tra tình trạng người bệnh, hướng dẫn nghỉ ngơi và theo dõi sát các dấu hiệu sinh tồn.'
  );
  const [validationError, setValidationError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const resolvedTicketId = ticket?.ticket_id || propTicketId;
  const resolvedPatientName = ticket?.patient_name || propPatientName || 'Bệnh nhân';
  const resolvedPriority = ticket?.priority_level || propPriorityLevel || 'ORANGE';
  const resolvedSummary =
    ticket?.clinical_summary ||
    propClinicalSummary ||
    'Cần nhân viên y tế hoặc người chăm sóc xác minh trực tiếp trước khi đóng ca.';

  if (!isOpen || !resolvedTicketId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNote.trim()) {
      setValidationError('Vui lòng nhập ghi chú lâm sàng hoặc nội dung tư vấn trước khi đóng phiếu.');
      return;
    }

    setValidationError('');
    setIsSubmitting(true);
    onSubmitResolution(resolvedTicketId, selectedAction, resolutionNote.trim());
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F3A]/65 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0E1E36] rounded-2xl max-w-xl w-full shadow-saas-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md uppercase border ${
                  resolvedPriority === 'RED'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                    : resolvedPriority === 'ORANGE'
                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4] dark:bg-[#0D9488]/20 dark:text-[#5EEAD4]'
                }`}
              >
                {resolvedPriority === 'RED'
                  ? 'MỨC ĐỎ • KHẨN CẤP'
                  : resolvedPriority === 'ORANGE'
                  ? 'MỨC CAM • XEM XÉT'
                  : 'THEO DÕI'}
              </span>
              <h3 className="font-display font-bold text-[#0B1F3A] dark:text-white text-base sm:text-lg">
                Xác nhận xử lý lâm sàng (Closed-Loop)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hồ sơ: <strong className="text-[#0B1F3A] dark:text-slate-200">{resolvedPatientName}</strong> • Mã ca:{' '}
              <span className="font-mono font-semibold text-[#0D9488]">{resolvedTicketId}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[#0B1F3A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Clinical Justification Box */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-slate-200/90 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Tóm tắt cảnh báo lâm sàng
            </span>
            <p className="font-medium text-[#0B1F3A] dark:text-white">{resolvedSummary}</p>
          </div>

          {/* Action Radio Group */}
          <div className="space-y-2">
            <label className="ui-label">Phương án xử lý đã thực hiện *</label>

            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  id: 'call_patient',
                  label: 'Đã gọi điện thoại tư vấn trực tiếp và hướng dẫn theo dõi tại nhà',
                  icon: PhoneCall,
                  danger: false
                },
                {
                  id: 'schedule_early',
                  label: 'Đã xếp lịch hẹn người bệnh vào cơ sở y tế tái khám kiểm tra sớm',
                  icon: Calendar,
                  danger: false
                },
                {
                  id: 'report_surgeon',
                  label: 'Đã báo cáo bác sĩ điều trị chính và điều chỉnh phác đồ / liều thuốc',
                  icon: FileText,
                  danger: false
                },
                {
                  id: 'code_red',
                  label: 'Kích hoạt hỗ trợ y tế khẩn cấp (115) hoặc đưa vào viện kiểm tra ngay',
                  icon: AlertOctagon,
                  danger: true
                }
              ].map((opt) => {
                const Icon = opt.icon;
                const active = selectedAction === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-semibold transition-all ${
                      active
                        ? opt.danger
                          ? 'border-red-600 bg-red-50/80 dark:bg-red-950/50 text-red-900 dark:text-red-200'
                          : 'border-[#0D9488] bg-[#F0FDFA] dark:bg-[#0D9488]/15 text-[#0B1F3A] dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="action"
                      value={opt.id}
                      checked={active}
                      onChange={(e) => setSelectedAction(e.target.value)}
                      className="accent-[#0D9488] w-4 h-4 shrink-0"
                    />
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        opt.danger ? 'text-red-600' : 'text-[#0D9488] dark:text-[#2DD4BF]'
                      }`}
                    />
                    <span className="leading-snug">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Mandatory Clinical Notes */}
          <div>
            <label className="ui-label">Ghi chú kết quả xử lý (Lưu hồ sơ theo dõi) *</label>
            <textarea
              rows={3}
              value={resolutionNote}
              onChange={(e) => {
                setResolutionNote(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="Ví dụ: Đã gọi kiểm tra lúc 14:15, huyết áp ổn định 125/80 mmHg, đã dặn Bác nghỉ ngơi..."
              className="ui-input resize-none"
            />
            {validationError && (
              <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError}</span>
              </p>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="ui-btn-subtle">
              Hủy bỏ
            </button>
            <button type="submit" disabled={isSubmitting} className="ui-btn-primary">
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu & Đóng ca an toàn'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActionResolutionModal;
