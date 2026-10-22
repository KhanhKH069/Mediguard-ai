import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, UserCheck, AlertOctagon, Check, Activity, Wifi, Radio, BellRing, Sparkles, Zap } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { fetchSchedules, caregiverConfirm, fetchHealth, connectRealtimeUpdates, subscribeLivePing, measurePing } from '../../services/api';

export default function Dashboard({ elderId = 1, currentUser = null }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [healthInfo, setHealthInfo] = useState({ ping_ms: 2, status: 'healthy', active_ws_clients: 1 });
  const [livePing, setLivePing] = useState(2);
  const [lastLiveEvent, setLastLiveEvent] = useState(null);
  const [confirmModalId, setConfirmModalId] = useState(null);
  const [confirmNote, setConfirmNote] = useState('Đã quan sát qua camera gia đình');

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? currentUser.user_id : 1);

  const loadData = async () => {
    try {
      const [schData, health] = await Promise.all([fetchSchedules(activeElderId), fetchHealth()]);
      setSchedules(schData || []);
      setHealthInfo(health);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Đăng ký nhận Ping thời gian thực
    const unsubPing = subscribeLivePing((ms) => {
      setLivePing(ms);
    });

    // Kết nối WebSocket thời gian thực (Zero-latency live updates)
    const disconnect = connectRealtimeUpdates(
      (msg) => {
        setLastLiveEvent(msg);
        loadData();
      },
      null,
      (pingMs) => setLivePing(pingMs)
    );

    // Fallback polling mỗi 10s nếu mạng chập chờn
    const interval = setInterval(loadData, 10000);

    return () => {
      unsubPing();
      disconnect();
      clearInterval(interval);
    };
  }, []);

  const handleOpenConfirmModal = (schId) => {
    setConfirmModalId(schId);
    setConfirmNote('Con/Cháu đã kiểm tra và xác nhận an toàn cho Bác');
  };

  const handleExecuteConfirm = async () => {
    if (!confirmModalId) return;
    try {
      await caregiverConfirm(confirmModalId, currentUser?.user_id || 2, confirmNote);
      setConfirmModalId(null);
      await loadData();
    } catch (err) {
      alert('Lỗi xác nhận: ' + err.message);
    }
  };

  // Tính toán KPI tuân thủ
  const totalSchedules = schedules.length;
  const respondedSchedules = schedules.filter((s) => s.status?.user_responded).length;
  const confirmedSchedules = schedules.filter((s) => s.status?.caregiver_confirmed).length;
  const complianceRate = totalSchedules > 0 ? Math.round((respondedSchedules / totalSchedules) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner Người Chăm Sóc */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-6 md:p-8 rounded-[32px] shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3.5 py-1 rounded-full bg-white/15 text-blue-200 border border-white/20 text-xs font-bold tracking-wide flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                ĐỒNG BỘ THỜI GIAN THỰC (WEBSOCKET)
              </span>
              <button
                onClick={measurePing}
                className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full font-mono font-bold border border-emerald-400/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Bấm để đo lại độ trễ mạng"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
                <span>Ping: {livePing}ms [Max Ping]</span>
              </button>
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-black text-white tracking-tight flex items-center gap-3">
              Bảng Điều Khiển Người Chăm Sóc 🛡️
            </h2>
            <p className="text-blue-100 text-sm md:text-base max-w-2xl mt-2 font-medium">
              Giám sát độc lập 3 trạng thái bất biến: Người cao tuổi phản hồi, Thiết bị/Camera ghi nhận, và Người thân xác nhận.
            </p>
          </div>

          {/* Thông báo sự kiện vừa phát sinh tức thời */}
          {lastLiveEvent && (
            <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-xs flex items-center gap-3 animate-pulse">
              <BellRing className="w-5 h-5 text-amber-300 animate-bounce flex-shrink-0" />
              <div>
                <div className="font-bold text-white">Sự kiện thời gian thực:</div>
                <div className="text-blue-200 capitalize">{lastLiveEvent.type?.replace('_', ' ')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Thẻ Thống Kê Nhanh (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tuân Thủ Hôm Nay</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-black text-4xl text-emerald-600 dark:text-emerald-400">{complianceRate}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">tốt</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${complianceRate}%` }} />
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bác Đã Phản Hồi</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-black text-4xl text-blue-600 dark:text-blue-400">{respondedSchedules}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">/ {totalSchedules} cữ</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-3 font-semibold">Tự động ghi nhận qua Kiosk</div>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gia Đình Đã Duyệt</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-black text-4xl text-purple-600 dark:text-purple-400">{confirmedSchedules}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">/ {totalSchedules} cữ</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-3 font-semibold">Bảo đảm nguyên tắc an toàn</div>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng Thái Kết Nối</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping-slow" />
            <span className="font-display font-black text-2xl text-slate-900 dark:text-white">Trực Tuyến</span>
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-3 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 fill-current text-amber-500" />
            <span>Độ trễ {livePing}ms • Max Ping</span>
          </div>
        </div>
      </div>

      {/* 3. Danh sách các cữ thuốc trong ngày */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {schedules.map((sch) => (
          <div
            key={sch.id}
            className="glass-card rounded-[32px] p-6 shadow-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-lg transition-all"
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xl font-display font-black text-slate-900 dark:text-white">
                      Cữ Buổi {sch.time_period} ({sch.target_time})
                    </span>
                  </div>
                </div>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full font-bold">
                  ID: #{sch.id}
                </span>
              </div>

              {/* Thuốc cần dùng */}
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Thuốc đã được duyệt trong cữ:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sch.medications.map((m) => (
                    <span
                      key={m.id}
                      className="bg-blue-50 dark:bg-slate-800/90 text-blue-800 dark:text-blue-300 px-3.5 py-1.5 rounded-xl text-sm font-bold border border-blue-200/80 dark:border-slate-700 shadow-sm"
                    >
                      💊 {m.name} ({m.dosage})
                    </span>
                  ))}
                </div>
              </div>

              {/* 3 TRẠNG THÁI TÁCH BIỆT RÕ RÀNG */}
              <div className="bg-slate-50/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 space-y-2 mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Chuỗi 3 trạng thái an toàn độc lập:
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    type="user_responded"
                    active={sch.status?.user_responded}
                    label={sch.status?.user_responded ? 'Bác Đã Phản Hồi' : 'Chưa Có Phản Hồi'}
                  />
                  <StatusBadge
                    type="device_recorded"
                    active={sch.status?.device_recorded}
                    label={
                      sch.status?.device_recorded
                        ? `Camera Ghi Nhận (${sch.status?.cv_status || 'OK'})`
                        : 'Chưa Ghi Nhận Camera'
                    }
                  />
                  <StatusBadge
                    type="caregiver_confirmed"
                    active={sch.status?.caregiver_confirmed}
                    label={sch.status?.caregiver_confirmed ? 'Con Đã Duyệt' : 'Chờ Người Nhà Duyệt'}
                  />
                </div>
              </div>

              {sch.notes && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-4">
                  📝 Ghi chú: {sch.notes}
                </p>
              )}
            </div>

            {/* Nút hành động của Người chăm sóc */}
            {!sch.status?.caregiver_confirmed ? (
              <button
                onClick={() => handleOpenConfirmModal(sch.id)}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-display font-bold text-base rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/20 active:scale-98"
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>Tôi Đã Kiểm Tra & Xác Nhận Cữ Thuốc Này</span>
              </button>
            ) : (
              <div className="text-center py-3 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 font-bold rounded-2xl text-sm border border-purple-200 dark:border-purple-800/60 flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>Gia đình đã hoàn tất kiểm tra & xác nhận an toàn</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal Xác Nhận Nhanh Có Lời Nhắn Mẫu */}
      {confirmModalId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800">
            <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              Xác Nhận Cữ Thuốc An Toàn Cho Bác
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Chọn ghi chú hoặc nhập lý do để ghi nhận vào chuỗi sự kiện kiểm toán bất biến (Audit Trail):
            </p>

            <div className="space-y-2">
              {[
                'Đã quan sát qua camera gia đình thấy Bác đã uống kèm nước ấm',
                'Đã gọi điện thoại hỏi thăm trực tiếp Bác',
                'Đã kiểm tra khay thuốc sau bữa ăn của Bác',
                'Đã đối chiếu theo đơn thuốc chỉ định của bác sĩ'
              ].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setConfirmNote(preset)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-semibold border transition-all ${
                    confirmNote === preset
                      ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 border-purple-400 dark:border-purple-600 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  ✓ {preset}
                </button>
              ))}
            </div>

            <textarea
              value={confirmNote}
              onChange={(e) => setConfirmNote(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              rows="2"
              placeholder="Ghi chú thêm..."
            />

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModalId(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteConfirm}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow-md transition-all active:scale-95"
              >
                Ghi Nhận Xác Nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
