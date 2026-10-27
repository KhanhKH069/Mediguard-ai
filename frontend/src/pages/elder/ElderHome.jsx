import React, { useState, useEffect } from 'react';
import {
  Volume2,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Mic,
  Play,
  HeartPulse,
  Search,
  Pill,
  Calendar,
  ArrowUpRight,
  ScanEye,
  RefreshCw
} from 'lucide-react';

import SeniorButton from '../../components/SeniorButton';
import AudioEqualizer from '../../components/AudioEqualizer';
import StatusBadge from '../../components/StatusBadge';
import { playChimeSound } from '../../utils/soundEffects';
import { playVoiceSpeech, unlockAllAudio } from '../../services/voiceService';
import {
  fetchSchedules,
  respondSchedule,
  triggerReminder,
  connectRealtimeUpdates
} from '../../services/api';

export default function ElderHome({
  onOpenVoice,
  onOpenVoiceControl,
  onOpenDrugLookup,
  onOpenSymptomReport,
  onOpenPillScanner,
  currentUser = null,
  elderId = null
}) {
  const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [spokenPrompt, setSpokenPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      const weekday = now.toLocaleDateString('vi-VN', { weekday: 'long' });
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      setCurrentDate(`${weekday}, ngày ${day} tháng ${month}, ${year}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSchedules = async () => {
    try {
      setLoadError('');
      const data = await fetchSchedules(targetElderId);
      const list = Array.isArray(data) ? data : [];
      setSchedules(list);
      if (list.length > 0) {
        const pending = list.find((s) => !s.status?.user_responded);
        setSelectedSchedule((prev) => {
          if (prev) {
            const updatedPrev = list.find((s) => s.id === prev.id);
            if (updatedPrev) return updatedPrev;
          }
          return pending || list[0];
        });
      } else {
        setSelectedSchedule(null);
      }
    } catch (err) {
      console.error('Lỗi tải lịch:', err);
      setLoadError(err.message || 'Chưa tải được sổ lịch uống thuốc.');
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

  const handlePlayReminderSpeech = async (targetSch = null) => {
    const sch = targetSch || selectedSchedule;
    if (!sch) return;

    setIsProcessing(true);
    setIsSpeaking(true);
    try {
      playChimeSound();
      const result = await triggerReminder(sch.id);
      if (result && (result.audio_url || result.speech_text)) {
        setSpokenPrompt(result.speech_text);
        await playVoiceSpeech(result.audio_url, result.speech_text);
      }
    } catch (err) {
      const medNames = sch.medications?.map((m) => m.name).join(', ') || 'thuốc';
      const prompt = `Kính chào Bác! Đã đến giờ dùng thuốc buổi ${sch.time_period.toLowerCase()} rồi ạ. Cữ này của Bác gồm có: ${medNames}. Bác vui lòng mở ngăn thuốc trên khay và uống kèm nước ấm nhé ạ!`;
      setSpokenPrompt(prompt);
      await playVoiceSpeech(null, prompt);
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  const handleStartSession = async () => {
    await unlockAllAudio();
    setIsAudioUnlocked(true);
    if (selectedSchedule) {
      await handlePlayReminderSpeech(selectedSchedule);
    } else {
      playChimeSound();
    }
  };

  const handleConfirmIntake = async (voiceNote = '') => {
    if (!selectedSchedule) return;
    setIsProcessing(true);
    playChimeSound();

    try {
      const data = await respondSchedule(selectedSchedule.id, 'HEARD', voiceNote);
      setStatusMessage('Dạ thưa Bác, cháu đã ghi nhận Bác uống xong thuốc và gửi tin nhắn báo cho các con rồi ạ.');

      if (data && (data.audio_url || data.speech_text)) {
        setIsSpeaking(true);
        setSpokenPrompt(data.speech_text);
        await playVoiceSpeech(data.audio_url, data.speech_text);
      }
      await loadSchedules();
    } catch (err) {
      setStatusMessage('Đã lưu lại thao tác uống thuốc của Bác.');
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  const handleUnsure = async () => {
    if (!selectedSchedule) return;
    setIsProcessing(true);
    playChimeSound();

    try {
      const data = await respondSchedule(selectedSchedule.id, 'UNSURE');
      setStatusMessage('Dạ Bác cứ yên tâm để nguyên khay thuốc ở đó, cháu đã nhắn người nhà kiểm tra giúp Bác rồi ạ.');
      if (data && (data.audio_url || data.speech_text)) {
        setIsSpeaking(true);
        setSpokenPrompt(data.speech_text);
        await playVoiceSpeech(data.audio_url, data.speech_text);
      }
      await loadSchedules();
    } catch (err) {
      setStatusMessage('Đã báo người nhà kiểm tra hỗ trợ Bác.');
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  const handleEmergencyHelp = async () => {
    if (!selectedSchedule) return;
    setIsProcessing(true);
    playChimeSound();

    try {
      const data = await respondSchedule(selectedSchedule.id, 'HELP');
      setStatusMessage('Đã gửi tín hiệu cần giúp đỡ khẩn cấp đến điện thoại của con cháu trong gia đình!');
      if (data && (data.audio_url || data.speech_text)) {
        setIsSpeaking(true);
        setSpokenPrompt(data.speech_text);
        await playVoiceSpeech(data.audio_url, data.speech_text);
      }
      await loadSchedules();
    } catch (err) {
      setStatusMessage('Đã gửi yêu cầu trợ giúp khẩn cấp.');
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. BANNER LỊCH & ĐỒNG HỒ DÀNH CHO NGƯỜI CAO TUỔI */}
      <section className="rounded-3xl bg-[#0B1F3A] text-white p-6 sm:p-8 border border-slate-800 shadow-saas-lg">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          <div className="space-y-2.5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-xs sm:text-sm font-medium text-teal-200">
              <Calendar className="w-4 h-4 text-[#2DD4BF]" />
              <span className="capitalize">{currentDate || 'Đang cập nhật lịch...'}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold tracking-tight text-white leading-tight">
              Kính chào {currentUser?.full_name || 'Bác Ba'}
            </h2>

            <p className="text-slate-300 text-base sm:text-lg font-normal max-w-xl">
              Chúc Bác một ngày bình an, mạnh khỏe. Dưới đây là phiếu thuốc con cháu đã chuẩn bị sẵn cho Bác hôm nay.
            </p>
          </div>

          {/* Đồng hồ chữ số rõ nét */}
          <div className="bg-slate-900/90 px-7 py-5 rounded-2xl border border-teal-500/30 text-center flex flex-col items-center justify-center shrink-0">
            <span className="text-[11px] font-mono uppercase tracking-widest text-teal-300 mb-1">
              Giờ hiện tại
            </span>
            <div className="font-mono font-bold text-5xl sm:text-6xl md:text-7xl text-[#2DD4BF] tracking-tight leading-none">
              {currentTime || '--:--'}
            </div>
          </div>
        </div>

        {/* Thanh bật âm thanh tự động */}
        {!isAudioUnlocked && (
          <div className="mt-6 pt-5 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm sm:text-base text-slate-200 font-medium">
              <Volume2 className="w-6 h-6 text-[#2DD4BF] shrink-0" />
              <span>Bác chạm vào nút bên cạnh để bật loa đọc lời dặn thuốc tự động:</span>
            </div>
            <button
              onClick={handleStartSession}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#0D9488] hover:bg-[#0F766E] text-white font-display font-bold text-base sm:text-lg rounded-xl border border-teal-400/40 shadow-sm transition-all active:translate-y-0.5 flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Bật Loa Nhắc Thuốc</span>
            </button>
          </div>
        )}
      </section>

      {/* BANNER ĐIỀU KHIỂN BẰNG GIỌNG NÓI CHO NGƯỜI CAO TUỔI */}
      {onOpenVoiceControl && (
        <section className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/15 border-2 border-teal-500/30 flex flex-col md:flex-row items-center justify-between gap-5 shadow-sm">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0D9488] text-white flex items-center justify-center shadow-md shrink-0">
              <Mic className="w-7 h-7 stroke-[2.2] animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-display font-bold text-[#0B1F3A] dark:text-white">
                  Bác Có Thể Điều Khiển Bằng Giọng Nói
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-[#0D9488] dark:text-teal-300 font-bold text-xs">
                  Rảnh tay cho người cao tuổi
                </span>
              </div>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1">
                Bác chỉ cần nói: <em>“Tôi đã uống thuốc rồi”</em>, <em>“Đọc lịch thuốc”</em>, <em>“Tra cứu thuốc”</em>, <em>“Chữ to hơn”</em> hoặc <em>“Bác bị chóng mặt”</em>.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenVoiceControl}
            className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#0D9488] to-[#0F766E] hover:from-[#0F766E] hover:to-[#115E59] text-white font-display font-bold text-base sm:text-lg shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2.5 shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Mic className="w-5 h-5 stroke-[2.2]" />
            <span>Bác Nói Ra Lệnh Ngay</span>
          </button>
        </section>
      )}

      {/* 2. PHIẾU DẶN THUỐC CỦA CON */}
      {loading ? (
        <div className="bg-white dark:bg-[#0E1E36] rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500 text-lg font-medium">
          Đang mở sổ lịch uống thuốc của Bác...
        </div>
      ) : selectedSchedule ? (
        <section className="bg-white dark:bg-[#0E1E36] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-saas-md p-6 sm:p-8 md:p-10 space-y-7">
          {schedules.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
                Các cữ thuốc hôm nay:
              </span>
              {schedules.map((sch) => {
                const isSelected = sch.id === selectedSchedule.id;
                const isDone = sch.status?.user_responded;
                return (
                  <button
                    key={sch.id}
                    onClick={() => setSelectedSchedule(sch)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0D9488]'
                    }`}
                  >
                    <span>Buổi {sch.time_period} ({sch.target_time})</span>
                    {isDone && <CheckCircle2 className="w-4 h-4 text-[#2DD4BF]" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Đầu phiếu thuốc */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-dashed border-slate-200 dark:border-slate-800">
            <div className="space-y-2">
              <div className="flex items-center flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono font-semibold uppercase tracking-wider text-[#0D9488] dark:text-[#2DD4BF]">
                  <span>Phiếu thuốc hàng ngày</span>
                  <span>•</span>
                  <span>Ngăn khay số 0{selectedSchedule.compartment_number || 1}</span>
                </div>
                <StatusBadge status={selectedSchedule.status} compact />
              </div>
              <div className="flex items-baseline flex-wrap gap-3">
                <h3 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-[#0B1F3A] dark:text-white">
                  Cữ Buổi {selectedSchedule.time_period}
                </h3>
                <span className="font-mono font-bold text-xl sm:text-2xl text-[#0D9488] dark:text-[#2DD4BF] bg-teal-50 dark:bg-teal-950/60 px-3.5 py-1 rounded-xl border border-teal-200 dark:border-teal-800">
                  Lúc {selectedSchedule.target_time}
                </span>
              </div>
            </div>

            <button
              onClick={() => handlePlayReminderSpeech(selectedSchedule)}
              disabled={isProcessing}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 text-[#0D9488] dark:text-[#2DD4BF] font-display font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 border border-teal-200 dark:border-teal-800 active:translate-y-0.5 transition-all cursor-pointer"
            >
              <Volume2 className="w-5 h-5 stroke-[2.25]" />
              <span>Nghe Lại Lời Dặn</span>
            </button>
          </div>

          {/* Danh sách từng viên thuốc trong ngăn */}
          <div className="space-y-3.5">
            <div className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#0D9488]" />
              <span>Thuốc con đã chia sẵn trong ngăn này ({selectedSchedule.medications?.length || 0} loại):</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedSchedule.medications?.map((m, index) => (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#0B1F3A] text-white font-mono font-bold text-lg flex items-center justify-center shrink-0">
                    0{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h4 className="text-xl sm:text-2xl font-display font-bold text-[#0B1F3A] dark:text-white tracking-tight">
                        {m.name}
                      </h4>
                      <span className="px-3 py-1 rounded-lg bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm sm:text-base text-[#0D9488] dark:text-[#2DD4BF]">
                        {m.dosage}
                      </span>
                    </div>
                    {m.instruction && (
                      <p className="text-sm sm:text-base font-medium text-slate-600 dark:text-slate-300 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        Lời dặn: <strong className="text-[#0B1F3A] dark:text-white">{m.instruction}</strong>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lời nhắc bằng giọng nói đang đọc */}
          {(isSpeaking || spokenPrompt) && (
            <div className="p-5 sm:p-6 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono font-bold text-[#0D9488] dark:text-[#2DD4BF] uppercase tracking-wider">
                  Lời nhắn gửi Bác:
                </span>
                <AudioEqualizer isSpeaking={isSpeaking} />
              </div>
              <p className="text-xl sm:text-2xl font-display font-medium text-[#0B1F3A] dark:text-white leading-relaxed">
                “{spokenPrompt}”
              </p>
            </div>
          )}

          {/* Phản hồi sau khi Bác bấm nút */}
          {statusMessage && (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-[#0D9488] text-emerald-900 dark:text-emerald-200 font-semibold text-lg sm:text-xl text-center">
              {statusMessage}
            </div>
          )}

          {/* 3 Nút Phản Hồi Công Thái Học Lớn */}
          <div className="grid grid-cols-1 gap-3.5 pt-2">
            <SeniorButton
              variant="primary"
              icon={CheckCircle2}
              onClick={() => handleConfirmIntake('Bác bấm nút Đã uống trên màn hình')}
              disabled={isProcessing}
              sublabel="Cháu sẽ lưu vào sổ hôm nay và báo tin sang Zalo cho các con yên tâm"
            >
              Bác Đã Uống Thuốc Xong
            </SeniorButton>

            <SeniorButton
              variant="warning"
              icon={HelpCircle}
              onClick={handleUnsure}
              disabled={isProcessing}
              sublabel="Bác cứ để nguyên khay thuốc ở đó, cháu sẽ nhắn các con kiểm tra lại giúp Bác"
            >
              Bác Chưa Chắc Chắn — Nhờ Con Xem Lại
            </SeniorButton>

            <SeniorButton
              variant="danger"
              icon={AlertTriangle}
              onClick={handleEmergencyHelp}
              disabled={isProcessing}
              sublabel="Gửi thông báo khẩn cấp để người nhà gọi điện hỗ trợ Bác ngay lập tức"
            >
              Bác Cần Người Nhà Giúp Đỡ Ngay
            </SeniorButton>
          </div>
        </section>
      ) : (
        <div className="bg-white dark:bg-[#0E1E36] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 text-center space-y-3">
          <p className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white">
            {loadError ? 'Chưa tải được sổ lịch uống thuốc của Bác' : 'Hôm nay chưa có cữ thuốc nào trong sổ'}
          </p>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {loadError || 'Các con sẽ cập nhật phiếu dặn thuốc hàng ngày cho Bác tại đây.'}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              loadSchedules();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Thử tải lại sổ thuốc</span>
          </button>
        </div>
      )}

      {/* 3. BỐN THẺ TIỆN ÍCH DÀNH CHO BÁC */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={onOpenVoice}
          className="p-6 rounded-2xl bg-white hover:bg-teal-50/40 dark:bg-[#0E1E36] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-saas flex flex-col justify-between gap-5 text-left transition-all active:translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0D9488] px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/60">
              Mục 01
            </span>
            <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#0D9488] flex items-center justify-center group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
              <Mic className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white flex items-center justify-between">
              <span>Trò Chuyện Giọng Nói</span>
              <ArrowUpRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Hỏi cữ thuốc, cách uống hoặc trò chuyện bằng giọng nói tiếng Việt.
            </p>
          </div>
        </button>

        {onOpenPillScanner && (
          <button
            onClick={() => onOpenPillScanner(selectedSchedule)}
            className="p-6 rounded-2xl bg-white hover:bg-teal-50/40 dark:bg-[#0E1E36] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-saas flex flex-col justify-between gap-5 text-left transition-all active:translate-y-0.5 cursor-pointer group"
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0B1F3A] dark:text-teal-300 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
                Mục 02
              </span>
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-teal-300 flex items-center justify-center group-hover:bg-[#0B1F3A] group-hover:text-white transition-colors">
                <ScanEye className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white flex items-center justify-between">
                <span>Soi Kiểm Tra Thuốc</span>
                <ArrowUpRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Đưa khay thuốc lên camera để AI kiểm tra đúng viên thuốc hay chưa.
              </p>
            </div>
          </button>
        )}

        <button
          onClick={onOpenDrugLookup}
          className="p-6 rounded-2xl bg-white hover:bg-teal-50/40 dark:bg-[#0E1E36] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-saas flex flex-col justify-between gap-5 text-left transition-all active:translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0D9488] px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/60">
              Mục 03
            </span>
            <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#0D9488] flex items-center justify-center group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
              <Search className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white flex items-center justify-between">
              <span>Tra Cứu Hộp Thuốc</span>
              <ArrowUpRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Chụp ảnh vỏ hộp thuốc hoặc xem công dụng từng viên thuốc đang dùng.
            </p>
          </div>
        </button>

        <button
          onClick={onOpenSymptomReport}
          className="p-6 rounded-2xl bg-white hover:bg-amber-50/40 dark:bg-[#0E1E36] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-saas flex flex-col justify-between gap-5 text-left transition-all active:translate-y-0.5 cursor-pointer group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60">
              Mục 04
            </span>
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <HeartPulse className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white flex items-center justify-between">
              <span>Báo Triệu Chứng</span>
              <ArrowUpRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Khi thấy mệt, chóng mặt hay đau đầu — báo ngay vào sổ cho con cháu.
            </p>
          </div>
        </button>
      </section>
    </div>
  );
}
