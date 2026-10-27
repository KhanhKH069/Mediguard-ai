import React, { useState, useEffect } from 'react';
import {
  Plus,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Check,
  Pill,
  RefreshCw,
  Filter
} from 'lucide-react';
import {
  fetchSchedules,
  fetchLogs,
  createSchedule,
  triggerReminder,
  caregiverConfirm,
  connectRealtimeUpdates
} from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import MedicationList from './MedicationList';

const TIME_PRESETS = [
  { period: 'Sáng', time: '07:30', label: 'Sáng • 07:30' },
  { period: 'Trưa', time: '11:30', label: 'Trưa • 11:30' },
  { period: 'Chiều', time: '16:30', label: 'Chiều • 16:30' },
  { period: 'Tối', time: '20:00', label: 'Tối • 20:00' }
];

export default function ScheduleManager({ elderId = null, currentUser = null }) {
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'unconfirmed' | 'confirmed'
  const [activeView, setActiveView] = useState('tracking'); // 'tracking' | 'create' | 'cabinet'

  // Form tạo lịch mới
  const [timePeriod, setTimePeriod] = useState('Sáng');
  const [targetTime, setTargetTime] = useState('07:30');
  const [notes, setNotes] = useState('');
  const [isPrescriptionVerified, setIsPrescriptionVerified] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);

  const showToast = (text, type = 'success') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schData, logData] = await Promise.all([
        fetchSchedules(activeElderId),
        fetchLogs(activeElderId).catch(() => [])
      ]);
      setSchedules(Array.isArray(schData) ? schData : []);
      setLogs(Array.isArray(logData) ? logData : []);
    } catch (err) {
      console.error(err);
      setError('Không thể tải danh sách lịch nhắc thuốc. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const disconnect = connectRealtimeUpdates(() => {
      loadData();
    });
    return () => disconnect();
  }, [activeElderId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!isPrescriptionVerified) {
      setFormError('Người chăm sóc vui lòng đánh dấu xác nhận đã đối chiếu đơn thuốc để đảm bảo an toàn cho Bác.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSchedule({
        elder_id: activeElderId,
        time_period: timePeriod,
        target_time: targetTime,
        verified_by: currentUser?.user_id,
        notes: notes || 'Đã đối chiếu theo đơn thuốc chỉ định của bác sĩ'
      });

      showToast(`Đã thêm và kích hoạt lịch nhắc cữ ${timePeriod} (${targetTime}).`);
      setNotes('');
      setIsPrescriptionVerified(false);
      setActiveView('tracking');
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Không thể tạo lịch thuốc. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSchedule = async (schId, periodLabel = '') => {
    setActionLoadingId(schId);
    try {
      await caregiverConfirm(
        schId,
        currentUser?.user_id,
        'Người chăm sóc đã đối chiếu và xác nhận tại màn hình Lịch thuốc'
      );
      showToast(`Đã xác nhận hoàn tất cữ ${periodLabel}.`);
      await loadData();
    } catch (err) {
      showToast(`Lỗi xác nhận: ${err.message || 'Vui lòng thử lại'}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemindNow = async (schId, periodLabel = '') => {
    setActionLoadingId(`remind-${schId}`);
    try {
      await triggerReminder(schId);
      showToast(`Đã phát âm thanh nhắc nhở từ xa cho cữ ${periodLabel}.`);
      await loadData();
    } catch (err) {
      showToast('Không thể gửi tín hiệu nhắc từ xa lúc này.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getConfirmationTimestamp = (sch) => {
    const matchingLog = logs.find(
      (l) =>
        (l.schedule_id === sch.id || !l.schedule_id) &&
        (l.event_type === 'caregiver_confirmed' || l.event_type === 'user_responded')
    );
    if (matchingLog && (sch.status?.user_responded || sch.status?.caregiver_confirmed)) {
      return (
        new Date(matchingLog.timestamp).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit'
        }) +
        ' • ' +
        new Date(matchingLog.timestamp).toLocaleDateString('vi-VN')
      );
    }
    if (sch.status?.caregiver_confirmed || sch.status?.user_responded) {
      return 'Hôm nay • Đã ghi nhận';
    }
    return null;
  };

  const confirmedCount = schedules.filter(
    (s) => s.status?.user_responded && s.status?.caregiver_confirmed
  ).length;
  const unconfirmedCount = schedules.length - confirmedCount;
  const confirmedPercent =
    schedules.length > 0 ? Math.round((confirmedCount / schedules.length) * 100) : 100;

  const filteredSchedules = schedules.filter((s) => {
    const isFullyConfirmed = s.status?.user_responded && s.status?.caregiver_confirmed;
    if (filterStatus === 'confirmed') return isFullyConfirmed;
    if (filterStatus === 'unconfirmed') return !isFullyConfirmed;
    return true;
  });

  return (
    <div className="space-y-6">
      {feedbackToast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs transition-all ${
            feedbackToast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200'
              : 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 border-[#99F6E4] dark:border-[#0D9488]/40 text-[#0F766E] dark:text-[#5EEAD4]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {feedbackToast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackToast.text}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-between gap-4 text-red-800 dark:text-red-200 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={loadData}
            className="ui-btn-secondary text-xs py-1.5 px-3 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* 1. Thanh Tiến Độ Xác Nhận Lịch Nhắc & Chuyển Chế Độ (Unified Ledger Strip) */}
      <section className="ui-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="ui-kicker">
                GIÁM SÁT LỊCH NHẮC HÀNG NGÀY
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {confirmedCount}/{schedules.length} cữ hoàn tất ({confirmedPercent}%)
              </span>
            </div>
            <h2 className="ui-page-title">
              Danh sách lịch nhắc, thời điểm xác nhận & trạng thái chờ duyệt
            </h2>
          </div>

          {/* 3 chế độ chức năng */}
          <div className="inline-flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 self-start lg:self-center">
            {[
              { id: 'tracking', label: 'Theo dõi lịch nhắc', icon: Clock },
              { id: 'create', label: 'Thêm lịch nhắc mới', icon: Plus },
              { id: 'cabinet', label: 'Danh mục tủ thuốc', icon: Pill }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#0B1F3A] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1F3A] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thanh phân bổ trạng thái (Segmented Progress & Inline Metrics) */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#0B1F3A] dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0D9488]" />
                  <span>Đã xác nhận: <strong className="font-mono tabular-nums">{confirmedCount}</strong> cữ</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span>Chờ kiểm tra / duyệt: <strong className="font-mono tabular-nums">{unconfirmedCount}</strong> cữ</span>
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-[#0B1F3A] dark:text-slate-200 tabular-nums">
                Tổng: {schedules.length} cữ/ngày
              </span>
            </div>

            <div className="w-full h-2 bg-amber-100 dark:bg-amber-950/60 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-[#0D9488] transition-all duration-500"
                style={{ width: `${confirmedPercent}%` }}
              />
            </div>
          </div>

          {activeView === 'tracking' && (
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
              {[
                { id: 'all', label: `Tất cả (${schedules.length})` },
                { id: 'unconfirmed', label: `Chờ duyệt (${unconfirmedCount})` },
                { id: 'confirmed', label: `Đã xác nhận (${confirmedCount})` }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    filterStatus === f.id
                      ? 'bg-[#0B1F3A] text-white'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={loadData}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0D9488]' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* VIEW 1: Danh sách lịch nhắc, thời điểm xác nhận và trạng thái chưa xác nhận */}
      {activeView === 'tracking' && (
        <section className="ui-card overflow-hidden">
          {loading && schedules.length === 0 ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-[#0D9488] mx-auto mb-2.5" />
              <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                Không có cữ thuốc nào trong bộ lọc này
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có thể chuyển bộ lọc sang “Tất cả” hoặc thêm lịch nhắc thuốc mới.
              </p>
              {filterStatus !== 'all' && (
                <button
                  onClick={() => setFilterStatus('all')}
                  className="mt-3 ui-btn-secondary text-xs py-1.5 px-3.5"
                >
                  Xem tất cả lịch nhắc
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE (Hiển thị trên màn hình >= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="ui-table-head">
                      <th className="ui-table-th">Khung giờ nhắc</th>
                      <th className="ui-table-th">Danh sách thuốc trong cữ</th>
                      <th className="ui-table-th">Thời điểm ghi nhận</th>
                      <th className="ui-table-th">Trạng thái xác thực 3 lớp</th>
                      <th className="ui-table-th text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSchedules.map((sch, idx) => {
                      const confirmedAt = getConfirmationTimestamp(sch);
                      const isFullyConfirmed =
                        sch.status?.user_responded && sch.status?.caregiver_confirmed;
                      const waitingCaregiverApproval =
                        sch.status?.user_responded && !sch.status?.caregiver_confirmed;

                      return (
                        <tr
                          key={sch.id}
                          className={`transition-colors ${
                            !isFullyConfirmed
                              ? 'bg-amber-50/15 dark:bg-amber-950/10 hover:bg-amber-50/30'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="ui-table-td whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-lg bg-[#0B1F3A] text-white font-mono font-bold text-xs tabular-nums">
                                {sch.target_time}
                              </span>
                              <div>
                                <div className="font-display font-bold text-[#0B1F3A] dark:text-white">
                                  Buổi {sch.time_period}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">
                                  Ngăn #0{sch.compartment_number || idx + 1}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="ui-table-td">
                            <div className="flex flex-wrap gap-1.5">
                              {sch.medications?.length > 0 ? (
                                sch.medications.map((m) => (
                                  <span
                                    key={m.id}
                                    className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B1F3A] dark:text-white"
                                  >
                                    {m.name}{' '}
                                    <span className="text-[#0D9488] dark:text-[#2DD4BF] font-mono">
                                      ({m.dosage})
                                    </span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">Chưa gắn thuốc</span>
                              )}
                            </div>
                          </td>

                          <td className="ui-table-td whitespace-nowrap">
                            {isFullyConfirmed && confirmedAt ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] border border-[#99F6E4] dark:border-[#0D9488]/30 text-xs font-mono font-semibold tabular-nums">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{confirmedAt}</span>
                              </div>
                            ) : waitingCaregiverApproval ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] border border-[#99F6E4] dark:border-[#0D9488]/30 text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Bác đã báo uống • Chờ duyệt</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Chưa ghi nhận uống</span>
                              </div>
                            )}
                          </td>

                          <td className="ui-table-td">
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge
                                type="user_responded"
                                active={sch.status?.user_responded}
                                label={sch.status?.user_responded ? 'Bác đã uống' : 'Chưa báo uống'}
                              />
                              <StatusBadge
                                type="device_recorded"
                                active={sch.status?.device_recorded}
                                label={sch.status?.device_recorded ? 'Ảnh khớp' : 'Chờ ảnh'}
                              />
                              <StatusBadge
                                type="caregiver_confirmed"
                                active={sch.status?.caregiver_confirmed}
                                label={sch.status?.caregiver_confirmed ? 'Đã xác nhận' : 'Chưa duyệt'}
                              />
                            </div>
                          </td>

                          <td className="ui-table-td text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleRemindNow(sch.id, sch.time_period)}
                                disabled={actionLoadingId === `remind-${sch.id}`}
                                className="ui-btn-secondary text-xs py-1.5 px-3"
                                title="Phát loa nhắc từ xa"
                              >
                                <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" />
                                <span>Nhắc</span>
                              </button>

                              {!sch.status?.caregiver_confirmed ? (
                                <button
                                  onClick={() => handleConfirmSchedule(sch.id, sch.time_period)}
                                  disabled={actionLoadingId === sch.id}
                                  className="ui-btn-primary text-xs py-1.5 px-3"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{actionLoadingId === sch.id ? 'Đang lưu...' : 'Xác nhận'}</span>
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2">
                                  ✓ Hoàn tất
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE SCHEDULE CARDS (Hiển thị trên màn hình < md) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSchedules.map((sch, idx) => {
                  const confirmedAt = getConfirmationTimestamp(sch);
                  const isFullyConfirmed =
                    sch.status?.user_responded && sch.status?.caregiver_confirmed;
                  return (
                    <div key={`mob-sch-${sch.id}`} className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded-lg bg-[#0B1F3A] text-white font-mono font-bold text-xs tabular-nums">
                            {sch.target_time}
                          </span>
                          <div>
                            <div className="text-sm font-display font-bold text-[#0B1F3A] dark:text-white">
                              Buổi {sch.time_period}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              Ngăn #0{sch.compartment_number || idx + 1}
                            </div>
                          </div>
                        </div>

                        {isFullyConfirmed && confirmedAt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4] text-[11px] font-mono font-semibold tabular-nums">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{confirmedAt}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                            <Clock className="w-3 h-3" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {sch.medications?.map((m) => (
                          <span
                            key={m.id}
                            className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B1F3A] dark:text-white"
                          >
                            {m.name} ({m.dosage})
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge
                          type="user_responded"
                          active={sch.status?.user_responded}
                          label={sch.status?.user_responded ? 'Bác đã uống' : 'Chưa báo uống'}
                        />
                        <StatusBadge
                          type="device_recorded"
                          active={sch.status?.device_recorded}
                          label={sch.status?.device_recorded ? 'Ảnh khớp' : 'Chờ ảnh'}
                        />
                        <StatusBadge
                          type="caregiver_confirmed"
                          active={sch.status?.caregiver_confirmed}
                          label={sch.status?.caregiver_confirmed ? 'Đã xác nhận' : 'Chưa duyệt'}
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleRemindNow(sch.id, sch.time_period)}
                          className="ui-btn-secondary text-xs py-1.5 px-3"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" />
                          <span>Nhắc từ xa</span>
                        </button>
                        {!sch.status?.caregiver_confirmed && (
                          <button
                            onClick={() => handleConfirmSchedule(sch.id, sch.time_period)}
                            className="ui-btn-primary text-xs py-1.5 px-3.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Xác nhận</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* VIEW 2: Biểu mẫu thêm lịch nhắc thuốc mới */}
      {activeView === 'create' && (
        <div className="ui-card p-6 sm:p-8 max-w-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0D9488] dark:text-[#2DD4BF] flex items-center justify-center border border-[#99F6E4] dark:border-[#0D9488]/30 shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="ui-section-title">
                  Thiết lập lịch nhắc thuốc mới
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cấu hình khung giờ phát giọng nói nhắc thuốc tự động cho Bác
                </p>
              </div>
            </div>
          </div>

          {/* Chọn nhanh khung giờ */}
          <div className="mb-5">
            <span className="ui-label">Chọn nhanh khung giờ tiêu chuẩn</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_PRESETS.map((preset) => {
                const isSelected = timePeriod === preset.period && targetTime === preset.time;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setTimePeriod(preset.period);
                      setTargetTime(preset.time);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                        : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0D9488]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="ui-label">Buổi uống trong ngày</label>
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  className="ui-select"
                >
                  <option value="Sáng">Buổi Sáng</option>
                  <option value="Trưa">Buổi Trưa</option>
                  <option value="Chiều">Buổi Chiều</option>
                  <option value="Tối">Buổi Tối</option>
                </select>
              </div>

              <div>
                <label className="ui-label">Giờ phát chuông nhắc (HH:MM)</label>
                <input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="ui-input font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="ui-label">
                Lời dặn kèm theo (Hệ thống sẽ đọc to cho Bác nghe)
              </label>
              <textarea
                rows="3"
                placeholder="Ví dụ: Bác nhớ uống sau khi ăn sáng 30 phút với một cốc nước ấm đầy..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="ui-input"
              />
            </div>

            <div className="p-4 bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30 rounded-xl flex items-start gap-3">
              <input
                type="checkbox"
                id="verifyCheck"
                checked={isPrescriptionVerified}
                onChange={(e) => {
                  setIsPrescriptionVerified(e.target.checked);
                  if (e.target.checked) setFormError('');
                }}
                className="mt-0.5 w-4 h-4 accent-[#0D9488] rounded cursor-pointer"
              />
              <label
                htmlFor="verifyCheck"
                className="text-xs sm:text-sm text-[#0B1F3A] dark:text-slate-200 font-medium cursor-pointer leading-relaxed"
              >
                <span className="font-bold text-[#0F766E] dark:text-[#5EEAD4] flex items-center gap-1.5 mb-0.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Xác nhận đối chiếu an toàn y khoa</span>
                </span>
                Tôi xác nhận khung giờ và danh mục thuốc này hoàn toàn khớp với đơn thuốc của bác sĩ điều trị.
              </label>
            </div>

            {formError && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl font-semibold text-xs border border-red-200 dark:border-red-800/60 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView('tracking')}
                className="ui-btn-secondary py-3 px-5"
              >
                Quay lại danh sách
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 ui-btn-primary py-3"
              >
                {isSubmitting ? 'Đang lưu lịch nhắc...' : 'Lưu & Kích hoạt lịch nhắc'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 3: Quản lý danh mục thuốc */}
      {activeView === 'cabinet' && <MedicationList elderId={activeElderId} currentUser={currentUser} />}
    </div>
  );
}
