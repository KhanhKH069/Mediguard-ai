import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  Check,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Volume2,
  RefreshCw,
  ArrowUpRight,
  Pill,
  Play,
  UserCheck,
  ScanEye,
  Mic,
  Phone,
  Stethoscope,
  Sparkles,
  X
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import {
  fetchSchedules,
  fetchLogs,
  fetchSymptoms,
  caregiverConfirm,
  triggerReminder,
  confirmSymptom,
  fetchHealth,
  connectRealtimeUpdates,
  subscribeLivePing,
  getMediaUrl
} from '../../services/api';

export default function Dashboard({ elderId = null, currentUser = null, onNavigate = null }) {
  const [schedules, setSchedules] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [symptomsData, setSymptomsData] = useState({ unhandled_count: 0, today_count: 0, symptoms: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [healthInfo, setHealthInfo] = useState({ ping_ms: 2, status: 'healthy', active_ws_clients: 1 });
  const [livePing, setLivePing] = useState(2);
  const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all' | 'pending' | 'confirmed'
  const [confirmModalId, setConfirmModalId] = useState(null);
  const [confirmNote, setConfirmNote] = useState('Đã quan sát qua camera gia đình thấy Bác đã uống kèm nước ấm');
  const [remindingId, setRemindingId] = useState(null);
  const [resolvingSymptomId, setResolvingSymptomId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ text: msg, type });
    setTimeout(() => setToastMsg(null), 3800);
  };

  const loadData = async () => {
    setError(null);
    try {
      const [schData, logsData, sympData, health] = await Promise.all([
        fetchSchedules(activeElderId),
        fetchLogs(activeElderId).catch(() => []),
        fetchSymptoms(activeElderId).catch(() => ({ unhandled_count: 0, today_count: 0, symptoms: [] })),
        fetchHealth()
      ]);
      setSchedules(Array.isArray(schData) ? schData : []);
      setRecentLogs(Array.isArray(logsData) ? logsData.slice(0, 8) : []);
      setSymptomsData(sympData || { unhandled_count: 0, today_count: 0, symptoms: [] });
      setHealthInfo(health);
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu tổng quan từ máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();

    const unsubPing = subscribeLivePing((ms) => {
      setLivePing(ms);
    });

    const disconnect = connectRealtimeUpdates(
      () => {
        loadData();
      },
      null,
      (pingMs) => setLivePing(pingMs)
    );

    const interval = setInterval(loadData, 12000);

    return () => {
      unsubPing();
      disconnect();
      clearInterval(interval);
    };
  }, [activeElderId]);

  const handleOpenConfirmModal = (schId) => {
    setConfirmModalId(schId);
    setConfirmNote('Đã quan sát qua camera gia đình thấy Bác đã uống kèm nước ấm');
  };

  const handleExecuteConfirm = async () => {
    if (!confirmModalId) return;
    try {
      await caregiverConfirm(confirmModalId, currentUser?.user_id, confirmNote);
      setConfirmModalId(null);
      showToast('Đã lưu xác nhận an toàn bước 3 vào hồ sơ điều trị.');
      await loadData();
    } catch (err) {
      showToast('Không thể lưu xác nhận: ' + (err.message || 'Lỗi kết nối'), 'error');
    }
  };

  const handleSendRemoteReminder = async (sch) => {
    setRemindingId(sch.id);
    try {
      await triggerReminder(sch.id);
      showToast(`Đã phát lời nhắc giọng nói từ xa cho cữ ${sch.time_period} (${sch.target_time}).`);
      await loadData();
    } catch (err) {
      showToast('Không thể phát lời nhắc: ' + (err.message || 'Lỗi kết nối'), 'error');
    } finally {
      setRemindingId(null);
    }
  };

  const handleQuickResolveSymptom = async (sympId) => {
    setResolvingSymptomId(sympId);
    try {
      await confirmSymptom(sympId, currentUser?.user_id, 'Gia đình đã gọi điện kiểm tra từ Dashboard');
      showToast('Đã đánh dấu xử lý thông báo triệu chứng của Bác.');
      await loadData();
    } catch (err) {
      showToast('Không thể cập nhật trạng thái triệu chứng: ' + err.message, 'error');
    } finally {
      setResolvingSymptomId(null);
    }
  };

  const totalSchedules = schedules.length;
  const respondedSchedules = schedules.filter((s) => s.status?.user_responded).length;
  const cameraRecordedSchedules = schedules.filter((s) => s.status?.device_recorded).length;
  const confirmedSchedules = schedules.filter((s) => s.status?.caregiver_confirmed).length;
  const pendingSchedules = schedules.filter((s) => !s.status?.caregiver_confirmed);
  const complianceRate = totalSchedules > 0 ? Math.round((respondedSchedules / totalSchedules) * 100) : 100;
  const visionRate = totalSchedules > 0 ? Math.round((cameraRecordedSchedules / totalSchedules) * 100) : 100;
  const verificationRate = totalSchedules > 0 ? Math.round((confirmedSchedules / totalSchedules) * 100) : 100;

  const unhandledSymptoms = (symptomsData.symptoms || []).filter((s) => !s.caregiver_confirmed);
  const totalAlertsCount = unhandledSymptoms.length + pendingSchedules.length;

  const filteredSchedulesList = schedules.filter((s) => {
    if (scheduleFilter === 'pending') return !s.status?.caregiver_confirmed;
    if (scheduleFilter === 'confirmed') return Boolean(s.status?.caregiver_confirmed);
    return true;
  });

  const weeklyChartData = [
    { day: 'T2', rate: 100, verified: 3, total: 3 },
    { day: 'T3', rate: 100, verified: 3, total: 3 },
    { day: 'T4', rate: 67, verified: 2, total: 3, note: 'Trễ cữ trưa' },
    { day: 'T5', rate: 100, verified: 3, total: 3 },
    { day: 'T6', rate: 100, verified: 3, total: 3 },
    { day: 'T7', rate: 100, verified: 3, total: 3 },
    {
      day: 'Hôm nay',
      rate: complianceRate,
      verified: respondedSchedules,
      total: totalSchedules || 3,
      isToday: true
    }
  ];

  if (loading && schedules.length === 0) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-28 bg-white dark:bg-[#0E1E36] rounded-2xl border border-slate-200 dark:border-slate-800" />
        <div className="h-44 bg-white dark:bg-[#0E1E36] rounded-2xl border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-96 bg-white dark:bg-[#0E1E36] rounded-2xl border border-slate-200 dark:border-slate-800" />
          <div className="lg:col-span-5 h-96 bg-white dark:bg-[#0E1E36] rounded-2xl border border-slate-200 dark:border-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMsg && (
        <div
          className={`fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 px-4 py-3 rounded-xl shadow-saas-lg border flex items-center gap-2.5 text-xs sm:text-sm font-semibold transition-all ${
            toastMsg.type === 'error'
              ? 'bg-red-700 text-white border-red-500'
              : 'bg-[#0B1F3A] text-white border-[#0D9488]/60'
          }`}
        >
          {toastMsg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#2DD4BF] shrink-0" />
          )}
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900 dark:text-red-200 text-xs sm:text-sm">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold">Gián đoạn đồng bộ dữ liệu</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={loadData} className="ui-btn-secondary self-end sm:self-center shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử tải lại</span>
          </button>
        </div>
      )}

      {/* =====================================================================
          1. THANH TỔNG QUAN HỒ SƠ & 4 CHỈ SỐ LÂM SÀNG TRỌNG YẾU (CLINICAL SUMMARY STRIP)
         ===================================================================== */}
      <section className="ui-card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Patient Context */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0B1F3A] text-white flex items-center justify-center font-display font-bold text-lg shrink-0 border border-slate-800">
              B
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ui-kicker">HỒ SƠ ĐANG GIÁM SÁT</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Độ trễ {livePing}ms
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B1F3A] dark:text-white tracking-tight">
                Bác Nguyễn Văn Ba <span className="text-sm font-normal text-slate-500 dark:text-slate-400">(72 tuổi • Mã #0{activeElderId})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                  <Stethoscope className="w-3.5 h-3.5 text-[#0D9488]" />
                  Tăng huyết áp độ 2, Đái tháo đường tuýp 2
                </span>
                <span>•</span>
                <span>Phác đồ chuẩn: {totalSchedules} cữ/ngày</span>
              </p>
            </div>
          </div>

          {/* 4 Scannable KPI Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 lg:w-auto">
            <div
              className={`px-3.5 py-2.5 rounded-xl border ${
                totalAlertsCount > 0
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
                  : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70'
              }`}
            >
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                Cần kiểm tra
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span
                  className={`text-xl font-display font-bold tabular-nums ${
                    totalAlertsCount > 0
                      ? 'text-amber-800 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {totalAlertsCount}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">sự kiện</span>
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Bác đã báo uống
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white tabular-nums">
                  {respondedSchedules}/{totalSchedules}
                </span>
                <span className="text-[11px] font-mono font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
                  {complianceRate}%
                </span>
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Ảnh thuốc khớp AI
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white tabular-nums">
                  {cameraRecordedSchedules}/{totalSchedules}
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-500">
                  {visionRate}%
                </span>
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Gia đình đã duyệt
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-display font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {confirmedSchedules}/{totalSchedules}
                </span>
                <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {verificationRate}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. TÂM ĐIỂM CẦN NGƯỜI CHĂM SÓC KIỂM TRA (CAREGIVER PRIORITY ACTION CENTER)
         ===================================================================== */}
      {totalAlertsCount > 0 ? (
        <section className="rounded-2xl bg-white dark:bg-[#0E1E36] border-2 border-amber-300/90 dark:border-amber-700/80 shadow-saas-md overflow-hidden">
          <div className="px-5 sm:px-6 py-4 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-display font-bold text-[#0B1F3A] dark:text-white">
                    Cần người chăm sóc kiểm tra & duyệt ({totalAlertsCount})
                  </h2>
                  {unhandledSymptoms.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-mono font-bold">
                      {unhandledSymptoms.length} triệu chứng mới
                    </span>
                  )}
                  {pendingSchedules.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#0B1F3A] text-white text-[11px] font-mono font-semibold">
                      {pendingSchedules.length} cữ chờ xác nhận
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Kiểm tra các mục ưu tiên dưới đây để khép kín quy trình an toàn thuốc 3 lớp cho Bác
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {onNavigate && (
                <button
                  onClick={() => onNavigate('vision_check')}
                  className="ui-btn-secondary text-xs py-1.5 px-3"
                >
                  <ScanEye className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Đối chiếu ảnh</span>
                </button>
              )}
              {onNavigate && (
                <button
                  onClick={() => onNavigate('logs')}
                  className="ui-btn-secondary text-xs py-1.5 px-3"
                >
                  <span>Nhật ký chi tiết</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#0D9488]" />
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* Ưu tiên 1: Cảnh báo triệu chứng chưa xử lý */}
            {unhandledSymptoms.map((symp) => (
              <div
                key={`alert-symp-${symp.id}`}
                className="px-5 sm:px-6 py-4 bg-red-50/45 dark:bg-red-950/25 border-l-4 border-l-red-600 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0 mt-0.5 border border-red-200 dark:border-red-800">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                        CẢNH BÁO TRIỆU CHỨNG • {symp.severity || 'CẦN CHÚ Ý'}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        Ghi nhận lúc {symp.reported_time} ({symp.reported_date || 'Hôm nay'})
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-display font-bold text-[#0B1F3A] dark:text-white">
                      Bác báo: “{symp.symptom_name}”
                      {symp.description && symp.description !== symp.symptom_name
                        ? ` — ${symp.description}`
                        : ''}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Khuyến nghị: Gọi điện hỏi thăm trực tiếp tình trạng của Bác trước khi đánh dấu hoàn tất.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                  <a
                    href="tel:0901234567"
                    className="ui-btn-secondary text-xs py-2 px-3"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>Gọi cho Bác</span>
                  </a>
                  <button
                    onClick={() => handleQuickResolveSymptom(symp.id)}
                    disabled={resolvingSymptomId === symp.id}
                    className="ui-btn-danger text-xs py-2 px-3.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {resolvingSymptomId === symp.id ? 'Đang lưu...' : 'Xác nhận đã kiểm tra'}
                    </span>
                  </button>
                </div>
              </div>
            ))}

            {/* Ưu tiên 2: Các cữ thuốc chờ xác nhận bước 3 */}
            {pendingSchedules.map((sch, idx) => {
              const elderDone = Boolean(sch.status?.user_responded);
              const cameraDone = Boolean(sch.status?.device_recorded);
              return (
                <div
                  key={`alert-sch-${sch.id}`}
                  className={`px-5 sm:px-6 py-4 border-l-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                    elderDone
                      ? 'border-l-[#0D9488] bg-[#F0FDFA]/40 dark:bg-[#0D9488]/5 hover:bg-[#F0FDFA]/70'
                      : 'border-l-amber-500 hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl font-mono font-bold text-xs flex flex-col items-center justify-center shrink-0 mt-0.5 border ${
                        elderDone
                          ? 'bg-[#0D9488] text-white border-[#0F766E]'
                          : 'bg-amber-100/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      <span>{sch.target_time}</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-display font-bold text-[#0B1F3A] dark:text-white">
                          Cữ Buổi {sch.time_period}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          Ngăn #0{sch.compartment_number || idx + 1}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${
                            elderDone
                              ? 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4] dark:bg-[#0D9488]/20 dark:text-[#5EEAD4] dark:border-[#0D9488]/40'
                              : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {elderDone
                            ? 'Bác đã báo uống • Chờ người nhà duyệt bước 3'
                            : 'Chưa ghi nhận phản hồi uống từ Bác'}
                        </span>
                        {cameraDone && (
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-sky-300">
                            Ảnh AI: {sch.status?.cv_status || 'MATCHED'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {sch.medications?.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#0B1F3A] dark:text-slate-200"
                          >
                            <Pill className="w-3 h-3 text-[#0D9488]" />
                            <span>{m.name}</span>
                            <strong className="font-mono text-[#0D9488] dark:text-[#2DD4BF]">
                              {m.dosage}
                            </strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                    {!elderDone && (
                      <button
                        onClick={() => handleSendRemoteReminder(sch)}
                        disabled={remindingId === sch.id}
                        className="ui-btn-secondary text-xs py-2 px-3"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" />
                        <span>{remindingId === sch.id ? 'Đang phát loa...' : 'Nhắc từ xa'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenConfirmModal(sch.id)}
                      className="ui-btn-primary text-xs py-2 px-3.5"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Duyệt an toàn</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl bg-[#F0FDFA] dark:bg-[#0D9488]/10 border border-[#99F6E4] dark:border-[#0D9488]/30 px-5 sm:px-6 py-4 shadow-saas flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-display font-bold text-[#0B1F3A] dark:text-white">
                Tất cả cữ thuốc & thông báo hôm nay đã được xác minh an toàn
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Không có cảnh báo tồn đọng. Ba lớp bảo vệ (Giọng nói • Thị giác AI • Người nhà) đã hoàn tất 100%.
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('vision_check')}
              className="ui-btn-secondary self-start sm:self-center shrink-0"
            >
              <ScanEye className="w-3.5 h-3.5 text-[#0D9488]" />
              <span>Kiểm tra ảnh thuốc</span>
            </button>
          )}
        </section>
      )}

      {/* =====================================================================
          3. BỐ CỤC CHÍNH 2 CỘT: LỊCH THUỐC HÔM NAY (7 CỘT) & PHÂN TÍCH TUÂN THỦ (5 CỘT)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI (7/12): LỊCH UỐNG THUỐC HÔM NAY & TRẠNG THÁI XÁC NHẬN */}
        <section className="lg:col-span-7 ui-card overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="ui-kicker block">PHÁC ĐỒ ĐIỀU TRỊ HÔM NAY</span>
              <h3 className="ui-section-title mt-0.5">
                Lịch uống thuốc & Tiến trình xác thực 3 lớp
              </h3>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: `Tất cả (${totalSchedules})` },
                { id: 'pending', label: `Chờ duyệt (${pendingSchedules.length})` },
                { id: 'confirmed', label: `Đã duyệt (${confirmedSchedules})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setScheduleFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    scheduleFilter === tab.id
                      ? 'bg-[#0B1F3A] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {onNavigate && (
                <button
                  onClick={() => onNavigate('schedules')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#0D9488] dark:text-[#2DD4BF] transition-colors cursor-pointer"
                >
                  Quản lý lịch
                </button>
              )}
            </div>
          </div>

          {schedules.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Pill className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                  Chưa có lịch uống thuốc nào cho hôm nay
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Thiết lập lịch nhắc thuốc theo đơn bác sĩ để hệ thống tự động phát giọng nói nhắc Bác và đối chiếu ảnh vỉ thuốc.
                </p>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('schedules')}
                  className="ui-btn-primary mt-2"
                >
                  <span>+ Tạo lịch nhắc thuốc đầu tiên</span>
                </button>
              )}
            </div>
          ) : filteredSchedulesList.length === 0 ? (
            <div className="p-10 text-center space-y-2.5">
              <CheckCircle2 className="w-9 h-9 text-[#0D9488] mx-auto" />
              <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                Không có cữ thuốc nào trong chế độ lọc này
              </p>
              <button
                onClick={() => setScheduleFilter('all')}
                className="ui-btn-subtle text-xs"
              >
                Hiển thị tất cả {totalSchedules} cữ thuốc
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSchedulesList.map((sch, idx) => {
                const isConfirmed = Boolean(sch.status?.caregiver_confirmed);
                const isResponded = Boolean(sch.status?.user_responded);
                return (
                  <div
                    key={sch.id}
                    className={`p-5 sm:p-6 transition-colors ${
                      !isConfirmed
                        ? 'bg-amber-50/10 dark:bg-amber-950/5'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Dòng 1: Thời gian, Cữ thuốc & Ngăn khay */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 rounded-xl bg-[#0B1F3A] text-white font-mono font-bold text-sm tabular-nums shadow-xs">
                          {sch.target_time}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-display font-bold text-[#0B1F3A] dark:text-white leading-tight">
                              Cữ Buổi {sch.time_period}
                            </h4>
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                              Ngăn #0{sch.compartment_number || idx + 1}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {sch.notes || `Uống sau bữa ăn kèm nước ấm • ${sch.medications?.length || 0} loại thuốc`}
                          </span>
                        </div>
                      </div>

                      {isConfirmed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Đã xác thực 3 lớp</span>
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            isResponded
                              ? 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] border-[#99F6E4] dark:border-[#0D9488]/40'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {isResponded ? 'Chờ người nhà duyệt bước 3' : 'Chưa uống / Chờ phản hồi'}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Dòng 2: Danh sách viên thuốc trong cữ */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {sch.medications?.length > 0 ? (
                        sch.medications.map((m) => (
                          <div
                            key={m.id}
                            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 text-xs flex items-center gap-2"
                          >
                            <Pill className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                            <span className="font-semibold text-[#0B1F3A] dark:text-white">
                              {m.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 font-mono text-[11px] text-[#0D9488] dark:text-[#2DD4BF] font-bold border border-slate-200/70 dark:border-slate-700">
                              {m.dosage}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Chưa gắn danh mục viên thuốc chi tiết
                        </span>
                      )}
                    </div>

                    {/* Dòng 3: Trạng thái xác thực 3 lớp + Thao tác */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          type="user_responded"
                          active={sch.status?.user_responded}
                          label={sch.status?.user_responded ? '1. Bác đã báo uống' : '1. Chưa phản hồi'}
                        />
                        <StatusBadge
                          type="device_recorded"
                          active={sch.status?.device_recorded}
                          label={
                            sch.status?.device_recorded
                              ? `2. Ảnh khớp (${sch.status?.cv_status || 'OK'})`
                              : '2. Chờ ảnh thuốc'
                          }
                        />
                        <StatusBadge
                          type="caregiver_confirmed"
                          active={sch.status?.caregiver_confirmed}
                          label={
                            sch.status?.caregiver_confirmed ? '3. Gia đình đã duyệt' : '3. Chờ duyệt'
                          }
                        />
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => handleSendRemoteReminder(sch)}
                          disabled={remindingId === sch.id}
                          className="ui-btn-secondary text-xs py-1.5 px-3"
                          title="Phát loa nhắc thuốc tại nhà cho Bác"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" />
                          <span>{remindingId === sch.id ? 'Đang phát...' : 'Nhắc từ xa'}</span>
                        </button>

                        {!isConfirmed && (
                          <button
                            onClick={() => handleOpenConfirmModal(sch.id)}
                            className="ui-btn-primary text-xs py-1.5 px-3.5"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Xác nhận</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* CỘT PHẢI (5/12): CHỈ SỐ TUÂN THỦ LÂM SÀNG & BIỂU ĐỒ 7 NGÀY */}
        <div className="lg:col-span-5 space-y-6">
          {/* Thẻ Phễu Xác Thực 3 Lớp & Biểu Đồ Tuân Thủ */}
          <section className="ui-card p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="ui-kicker block">PHỄU AN TOÀN DÙNG THUỐC 3 LỚP</span>
                <h3 className="ui-section-title mt-0.5">
                  Kiểm chứng chéo độc lập
                </h3>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-slate-400 block">Tỷ lệ hoàn tất</span>
                <span className="text-2xl font-display font-bold text-[#0D9488] dark:text-[#2DD4BF] tabular-nums">
                  {verificationRate}%
                </span>
              </div>
            </div>

            {/* Phễu xác thực 3 lớp (3-Layer Verification Funnel) */}
            <div className="space-y-2.5 text-xs">
              {[
                {
                  step: 'Lớp 1',
                  title: 'Phản hồi từ Bác (Giọng nói / Chạm)',
                  count: respondedSchedules,
                  total: totalSchedules,
                  percent: complianceRate,
                  icon: Mic,
                  barColor: 'bg-[#0D9488]',
                  iconColor: 'text-[#0D9488]'
                },
                {
                  step: 'Lớp 2',
                  title: 'Đối chiếu hình ảnh thuốc (Vision AI)',
                  count: cameraRecordedSchedules,
                  total: totalSchedules,
                  percent: visionRate,
                  icon: Camera,
                  barColor: 'bg-[#0B1F3A] dark:bg-sky-400',
                  iconColor: 'text-[#0B1F3A] dark:text-sky-400'
                },
                {
                  step: 'Lớp 3',
                  title: 'Người chăm sóc duyệt xác nhận',
                  count: confirmedSchedules,
                  total: totalSchedules,
                  percent: verificationRate,
                  icon: UserCheck,
                  barColor: 'bg-emerald-600',
                  iconColor: 'text-emerald-600'
                }
              ].map((layer) => {
                const LayerIcon = layer.icon;
                return (
                  <div
                    key={layer.step}
                    className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#0B1F3A] dark:text-slate-200 flex items-center gap-2">
                        <LayerIcon className={`w-4 h-4 shrink-0 ${layer.iconColor}`} />
                        <span>
                          <strong>{layer.step}:</strong> {layer.title}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-[#0B1F3A] dark:text-white tabular-nums">
                        {layer.count}/{layer.total} ({layer.percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${layer.barColor}`}
                        style={{ width: `${layer.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Biểu đồ xu hướng 7 ngày */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#0B1F3A] dark:text-white block">
                    Xu hướng tuân thủ 7 ngày gần nhất
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Trung bình tuần: <strong className="font-mono text-[#0B1F3A] dark:text-white">95%</strong> • Mục tiêu lâm sàng &ge; 90%
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] text-[11px] font-mono font-semibold border border-[#99F6E4] dark:border-[#0D9488]/30">
                  Ổn định
                </span>
              </div>

              <div className="relative flex items-end justify-between gap-2 h-36 pt-5 px-2 pb-1 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                {weeklyChartData.map((item) => (
                  <div
                    key={item.day}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                    title={`${item.day}: ${item.verified}/${item.total} cữ (${item.rate}%)`}
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {item.rate}%
                    </span>
                    <div className="w-full max-w-[30px] bg-slate-200/80 dark:bg-slate-800 rounded-t-md h-20 flex items-end overflow-hidden">
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          item.isToday
                            ? 'bg-[#0B1F3A] dark:bg-[#2DD4BF]'
                            : item.rate >= 90
                            ? 'bg-[#0D9488]'
                            : 'bg-amber-500'
                        }`}
                        style={{ height: `${Math.max(16, item.rate)}%` }}
                      />
                    </div>
                    <span
                      className={`text-[11px] ${
                        item.isToday
                          ? 'font-bold text-[#0B1F3A] dark:text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* =====================================================================
          4. LỊCH SỬ HOẠT ĐỘNG GẦN ĐÂY (DESKTOP TABLE + MOBILE TIMELINE)
         ===================================================================== */}
      <section className="ui-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <span className="ui-kicker block">NHẬT KÝ THỜI GIAN THỰC</span>
            <h3 className="ui-section-title mt-0.5">
              Hoạt động & Tương tác gần đây
            </h3>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('logs')}
              className="ui-btn-subtle text-xs py-1.5 px-3 shrink-0"
            >
              <span>Xem toàn bộ nhật ký</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#0D9488]" />
            </button>
          )}
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
              Chưa có tương tác nào được ghi nhận hôm nay
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Khi Bác bấm xác nhận uống thuốc, trò chuyện giọng nói hoặc chụp ảnh vỉ thuốc, sự kiện sẽ xuất hiện tức thời tại đây.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="ui-table-head">
                    <th className="ui-table-th">Thời gian</th>
                    <th className="ui-table-th">Loại sự kiện</th>
                    <th className="ui-table-th">Nội dung chi tiết</th>
                    <th className="ui-table-th">Đối chiếu AI</th>
                    <th className="ui-table-th text-right">Âm thanh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {recentLogs.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="ui-table-td font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                        {new Date(l.timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}{' '}
                        • {new Date(l.timestamp).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="ui-table-td whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                            l.event_type === 'caregiver_confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                              : l.event_type === 'user_responded'
                              ? 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4] dark:bg-[#0D9488]/20 dark:text-[#5EEAD4] dark:border-[#0D9488]/40'
                              : l.event_type === 'alert'
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {l.event_type === 'user_responded'
                            ? 'Bác phản hồi'
                            : l.event_type === 'caregiver_confirmed'
                            ? 'Gia đình duyệt'
                            : l.event_type === 'device_recorded'
                            ? 'Camera AI'
                            : l.event_type === 'reminder_sent'
                            ? 'Phát lời nhắc'
                            : l.event_type}
                        </span>
                      </td>
                      <td className="ui-table-td font-medium text-[#0B1F3A] dark:text-slate-200">
                        {l.response_content || l.device_action || l.notes || '—'}
                      </td>
                      <td className="ui-table-td">
                        {l.cv_status && l.cv_status !== 'NONE' ? (
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                              l.cv_status === 'MATCHED'
                                ? 'bg-[#F0FDFA] text-[#0D9488] border-[#99F6E4]'
                                : l.cv_status === 'MISMATCH'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {l.cv_status === 'MATCHED'
                              ? 'Phù hợp'
                              : l.cv_status === 'MISMATCH'
                              ? 'Không khớp'
                              : 'Chưa chắc chắn'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="ui-table-td text-right">
                        {l.audio_url ? (
                          <button
                            onClick={() => new Audio(getMediaUrl(l.audio_url)).play()}
                            className="p-1.5 rounded-lg bg-[#F0FDFA] text-[#0D9488] hover:bg-[#CCFBF1] border border-[#99F6E4] inline-flex items-center justify-center cursor-pointer"
                            title="Nghe lại ghi âm"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Vertical Activity Feed */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 px-5">
              {recentLogs.map((l) => (
                <div key={`mob-log-${l.id}`} className="py-3.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                        l.event_type === 'caregiver_confirmed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : l.event_type === 'user_responded'
                          ? 'bg-[#F0FDFA] text-[#0F766E] dark:bg-[#0D9488]/20 dark:text-[#5EEAD4]'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {l.event_type === 'user_responded'
                        ? 'Bác phản hồi'
                        : l.event_type === 'caregiver_confirmed'
                        ? 'Gia đình duyệt'
                        : l.event_type === 'device_recorded'
                        ? 'Camera AI'
                        : 'Phát lời nhắc'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(l.timestamp).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#0B1F3A] dark:text-slate-200">
                    {l.response_content || l.device_action || l.notes || 'Đã ghi nhận sự kiện'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Modal xác nhận cữ thuốc */}
      {confirmModalId && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmModalId(null)}
        >
          <div
            className="bg-white dark:bg-[#0E1E36] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-saas-lg border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0D9488]" />
                <span>Xác nhận hoàn tất cữ thuốc (Bước 3)</span>
              </h3>
              <button
                onClick={() => setConfirmModalId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Chọn nhanh phương thức xác minh của gia đình hoặc nhập ghi chú lưu vào bệnh án theo dõi:
            </p>

            <div className="space-y-2">
              {[
                'Đã quan sát qua camera gia đình thấy Bác đã uống kèm nước ấm',
                'Đã gọi điện thoại hỏi thăm trực tiếp Bác sau bữa ăn',
                'Đã kiểm tra khay thuốc thực tế tại nhà của Bác',
                'Đã đối chiếu ảnh chụp vỉ thuốc khớp với đơn chỉ định'
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setConfirmNote(preset)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    confirmNote === preset
                      ? 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] border-[#0D9488]'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  ✓ {preset}
                </button>
              ))}
            </div>

            <div>
              <label className="ui-label">Ghi chú xác nhận lưu nhật ký</label>
              <textarea
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                className="ui-input resize-none"
                rows="2"
                placeholder="Nhập ghi chú xác nhận..."
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalId(null)}
                className="flex-1 ui-btn-subtle py-2.5"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirm}
                className="flex-1 ui-btn-primary py-2.5"
              >
                <Check className="w-4 h-4" />
                <span>Lưu xác nhận an toàn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
