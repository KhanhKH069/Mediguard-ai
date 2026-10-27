import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Check,
  Activity,
  Wifi,
  Zap,
  Camera,
  MessageCircle,
  Smartphone,
  Maximize2,
  PhoneCall,
  Pill,
  Send,
  CheckCheck,
  Eye,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  X
} from 'lucide-react';
import {
  fetchSchedules,
  fetchZaloMessages,
  sendZaloPillReport,
  confirmZaloMessage,
  caregiverConfirm,
  uploadScheduleReferenceImage,
  connectRealtimeUpdates,
  getMediaUrl
} from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';

function ZaloBadgeIcon({ className = 'w-4 h-4' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[#0068FF] text-white font-display font-bold text-[10px] leading-none shrink-0 ${className}`}
      aria-hidden="true"
    >
      Z
    </span>
  );
}

export default function ZaloMiniAppView({ elderId = null, currentUser = null }) {
  const [activeTab, setActiveTab] = useState('compartments'); // 'compartments' | 'zalo_chat' | 'dashboard' | 'settings'
  const [viewMode, setViewMode] = useState('phone'); // 'phone' | 'fullscreen'
  const [schedules, setSchedules] = useState([]);
  const [zaloMessages, setZaloMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingScheduleId, setUploadingScheduleId] = useState(null);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [callingElder, setCallingElder] = useState(false);
  const fileInputRef = useRef(null);
  const [currentUploadTarget, setCurrentUploadTarget] = useState(null);

  const activeElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [schData, msgs] = await Promise.all([
        fetchSchedules(activeElderId),
        fetchZaloMessages(activeElderId)
      ]);
      setSchedules(Array.isArray(schData) ? schData : []);
      setZaloMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu Zalo Mini App:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const disconnect = connectRealtimeUpdates((msg) => {
      if (
        [
          'zalo_message_sent',
          'zalo_message_confirmed',
          'device_recorded',
          'elder_responded',
          'schedule_updated',
          'caregiver_confirmed'
        ].includes(msg.type)
      ) {
        loadData();
        if (msg.type === 'zalo_message_sent') {
          playChimeSound();
          showToast('Tin nhắn Zalo OA mới: Báo cáo ảnh chụp ngăn thuốc của Bác!', 'info');
        }
      }
    });

    return () => disconnect();
  }, [activeElderId]);

  const handleTriggerUpload = (scheduleId) => {
    setCurrentUploadTarget(scheduleId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadTarget) return;

    setUploadingScheduleId(currentUploadTarget);
    try {
      await uploadScheduleReferenceImage(currentUploadTarget, file);
      showToast('Đã lưu ảnh mẫu ngăn thuốc mới! Thiết bị của Bác sẽ dùng ảnh này đối chiếu.');
      await loadData();
    } catch (err) {
      showToast('Lỗi tải ảnh mẫu: ' + (err.message || 'Vui lòng thử lại'), 'error');
    } finally {
      setUploadingScheduleId(null);
      setCurrentUploadTarget(null);
    }
  };

  const handleConfirmZaloMessage = async (msgId, scheduleId) => {
    try {
      await confirmZaloMessage(msgId, currentUser?.full_name || 'Nguyễn Văn Nam (Con trai)');
      if (scheduleId) {
        await caregiverConfirm(scheduleId, currentUser?.user_id, 'Con đã xác nhận an tâm qua tin nhắn Zalo');
      }
      showToast('Đã xác nhận an tâm qua Zalo! Hệ thống đã ghi nhật ký y tế.');
      await loadData();
    } catch (err) {
      showToast('Lỗi xác nhận: ' + (err.message || 'Vui lòng thử lại'), 'error');
    }
  };

  const handleSendTestZaloReport = async () => {
    try {
      showToast('Đang gửi ảnh chụp ngăn thuốc từ giá đỡ vào tin nhắn Zalo...', 'info');
      await sendZaloPillReport({
        elder_name: 'Bác Nguyễn Văn Ba (72 tuổi)',
        elder_id: activeElderId,
        schedule_id: schedules[0]?.id || 1,
        time_period: 'Sáng',
        target_time: '07:30',
        medications: ['Amlodipine 5mg (1 viên)', 'Ginkgo Biloba (1 viên)'],
        captured_image_url: '/storage/reference_images/ref_amlodipine.jpg',
        reference_image_url: '/storage/reference_images/ref_amlodipine.jpg',
        cv_status: 'MATCHED',
        confidence_score: 0.96,
        elder_speech: 'Dạ, Bác đã uống xong thuốc cữ sáng rồi con nhé!',
        notes: 'Chụp tự động từ camera giá đỡ (Zero-touch Stand Mode) & nhận diện giọng nói Bác.'
      });
      playChimeSound();
      showToast('Đã gửi báo cáo kèm ảnh ngăn thuốc thẳng qua tin nhắn Zalo!');
      await loadData();
    } catch (err) {
      showToast('Lỗi gửi tin nhắn Zalo: ' + (err.message || 'Vui lòng thử lại'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs transition-all ${
            toastMessage.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200'
              : toastMessage.type === 'info'
              ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200'
              : 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 border-[#99F6E4] dark:border-[#0D9488]/40 text-[#0F766E] dark:text-[#5EEAD4]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {toastMessage.type === 'info' ? (
              <MessageCircle className="w-4 h-4 shrink-0 text-[#0068FF]" />
            ) : toastMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0D9488]" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Hidden file input for baseline photo upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept="image/*"
        className="hidden"
      />

      {/* Top Banner: Cổng Zalo OA & Mini App */}
      <div className="bg-[#0B1F3A] text-white p-6 rounded-2xl shadow-saas border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#0068FF] text-white text-[11px] font-bold tracking-wide inline-flex items-center gap-1.5">
                <ZaloBadgeIcon className="w-4 h-4 bg-white text-[#0068FF]" />
                <span>ZALO MINI APP • ZALO OA INTEGRATION</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#0D9488]/30 text-[#5EEAD4] border border-[#0D9488]/40 text-[11px] font-mono font-bold inline-flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>Đồng bộ thời gian thực</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight flex flex-wrap items-center gap-2.5">
              <span>Cổng Zalo chăm sóc cha mẹ</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-400 text-[#0B1F3A] font-mono font-bold">
                TÍCH VÀNG OA
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Con cái chia thuốc vào khay và chụp ảnh mẫu tham chiếu. Nhận ảnh chụp ngăn thuốc thực tế từ camera giá đỡ của Bác gửi thẳng qua tin nhắn Zalo OA kèm nút duyệt 1 chạm.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSendTestZaloReport}
              className="ui-btn-primary text-xs sm:text-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Gửi thử báo cáo sang Zalo</span>
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'phone' ? 'fullscreen' : 'phone')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/15 transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              {viewMode === 'phone' ? (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span>Mở rộng toàn màn hình</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4" />
                  <span>Xem khung Zalo điện thoại</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Container: Chế độ Xem Điện Thoại Zalo Mini App hoặc Toàn Màn Hình */}
      <div className={`transition-all ${viewMode === 'phone' ? 'max-w-md mx-auto' : 'w-full'}`}>
        <div
          className={`bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas-lg overflow-hidden transition-all ${
            viewMode === 'phone'
              ? 'rounded-[36px] ring-4 ring-slate-200/80 dark:ring-slate-800 p-1.5'
              : 'rounded-2xl'
          }`}
        >
          {/* Top Notch & Status Bar (Chỉ hiện khi ở Phone Mode) */}
          {viewMode === 'phone' && (
            <div className="bg-[#0B1F3A] text-white rounded-t-[28px] px-6 pt-2.5 pb-2 flex items-center justify-between text-xs font-mono font-bold select-none">
              <span>09:41</span>
              <div className="w-20 h-3.5 bg-slate-950 rounded-full flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-slate-800 mr-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span>5G</span>
                <Wifi className="w-3 h-3" />
              </div>
            </div>
          )}

          {/* Header Chuẩn Zalo Mini App */}
          <div className="bg-[#0068FF] text-white px-4 py-3 flex items-center justify-between border-b border-blue-600 select-none">
            <div className="flex items-center gap-2.5">
              <ZaloBadgeIcon className="w-8 h-8 bg-white text-[#0068FF] text-sm shadow-xs" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tracking-tight text-white leading-tight">
                    MediGuard Care
                  </span>
                  <span className="w-3.5 h-3.5 bg-amber-400 rounded-full text-[#0B1F3A] flex items-center justify-center text-[9px] font-bold">
                    ✓
                  </span>
                </div>
                <span className="text-[11px] text-blue-100 font-medium">
                  Zalo Mini App • Con cái quản lý
                </span>
              </div>
            </div>

            {/* Zalo Navigation Pill */}
            <div className="flex items-center bg-blue-800/60 rounded-full px-2.5 py-1 border border-blue-400/30 gap-2.5 text-xs">
              <button
                onClick={() => showToast('Đã mở menu tiện ích Zalo Mini App', 'info')}
                className="hover:opacity-80 font-mono font-bold tracking-widest text-white px-1 cursor-pointer"
              >
                •••
              </button>
              <span className="w-px h-3 bg-blue-400/40" />
              <button
                onClick={() => setViewMode(viewMode === 'phone' ? 'fullscreen' : 'phone')}
                className="hover:opacity-80 font-bold text-white px-1 cursor-pointer"
                title="Chuyển đổi khung nhìn"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mini App Tab Navigation Bar */}
          <div className="bg-white dark:bg-[#0E1E36] border-b border-slate-200 dark:border-slate-800 px-2 py-2 flex items-center justify-around text-xs font-semibold">
            {[
              { id: 'compartments', label: 'Chia thuốc & Mẫu', icon: Pill },
              { id: 'zalo_chat', label: 'Tin nhắn OA', icon: MessageCircle, badge: zaloMessages.length },
              { id: 'dashboard', label: 'Giám sát 3 lớp', icon: Activity },
              { id: 'settings', label: 'Cấu hình OA', icon: Sliders }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all relative cursor-pointer ${
                    isActive
                      ? 'bg-[#0B1F3A] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isActive ? 'bg-[#0D9488] text-white' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Nội Dung Từng Tab */}
          <div className="p-4 space-y-4 min-h-[460px] max-h-[640px] overflow-y-auto bg-slate-50 dark:bg-slate-950/60">
            {/* TAB 1: CHIA THUỐC & CHỤP ẢNH MẪU NGĂN THUỐC */}
            {activeTab === 'compartments' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30 rounded-xl flex items-start gap-2.5 text-xs text-[#0B1F3A] dark:text-slate-200">
                  <Info className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#0F766E] dark:text-[#5EEAD4] block mb-0.5">
                      Quy trình chia thuốc & lưu ảnh mẫu chuẩn:
                    </span>
                    <p className="leading-relaxed">
                      Con cái chia thuốc đúng cữ vào khay và bấm chụp ảnh mẫu tham chiếu. Thiết bị của Bác sẽ tự động đối chiếu theo ảnh này.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {schedules.map((sch, idx) => {
                    const compNum = sch.compartment_number || idx + 1;
                    const hasRefImage = Boolean(sch.reference_image);
                    const refImgUrl = sch.reference_image
                      ? getMediaUrl(`/storage/reference_images/${sch.reference_image}`)
                      : sch.medications?.[0]?.reference_image
                      ? getMediaUrl(`/storage/reference_images/${sch.medications[0].reference_image}`)
                      : null;

                    return (
                      <div
                        key={sch.id}
                        className="bg-white dark:bg-[#0E1E36] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white font-mono font-bold flex items-center justify-center text-xs">
                              #0{compNum}
                            </span>
                            <div>
                              <h4 className="font-display font-bold text-[#0B1F3A] dark:text-white text-sm flex items-center gap-2">
                                <span>Ngăn cữ {sch.time_period}</span>
                                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#0D9488] dark:text-[#2DD4BF] font-mono font-bold tabular-nums">
                                  {sch.target_time}
                                </span>
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {sch.medications?.length || 0} loại thuốc trong ngăn
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
                              hasRefImage || refImgUrl
                                ? 'bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] border border-[#99F6E4] dark:border-[#0D9488]/30'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {hasRefImage || refImgUrl ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Đã có ảnh mẫu</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3 h-3" />
                                <span>Chưa có ảnh</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 text-xs space-y-1">
                          {sch.medications?.map((m) => (
                            <div key={m.id} className="flex items-center justify-between text-[#0B1F3A] dark:text-slate-200 font-medium">
                              <span className="font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                                {m.name}
                              </span>
                              <span className="text-slate-500 font-mono text-[11px]">{m.dosage}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="relative w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 group">
                            {refImgUrl ? (
                              <>
                                <img
                                  src={refImgUrl}
                                  alt={`Ảnh mẫu ngăn ${sch.time_period}`}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => setSelectedPhotoModal(refImgUrl)}
                                />
                                <div
                                  className="absolute inset-0 bg-[#0B1F3A]/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                                  onClick={() => setSelectedPhotoModal(refImgUrl)}
                                >
                                  <Eye className="w-4 h-4" />
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center text-[10px]">
                                <Camera className="w-5 h-5 mb-1" />
                                <span>Chưa có ảnh</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-2">
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                              {refImgUrl
                                ? 'Ảnh mẫu ngăn thuốc đã được lưu. Camera của Bác sẽ dùng mẫu này để đối chiếu.'
                                : 'Bấm nút dưới để chụp hoặc tải ảnh khay thuốc vừa chia.'}
                            </p>
                            <button
                              onClick={() => handleTriggerUpload(sch.id)}
                              disabled={uploadingScheduleId === sch.id}
                              className="w-full ui-btn-subtle text-xs py-2"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>{uploadingScheduleId === sch.id ? 'Đang lưu ảnh...' : 'Chụp / Đổi ảnh mẫu ngăn này'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: HỘP TIN NHẮN ZALO OA */}
            {activeTab === 'zalo_chat' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#0E1E36] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <ZaloBadgeIcon className="w-9 h-9 text-sm" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0B1F3A] dark:text-white flex items-center gap-1.5">
                        <span>MediGuard AI Care</span>
                        <span className="w-3.5 h-3.5 bg-amber-400 text-[#0B1F3A] text-[8px] rounded-full flex items-center justify-center font-bold">
                          ✓
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#0D9488] dark:text-[#2DD4BF] font-semibold">
                        Official Account • Đang kết nối
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSendTestZaloReport}
                    className="ui-btn-subtle text-xs py-1.5 px-3"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi mẫu thử</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {zaloMessages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-medium bg-white dark:bg-[#0E1E36] rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-[#0B1F3A] dark:text-white">Chưa có tin nhắn Zalo OA nào</p>
                      <button
                        onClick={handleSendTestZaloReport}
                        className="mt-3 ui-btn-primary text-xs py-2 px-4"
                      >
                        Gửi tin nhắn báo cáo thử nghiệm
                      </button>
                    </div>
                  ) : (
                    zaloMessages.map((msg) => {
                      const isConfirmed = msg.caregiver_confirmed;
                      const capImgUrl = msg.captured_image_url ? getMediaUrl(msg.captured_image_url) : null;
                      const refImgUrl = msg.reference_image_url ? getMediaUrl(msg.reference_image_url) : null;

                      return (
                        <div key={msg.id} className="flex flex-col items-start gap-1 max-w-full">
                          <span className="text-[10px] text-slate-400 font-mono ml-2">
                            {msg.timestamp || 'Vừa xong'}
                          </span>

                          <div className="w-full bg-white dark:bg-[#0E1E36] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
                                <span className="text-xs font-bold uppercase text-[#0B1F3A] dark:text-white tracking-wider">
                                  Báo cáo cữ {msg.time_period}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#0D9488] tabular-nums">
                                {msg.target_time}
                              </span>
                            </div>

                            <div>
                              <p className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                                {msg.elder_name}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                                <Pill className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                                <span>{Array.isArray(msg.medications) ? msg.medications.join(', ') : msg.medications}</span>
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-[#0D9488]" />
                                <span>Đối chiếu ảnh thực tế & mẫu chuẩn:</span>
                              </span>

                              <div className="grid grid-cols-2 gap-2">
                                <div
                                  className="relative aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer group"
                                  onClick={() => setSelectedPhotoModal(capImgUrl)}
                                >
                                  {capImgUrl ? (
                                    <img
                                      src={capImgUrl}
                                      alt="Ảnh chụp ngăn thuốc giá đỡ"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                                      Không có ảnh
                                    </div>
                                  )}
                                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-[#0B1F3A]/85 text-white text-[10px] rounded font-mono">
                                    Ảnh thực tế
                                  </span>
                                </div>

                                <div
                                  className="relative aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer group"
                                  onClick={() => setSelectedPhotoModal(refImgUrl)}
                                >
                                  {refImgUrl ? (
                                    <img
                                      src={refImgUrl}
                                      alt="Ảnh mẫu con chia"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                                      Ảnh mẫu
                                    </div>
                                  )}
                                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-[#0D9488]/90 text-white text-[10px] rounded font-mono">
                                    Mẫu tham chiếu
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#0F766E] dark:text-[#5EEAD4] flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Độ khớp AI: {Math.round((msg.confidence_score || 0.94) * 100)}%</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">Vision + Voice</span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 italic text-[11px]">
                                “{msg.elder_speech}”
                              </p>
                            </div>

                            <div className="pt-1 flex flex-col sm:flex-row gap-2">
                              {isConfirmed ? (
                                <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                                  <span>Con đã xác nhận an tâm</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleConfirmZaloMessage(msg.id, msg.schedule_id)}
                                  className="flex-1 ui-btn-primary text-xs py-2.5"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                  <span>Xác nhận đã an tâm</span>
                                </button>
                              )}

                              <button
                                onClick={() => setCallingElder(true)}
                                className="ui-btn-secondary text-xs py-2.5 px-3"
                              >
                                <PhoneCall className="w-3.5 h-3.5 text-[#0D9488]" />
                                <span>Gọi Zalo</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: GIÁM SÁT 3 LỚP ĐỘC LẬP */}
            {activeTab === 'dashboard' && (
              <div className="space-y-4">
                <div className="p-4 bg-white dark:bg-[#0E1E36] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Trạng thái tuân thủ 3 lớp hôm nay
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30">
                      <span className="text-[10px] text-slate-500 block">Bác phản hồi</span>
                      <span className="text-lg font-display font-bold text-[#0D9488] tabular-nums">
                        {schedules.filter((s) => s.status?.user_responded).length}/{schedules.length}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Camera khớp</span>
                      <span className="text-lg font-display font-bold text-[#0B1F3A] dark:text-white tabular-nums">
                        {schedules.filter((s) => s.status?.device_recorded).length}/{schedules.length}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[10px] text-slate-500 block">Con xác nhận</span>
                      <span className="text-lg font-display font-bold text-emerald-600 tabular-nums">
                        {schedules.filter((s) => s.status?.caregiver_confirmed).length}/{schedules.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#0B1F3A] dark:text-slate-300 block">
                    Chi tiết từng cữ uống:
                  </span>
                  {schedules.map((sch) => (
                    <div
                      key={sch.id}
                      className="p-3 bg-white dark:bg-[#0E1E36] rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#0B1F3A] dark:text-white">
                          Cữ {sch.time_period} ({sch.target_time})
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {sch.medications?.map((m) => m.name).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                            sch.status?.user_responded
                              ? 'bg-[#0D9488] text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}
                          title="Bác phản hồi"
                        >
                          B1
                        </span>
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                            sch.status?.device_recorded
                              ? 'bg-[#0B1F3A] text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}
                          title="Camera ghi nhận"
                        >
                          B2
                        </span>
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                            sch.status?.caregiver_confirmed
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}
                          title="Gia đình xác nhận"
                        >
                          B3
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: CÀI ĐẶT ZALO OA */}
            {activeTab === 'settings' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-white dark:bg-[#0E1E36] rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                  <h4 className="font-bold text-[#0B1F3A] dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                    <ZaloBadgeIcon />
                    <span>Thông tin tài khoản Zalo OA</span>
                  </h4>

                  <div className="space-y-2 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span>Tên Official Account:</span>
                      <span className="font-bold text-[#0B1F3A] dark:text-white">MediGuard AI Care [Tích Vàng]</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span>Zalo OA ID:</span>
                      <span className="font-mono font-bold">382910482910482</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span>Số điện thoại nhận Zalo:</span>
                      <span className="font-mono font-bold text-[#0D9488]">0987 654 321 (Anh Nam)</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span>Trạng thái Webhook:</span>
                      <span className="text-emerald-600 font-bold">● Đang kết nối tức thời</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#F0FDFA] dark:bg-[#0D9488]/15 rounded-xl border border-[#99F6E4] dark:border-[#0D9488]/30 space-y-2 text-slate-700 dark:text-slate-300">
                  <h5 className="font-bold text-[#0F766E] dark:text-[#5EEAD4] uppercase text-[11px]">
                    Lợi ích tích hợp Zalo Mini App tại Việt Nam:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Người nhà không cần cài thêm ứng dụng riêng, mở Zalo xem ngay.</li>
                    <li>Ảnh chụp ngăn thuốc gửi thẳng vào tin nhắn Zalo kèm nút duyệt 1 chạm.</li>
                    <li>Thông báo chuông Zalo quen thuộc khi đến cữ thuốc của Bác.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar: Tab Icons */}
          <div className="bg-white dark:bg-[#0E1E36] border-t border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-around select-none">
            {[
              { id: 'compartments', label: 'Khay thuốc', icon: Pill },
              { id: 'zalo_chat', label: 'Tin nhắn OA', icon: MessageCircle, dot: zaloMessages.length > 0 },
              { id: 'dashboard', label: 'Giám sát', icon: Activity },
              { id: 'settings', label: 'Cấu hình', icon: Sliders }
            ].map((b) => {
              const Icon = b.icon;
              const active = activeTab === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setActiveTab(b.id)}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all relative cursor-pointer ${
                    active ? 'text-[#0D9488]' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{b.label}</span>
                  {b.dot && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-0 right-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Phóng To Ảnh Ngăn Thuốc */}
      {selectedPhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1F3A]/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedPhotoModal(null)}
        >
          <div
            className="bg-white dark:bg-[#0E1E36] rounded-2xl max-w-xl w-full p-5 border border-slate-200 dark:border-slate-700 shadow-saas-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display font-bold text-[#0B1F3A] dark:text-white text-sm">
                Chi tiết ảnh ngăn thuốc
              </h3>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden max-h-[70vh] bg-slate-950">
              <img
                src={selectedPhotoModal}
                alt="Phóng to ảnh"
                className="w-full h-auto object-contain max-h-[70vh]"
              />
            </div>
            <div className="text-right">
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="ui-btn-primary text-xs py-2 px-5"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Giả Lập Gọi Zalo Cho Bác */}
      {callingElder && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0B1F3A] text-white rounded-3xl max-w-xs w-full p-6 text-center space-y-5 shadow-saas-lg border border-slate-700">
            <div className="relative w-20 h-20 mx-auto rounded-full bg-[#0D9488]/20 p-2 flex items-center justify-center animate-pulse">
              <div className="w-16 h-16 rounded-full bg-[#0D9488] flex items-center justify-center font-display font-bold text-xl text-white">
                Ba
              </div>
            </div>

            <div>
              <h4 className="text-lg font-display font-bold">Bác Nguyễn Văn Ba</h4>
              <p className="text-xs text-[#5EEAD4] font-mono mt-1">Đang kết nối Zalo Call...</p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Thiết bị trên giá đỡ của Bác đang đổ chuông kết nối loa ngoài.
            </p>

            <button
              onClick={() => setCallingElder(false)}
              className="w-12 h-12 mx-auto rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
              aria-label="Kết thúc cuộc gọi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
