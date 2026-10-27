import React, { useState, useEffect, useRef } from 'react';
import {
  fetchSchedules,
  respondSchedule,
  triggerReminder,
  connectRealtimeUpdates
} from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';
import { playVoiceSpeech, unlockAllAudio } from '../../services/voiceService';

const SNOOZE_MINUTES = 15;
const SNOOZE_MS = SNOOZE_MINUTES * 60 * 1000;

export default function ElderMedicationTab({
  currentUser,
  elderId = null,
  onOpenVoice,
  onOpenPillScanner,
  onOpenSOS
}) {
  const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [takenInfo, setTakenInfo] = useState(null);
  const [undoCountdown, setUndoCountdown] = useState(10);
  const [isSpeakingGreeting, setIsSpeakingGreeting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [snoozeUntil, setSnoozeUntil] = useState(null);
  const [snoozeRemaining, setSnoozeRemaining] = useState(0);
  const snoozeTimerRef = useRef(null);
  const snoozeIntervalRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  const getTimePeriodText = () => {
    const h = new Date().getHours();
    if (h >= 4 && h < 11) return 'Buổi Sáng';
    if (h >= 11 && h < 14) return 'Buổi Trưa';
    if (h >= 14 && h < 18) return 'Buổi Chiều';
    return 'Buổi Tối';
  };

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Lời chào theo thời gian trong ngày
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = currentUser?.full_name ? currentUser.full_name.split(' ').pop() : 'An';
    if (hour < 11) return `Chào buổi sáng, Bác ${name}!`;
    if (hour < 14) return `Chào buổi trưa, Bác ${name}!`;
    if (hour < 18) return `Chào buổi chiều, Bác ${name}!`;
    return `Chào buổi tối, Bác ${name}!`;
  };

  // Ngày hiện tại định dạng tiếng Việt
  const getCurrentFormattedDate = () => {
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const weekday = days[now.getDay()];
    const day = now.getDate();
    const month = now.getMonth() + 1;
    return `${weekday}, ngày ${day} tháng ${month}`;
  };

  const clearSnoozeTimers = () => {
    if (snoozeTimerRef.current) {
      clearTimeout(snoozeTimerRef.current);
      snoozeTimerRef.current = null;
    }
    if (snoozeIntervalRef.current) {
      clearInterval(snoozeIntervalRef.current);
      snoozeIntervalRef.current = null;
    }
  };

  const cancelSnooze = () => {
    clearSnoozeTimers();
    setSnoozeUntil(null);
    setSnoozeRemaining(0);
  };

  useEffect(() => () => clearSnoozeTimers(), []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const data = await fetchSchedules(targetElderId);
      const list = Array.isArray(data) ? data : [];
      setSchedules(list);
      const pending = list.find((s) => !s.status?.user_responded);
      setSelectedSchedule(pending || list[0] || null);
    } catch (err) {
      console.error('Lỗi tải lịch:', err);
      setErrorMessage('Không tải được lịch uống thuốc. Bác vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
    const disconnect = connectRealtimeUpdates((msg) => {
      if (['schedule_updated', 'caregiver_confirmed'].includes(msg.type)) {
        loadSchedules();
      }
    });
    return () => disconnect();
  }, [targetElderId]);

  // Tự đóng thông báo thành công sau 10 giây
  useEffect(() => {
    if (!takenInfo) return undefined;
    if (undoCountdown <= 0) {
      setTakenInfo(null);
      setUndoCountdown(10);
      return undefined;
    }
    const timer = setTimeout(() => setUndoCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [takenInfo, undoCountdown]);

  const handleSpeakGreeting = async () => {
    await unlockAllAudio();
    setIsSpeakingGreeting(true);
    const greeting = getGreeting();
    const dateText = getCurrentFormattedDate();
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const timeVoice = `${h} giờ ${m > 0 ? `${m} phút` : 'đúng'}`;
    const medSummary = selectedSchedule
      ? `Hôm nay Bác có cữ thuốc ${selectedSchedule.time_period.toLowerCase()} lúc ${selectedSchedule.target_time}. Bác nhớ uống đúng giờ và uống kèm nước ấm nhé!`
      : 'Hôm nay Bác đã hoàn thành các cữ thuốc đúng giờ. Chúc Bác thật nhiều sức khỏe!';
    const fullText = `${greeting} Bây giờ là ${timeVoice}, ${dateText}. ${medSummary}`;

    try {
      await playVoiceSpeech(null, fullText, 'vi-VN-Google');
    } finally {
      setIsSpeakingGreeting(false);
    }
  };

  const handleMarkTaken = async () => {
    if (!selectedSchedule || isSubmitting) return;

    // Mở khóa âm thanh ngay trong thao tác bấm của người dùng
    await unlockAllAudio();
    setIsSubmitting(true);
    setErrorMessage('');
    setNoticeMessage('');

    const scheduleId = selectedSchedule.id;
    const timePeriod = selectedSchedule.time_period;

    try {
      const result = await respondSchedule(scheduleId, 'HEARD', 'Đã uống thuốc');

      cancelSnooze();
      setTakenInfo({ scheduleId, period: timePeriod });
      setUndoCountdown(10);
      playChimeSound();

      const fallbackVoice = `Bác đã uống thuốc cữ ${timePeriod} thành công. Cháu đã gửi thông báo an tâm tới người nhà rồi ạ. Chúc Bác luôn vui khỏe!`;
      playVoiceSpeech(result?.audio_url || null, result?.speech_text || fallbackVoice, 'vi-VN-Google');

      await loadSchedules();
    } catch (err) {
      setErrorMessage(err.message || 'Chưa ghi nhận được việc uống thuốc. Bác vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Không có API hoàn tác: gửi tín hiệu UNSURE để người nhà kiểm tra lại khay thuốc
  const handleReportUnsure = async () => {
    if (!takenInfo || isSubmitting) return;

    await unlockAllAudio();
    setIsSubmitting(true);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      const result = await respondSchedule(takenInfo.scheduleId, 'UNSURE', 'Báo người nhà kiểm tra lại');
      setTakenInfo(null);
      setUndoCountdown(10);

      const fallbackVoice = 'Cháu đã báo cho người nhà kiểm tra lại khay thuốc của Bác rồi ạ.';
      playVoiceSpeech(result?.audio_url || null, result?.speech_text || fallbackVoice, 'vi-VN-Google');
      setNoticeMessage('Đã báo người nhà kiểm tra lại cữ thuốc này.');

      await loadSchedules();
    } catch (err) {
      setErrorMessage(err.message || 'Chưa báo được cho người nhà. Bác vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fireSnoozeReminder = async (scheduleId) => {
    clearSnoozeTimers();
    setSnoozeUntil(null);
    setSnoozeRemaining(0);
    try {
      const result = await triggerReminder(scheduleId);
      await unlockAllAudio();
      playChimeSound();
      playVoiceSpeech(
        result?.audio_url || null,
        result?.speech_text || 'Bác ơi, đã đến giờ nhắc lại cữ thuốc. Bác nhớ uống thuốc kèm nước ấm nhé!',
        'vi-VN-Google'
      );
      setNoticeMessage('Đã phát lại lời nhắc cữ thuốc cho Bác.');
    } catch (err) {
      setErrorMessage('Không phát được lời nhắc lại: ' + (err.message || 'Lỗi kết nối'));
    }
  };

  // Nhắc lại chỉ chạy trên thiết bị này (backend không lưu trạng thái tạm hoãn)
  const handleSnooze = async () => {
    if (!selectedSchedule || isSubmitting || snoozeUntil) return;

    await unlockAllAudio();
    playChimeSound();
    setErrorMessage('');
    setNoticeMessage('');

    const scheduleId = selectedSchedule.id;
    const fireAt = Date.now() + SNOOZE_MS;

    setSnoozeUntil(fireAt);
    setSnoozeRemaining(SNOOZE_MINUTES);

    snoozeTimerRef.current = setTimeout(() => {
      fireSnoozeReminder(scheduleId);
    }, SNOOZE_MS);
    snoozeIntervalRef.current = setInterval(() => {
      setSnoozeRemaining(Math.max(0, Math.ceil((fireAt - Date.now()) / 60000)));
    }, 1000);

    setNoticeMessage(`Đã hẹn nhắc lại sau ${SNOOZE_MINUTES} phút nữa.`);
  };

  const currentMeds = selectedSchedule?.medications || [];
  const hasSchedule = Boolean(selectedSchedule);

  const upcomingList = schedules.filter(
    (s) => s.id !== selectedSchedule?.id && !s.status?.user_responded
  );

  return (
    <div className="flex flex-col w-full pb-8 space-y-5">
      {/* 1. Warm Greeting, Live Clock & Date for Elderly Users */}
      <div className="flex flex-col bg-surface-container-low rounded-2xl p-5 shadow-sm border border-outline-variant/30 gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[32px]">wb_sunny</span>
            <span className="font-headline-md text-headline-md text-on-surface font-bold">
              {getGreeting()}
            </span>
          </div>
          <button
            aria-label="Nghe đọc lời chào, giờ giấc và lịch thuốc"
            className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed active:scale-90 transition-transform shadow-sm cursor-pointer"
            onClick={handleSpeakGreeting}
            type="button"
            title="Bấm để Chị Google đọc giờ và lịch thuốc"
          >
            <span className={`material-symbols-outlined text-[28px] ${isSpeakingGreeting ? 'animate-pulse text-primary' : ''}`}>
              volume_up
            </span>
          </button>
        </div>

        {/* Khung hiển thị Đồng hồ số lớn & Ngày tháng chuẩn cho người cao tuổi */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[28px]">schedule</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-outline font-semibold uppercase tracking-wider">
                Giờ hiện tại
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-3xl sm:text-4xl text-primary tracking-tight leading-none">
                  {currentTime}
                </span>
                <span className="font-label-md text-xs font-bold px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed">
                  {getTimePeriodText()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-on-surface-variant font-medium text-sm sm:text-base border-t sm:border-t-0 sm:border-l border-outline-variant/30 pt-2 sm:pt-0 sm:pl-4">
            <span className="material-symbols-outlined text-outline text-[20px]">calendar_today</span>
            <span>{getCurrentFormattedDate()}</span>
          </div>
        </div>
      </div>

      {/* 2. Big Voice Assistant Trigger Card */}
      <div className="relative overflow-hidden rounded-xl bg-primary text-on-primary p-5 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-[36px] animate-pulse">mic</span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-headline-sm text-headline-sm font-bold text-on-primary leading-tight">
              Bác cần cháu trợ giúp gì?
            </span>
            <span className="font-body-md text-body-md text-primary-fixed-dim mt-0.5">
              Bấm nút bên dưới để nói chuyện cùng Chị Google
            </span>
          </div>
        </div>
        <button
          className="mt-4 w-full h-16 rounded-xl bg-surface-container-lowest text-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-transform cursor-pointer"
          onClick={onOpenVoice}
          type="button"
        >
          <span className="material-symbols-outlined text-[30px] text-primary">record_voice_over</span>
          <span>BẤM VÀO ĐÂY ĐỂ NÓI</span>
        </button>
      </div>

      {/* 3. Priority Alert Card: CẦN UỐNG NGAY */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 bg-surface-container-lowest rounded-xl p-8 shadow-md border border-outline-variant/40">
          <span className="material-symbols-outlined text-primary text-[40px] animate-spin">progress_activity</span>
          <span className="font-body-lg text-body-lg text-on-surface-variant">Đang tải lịch uống thuốc...</span>
        </div>
      ) : takenInfo ? (
        /* Success Banner */
        <div className="flex flex-col items-center justify-center p-6 bg-surface-container-lowest rounded-xl shadow-md text-center border-2 border-primary" id="takenSuccessBanner">
          <div className="w-14 h-14 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center mb-3 shadow-inner">
            <span className="material-symbols-outlined text-[36px] text-primary">task_alt</span>
          </div>
          <span className="font-headline-md text-headline-md font-bold text-primary mb-1">
            Bác đã uống thuốc cữ {takenInfo.period}!
          </span>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-sm mb-4">
            Đã gửi thông báo an tâm tới người nhà của Bác.
          </p>

          {errorMessage && (
            <div role="alert" className="w-full mb-3 rounded-xl bg-error-container text-on-error-container px-4 py-3 text-left font-body-md">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-container-low w-full justify-between">
            <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-left">
              <span className="material-symbols-outlined text-secondary text-[24px]">history</span>
              <span>Lỡ bấm nhầm?<br />Báo người nhà kiểm tra lại</span>
            </div>
            <button
              type="button"
              onClick={handleReportUnsure}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-surface-container-highest text-tertiary font-label-lg font-bold flex items-center gap-1 active:scale-95 transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[20px]">support_agent</span>
              <span>{isSubmitting ? 'ĐANG GỬI...' : `BÁO NGƯỜI NHÀ (${undoCountdown}s)`}</span>
            </button>
          </div>
        </div>
      ) : !hasSchedule ? (
        /* Empty state: không có lịch thuốc */
        <div className="flex flex-col items-center justify-center p-6 bg-surface-container-lowest rounded-xl shadow-md text-center border border-outline-variant/40">
          <div className="w-14 h-14 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[34px]">medication</span>
          </div>
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface mb-1">
            Hôm nay Bác chưa có cữ thuốc nào
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Người nhà chưa tạo lịch uống thuốc cho Bác. Nếu cần hỗ trợ, Bác hãy bấm nút gọi người thân.
          </p>
        </div>
      ) : (
        <div className="flex flex-col bg-surface-container-lowest rounded-xl p-5 shadow-md border border-outline-variant/40" id="urgentMedCard">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-tertiary animate-ping"></span>
              <span className="font-headline-md text-headline-md text-tertiary font-bold tracking-tight">
                CẦN UỐNG NGAY
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-md text-label-md font-semibold">
              <span className="material-symbols-outlined text-[20px]">alarm</span>
              <span>{`${selectedSchedule.target_time} ${selectedSchedule.time_period}`}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-container-high my-2">
            <span className="material-symbols-outlined text-primary text-[28px] shrink-0">info</span>
            <p className="font-body-lg text-body-lg text-on-surface font-semibold leading-snug">
              {selectedSchedule.notes || 'Uống thuốc theo đơn của bác sĩ, uống kèm một cốc nước ấm.'}
            </p>
          </div>

          {/* Danh sách các loại thuốc */}
          <div className="divide-y divide-outline-variant/30">
            {currentMeds.length > 0 ? (
              currentMeds.map((med, idx) => (
                <div key={med.id || idx} className="flex items-center gap-4 py-3.5">
                  <div className={`w-14 h-14 rounded-xl ${idx % 2 === 0 ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-primary-fixed text-on-primary-fixed'} flex items-center justify-center shrink-0`}>
                    <span className="material-symbols-outlined text-[34px]">
                      {idx % 2 === 0 ? 'pill' : 'medication'}
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                      {med.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-surface-container-highest text-on-surface-variant font-label-md text-label-md">
                        {med.dosage || 'Theo đơn'}
                      </span>
                      <span className={`font-body-md text-body-md ${idx % 2 === 0 ? 'text-primary' : 'text-secondary'} font-medium`}>
                        • {med.instruction || 'Thuốc theo đơn bác sĩ'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-3 font-body-md text-body-md text-on-surface-variant">
                Người nhà chưa cập nhật danh sách thuốc cho cữ này.
              </p>
            )}
          </div>

          {errorMessage && (
            <div role="alert" className="mt-3 rounded-xl bg-error-container text-on-error-container px-4 py-3 font-body-md">
              {errorMessage}
            </div>
          )}
          {noticeMessage && (
            <div role="status" className="mt-3 rounded-xl bg-secondary-fixed text-on-secondary-fixed px-4 py-3 font-body-md">
              {noticeMessage}
            </div>
          )}

          {/* Nút to khổng lồ: ĐÃ UỐNG THUỐC RỒI */}
          <button
            className="mt-4 w-full min-h-[64px] rounded-xl bg-primary-container text-on-primary font-headline-sm text-headline-sm font-bold flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            id="confirmTakeMedBtn"
            onClick={handleMarkTaken}
            disabled={isSubmitting}
            type="button"
          >
            <span className="material-symbols-outlined text-[36px]">check_circle</span>
            <span>{isSubmitting ? 'ĐANG GHI NHẬN...' : 'ĐÃ UỐNG THUỐC RỒI'}</span>
          </button>

          {/* Nút hành động phụ: Nhắc lại sau 15 phút & Quét vỉ thuốc */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
            <button
              className="w-full min-h-[56px] rounded-xl bg-surface-container-high text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSnooze}
              disabled={isSubmitting || Boolean(snoozeUntil)}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px] text-outline">snooze</span>
              <span>{snoozeUntil ? `Nhắc lại sau ${snoozeRemaining} phút` : 'Nhắc lại sau 15 phút'}</span>
            </button>

            {onOpenPillScanner && (
              <button
                className="w-full min-h-[56px] rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-lg text-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => onOpenPillScanner(selectedSchedule)}
                disabled={isSubmitting}
                type="button"
              >
                <span className="material-symbols-outlined text-[24px] text-secondary">photo_camera</span>
                <span>Kiểm tra bằng Camera</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Upcoming Schedule Section */}
      <div className="flex flex-col space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="font-headline-md text-headline-md text-on-surface font-bold">
            Cữ thuốc tiếp theo hôm nay
          </span>
          <span className="font-label-md text-label-md text-outline">
            {upcomingList.length > 0 ? `${upcomingList.length} lần còn lại` : 'Đã hết cữ hôm nay'}
          </span>
        </div>

        {upcomingList.length > 0 ? (
          upcomingList.map((sch) => (
            <div key={sch.id} className="flex flex-col bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-3 border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[26px]">
                    {sch.time_period.toLowerCase().includes('tối') ? 'bedtime' : 'sunny'}
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Cữ {sch.time_period} • {sch.target_time}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-md text-label-md">
                  Chưa đến giờ
                </span>
              </div>
              {sch.medications?.length > 0 ? (
                sch.medications.map((m) => (
                  <div key={m.id} className="flex items-center gap-4 pt-1">
                    <div className="w-12 h-12 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[28px]">pill</span>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-label-lg text-label-lg text-on-surface font-bold truncate">
                        {m.name}
                      </span>
                      <span className="font-body-md text-body-md text-on-surface-variant">
                        {m.dosage || 'Theo đơn'} • {m.instruction || sch.notes || 'Uống theo đơn'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Người nhà chưa cập nhật thuốc cho cữ này.
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-3 p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-[32px]">task_alt</span>
            <span className="font-body-lg text-body-lg text-on-surface-variant">
              Bác đã hoàn thành tất cả cữ thuốc hôm nay. Chúc Bác nhiều sức khỏe!
            </span>
          </div>
        )}
      </div>

      {/* 5. Reassuring Family Monitoring Indicator */}
      <div className="flex items-center gap-3.5 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-primary-fixed shrink-0 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[28px]">family_restroom</span>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-label-md text-label-md text-on-surface font-bold">
            Người nhà đang theo dõi cùng Bác
          </span>
          <span className="font-body-md text-body-md text-on-surface-variant truncate">
            Mỗi lần Bác uống thuốc, người nhà đều nhận được thông báo
          </span>
        </div>
      </div>
    </div>
  );
}
