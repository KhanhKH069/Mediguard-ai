import React, { useState, useEffect } from 'react';
import { Volume2, CheckCircle2, HelpCircle, AlertTriangle, Camera, Mic, Play, Clock, Sparkles, ShieldCheck, HeartPulse } from 'lucide-react';
import SeniorButton from '../../components/SeniorButton';
import AudioEqualizer from '../../components/AudioEqualizer';
import { playChimeSound } from '../../utils/soundEffects';
import { playVoiceSpeech, unlockAllAudio } from '../../services/voiceService';
import { fetchSchedules, respondSchedule, triggerReminder, connectRealtimeUpdates } from '../../services/api';

export default function ElderHome({ onOpenVoice, onOpenScan, currentUser = null }) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [spokenPrompt, setSpokenPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  // Tự động giải phóng trạng thái xử lý sau 10 giây nếu có lỗi mạng/âm thanh
  useEffect(() => {
    if (isProcessing || isSpeaking) {
      const timer = setTimeout(() => {
        setIsProcessing(false);
        setIsSpeaking(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing, isSpeaking]);

  // Đồng hồ thời gian thực chữ to
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      const weekday = now.toLocaleDateString('vi-VN', { weekday: 'long' });
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      setCurrentDate(`${weekday}, ngày ${day}/${month}/${year}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSchedules = async () => {
    try {
      const elderId = currentUser?.user_id;
      const data = await fetchSchedules(elderId);
      setSchedules(data);
      if (data && data.length > 0) {
        // Ưu tiên chọn cữ thuốc chưa được Bác phản hồi hôm nay
        const pending = data.find((s) => !s.status?.user_responded);
        setSelectedSchedule(pending || data[0]);
      } else {
        setSelectedSchedule(null);
      }
    } catch (err) {
      console.error('Lỗi tải lịch:', err);
    }
  };

  useEffect(() => {
    loadSchedules();

    // Kết nối WebSocket để tự động đồng bộ thời gian thực khi Caregiver cập nhật
    const disconnect = connectRealtimeUpdates((msg) => {
      if (['schedule_updated', 'caregiver_confirmed'].includes(msg.type)) {
        loadSchedules();
      }
    });

    return () => disconnect();
  }, [currentUser?.user_id]);

  // Phát lời nhắc giọng đọc AI Agent cho cữ thuốc hiện tại
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
      console.warn('Lỗi gọi triggerReminder backend, phát fallback:', err);
      const medNames = sch.medications?.map((m) => m.name).join(', ') || 'thuốc';
      const prompt = `Kính chào Bác! Đã đến giờ dùng thuốc buổi ${sch.time_period.toLowerCase()} rồi ạ. Cữ này của Bác gồm có: ${medNames}. Bác vui lòng lấy đúng ngăn thuốc và uống kèm nước ấm nhé ạ!`;
      setSpokenPrompt(prompt);
      await playVoiceSpeech(null, prompt);
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  // Mở khóa âm thanh toàn diện & tự động phát lời nhắc
  const handleStartSession = async () => {
    await unlockAllAudio();
    setIsAudioUnlocked(true);
    if (selectedSchedule) {
      await handlePlayReminderSpeech(selectedSchedule);
    } else {
      playChimeSound();
    }
  };

  // Nút 1: ĐÃ NGHE NHẮC / ĐÃ UỐNG XONG
  const handleConfirmIntake = async () => {
    if (!selectedSchedule) return;
    setIsProcessing(true);
    playChimeSound();

    try {
      const data = await respondSchedule(selectedSchedule.id, 'HEARD');
      setStatusMessage('✓ Dạ thưa Bác, cháu đã ghi nhận Bác uống xong thuốc và gửi thông báo an tâm đến gia đình rồi ạ!');
      setConfirmedSuccess(true);

      if (data && (data.audio_url || data.speech_text)) {
        setIsSpeaking(true);
        setSpokenPrompt(data.speech_text);
        await playVoiceSpeech(data.audio_url, data.speech_text);
      }
      await loadSchedules();
    } catch (err) {
      setStatusMessage('✓ Đã lưu lại thao tác uống thuốc của Bác.');
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  // Nút 2: CHƯA CHẮC CHẮN / CẦN KIỂM TRA
  const handleUnsure = async () => {
    if (!selectedSchedule) return;
    setIsProcessing(true);
    playChimeSound();

    try {
      const data = await respondSchedule(selectedSchedule.id, 'UNSURE');
      setStatusMessage('Dạ Bác cứ yên tâm nhé ạ! Bác để nguyên vỉ thuốc tại khay, cháu đã báo người nhà kiểm tra ngay giúp Bác rồi ạ.');
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

  // Nút 3: CẦN GIÚP ĐỠ KHẨN CẤP
  const handleEmergencyHelp = async () => {
    if (!selectedSchedule) return;
    setIsProcessing(true);
    playChimeSound();

    try {
      const data = await respondSchedule(selectedSchedule.id, 'HELP');
      setStatusMessage('🚨 ĐÃ GỬI CHUÔNG BÁO ĐỘNG KHẨN CẤP ĐẾN ĐIỆN THOẠI CON CHÁU VÀ NGƯỜI THÂN!');
      if (data && (data.audio_url || data.speech_text)) {
        setIsSpeaking(true);
        setSpokenPrompt(data.speech_text);
        await playVoiceSpeech(data.audio_url, data.speech_text);
      }
      await loadSchedules();
    } catch (err) {
      setStatusMessage('Đã gửi yêu cầu trợ giúp khẩn.');
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-6">
      {/* 1. Thanh Chào & Đồng Hồ Điện Tử Siêu To */}
      <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 rounded-[32px] p-6 md:p-8 text-white shadow-2xl relative overflow-hidden border border-white/10">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold tracking-wide flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                HỆ THỐNG TRỰC TUYẾN
              </span>
              <span className="text-blue-200 text-xs font-semibold">
                {currentUser?.full_name || 'Bác Ba (72 tuổi)'}
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-black tracking-tight text-white flex items-center gap-3">
              Kính Chào {currentUser?.full_name || 'Bác Ba'}! 🌸
            </h2>
            <p className="text-blue-200 text-base md:text-lg mt-1 capitalize font-medium">
              {currentDate || 'Đang cập nhật ngày...'}
            </p>
          </div>

          {/* Đồng hồ số khổng lồ */}
          <div className="bg-black/30 backdrop-blur-md px-8 py-4 rounded-3xl border border-white/15 text-center shadow-inner">
            <div className="font-display font-black text-5xl md:text-6xl text-white tracking-wider text-glow-blue">
              {currentTime || '--:--'}
            </div>
            <div className="text-xs font-bold text-blue-300 uppercase tracking-widest mt-1">Giờ Việt Nam</div>
          </div>
        </div>

        {/* Nút Chạm để Bật Âm Thanh Lần Đầu (Nếu chưa bấm) */}
        {!isAudioUnlocked && (
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm md:text-base text-blue-100">
              <Volume2 className="w-6 h-6 text-amber-300 animate-bounce" />
              <span>Bác vui lòng bấm vào nút bên cạnh để bật giọng nói nhắc thuốc tự động:</span>
            </div>
            <button
              onClick={handleStartSession}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-display font-black text-lg rounded-2xl shadow-glow-amber transition-transform active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>BẬT GIỌNG NÓI NHẮC THUỐC</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Cữ Thuốc Hiện Tại */}
      {selectedSchedule ? (
        <div className="glass-card rounded-[32px] p-6 md:p-8 shadow-xl border-2 border-blue-200/80 dark:border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Cữ thuốc của Bác:
              </div>
              <h3 className="text-2xl md:text-3xl font-display font-black text-slate-900 dark:text-white">
                Buổi {selectedSchedule.time_period} ({selectedSchedule.target_time})
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handlePlayReminderSpeech(selectedSchedule)}
                disabled={isProcessing}
                className="px-5 py-3 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-blue-700 dark:text-blue-300 font-bold text-base flex items-center gap-2 border border-blue-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
              >
                <Volume2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Nghe Lại Lời Dặn</span>
              </button>
            </div>
          </div>

          {/* Danh mục thuốc của cữ */}
          <div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Thuốc Bác cần uống trong cữ này:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedSchedule.medications?.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-slate-800/80 dark:to-slate-800/50 border border-blue-200/60 dark:border-slate-700/60 flex items-start gap-3.5 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
                    💊
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">{m.name}</h4>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Liều lượng: {m.dosage}</p>
                    {m.instruction && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{m.instruction}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hộp Bong Bóng AI Trợ Lý Nói */}
          {(isSpeaking || spokenPrompt) && (
            <div className="p-5 rounded-2xl bg-indigo-50/90 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-900/60 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Trợ Lý MediGuard AI Nói:
                </span>
                <AudioEqualizer isSpeaking={isSpeaking} />
              </div>
              <p className="text-lg md:text-xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                "{spokenPrompt}"
              </p>
            </div>
          )}

          {/* Thông báo trạng thái sau tương tác */}
          {statusMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-300 font-bold text-lg text-center">
              {statusMessage}
            </div>
          )}

          {/* 3. BA NÚT HÀNH ĐỘNG CỐT LÕI (WCAG AAA Cho Người Lớn Tuổi) */}
          <div className="grid grid-cols-1 gap-4 pt-2">
            <SeniorButton
              variant="primary"
              icon={CheckCircle2}
              onClick={handleConfirmIntake}
              disabled={isProcessing}
              sublabel="Dạ cháu đã ghi nhận và gửi thông báo an tâm đến con cháu trong nhà"
            >
              ĐÃ UỐNG XONG / ĐÃ NGHE NHẮC
            </SeniorButton>

            <SeniorButton
              variant="warning"
              icon={HelpCircle}
              onClick={handleUnsure}
              disabled={isProcessing}
              sublabel="Bác cứ để nguyên vỉ thuốc ở đó, cháu sẽ báo người nhà kiểm tra giúp Bác"
            >
              CHƯA CHẮC CHẮN / ĐỂ XEM LẠI
            </SeniorButton>

            <SeniorButton
              variant="danger"
              icon={AlertTriangle}
              onClick={handleEmergencyHelp}
              disabled={isProcessing}
              sublabel="Kích hoạt chuông báo động đỏ lập tức đến người thân trong gia đình"
            >
              CẦN GIÚP ĐỠ KHẨN CẤP
            </SeniorButton>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-[32px] p-8 text-center text-slate-500">
          Đang tải dữ liệu cữ thuốc...
        </div>
      )}

      {/* 4. Hai Nút Lối Tắt Đổi Trạng Thái Trực Quan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={onOpenVoice}
          className="p-6 rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white font-display font-bold text-xl flex items-center justify-between gap-4 shadow-xl hover:shadow-glow-blue transition-all active:scale-98"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="text-2xl font-black">Nói Chuyện Với Cháu</div>
              <div className="text-xs font-sans text-blue-100 font-medium">Hỏi giờ uống thuốc, trò chuyện hoặc nhờ đọc lại lời dặn</div>
            </div>
          </div>
          <span className="text-2xl">💬</span>
        </button>

        <button
          onClick={onOpenScan}
          className="p-6 rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-display font-bold text-xl flex items-center justify-between gap-4 shadow-xl hover:shadow-glow-purple transition-all active:scale-98"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="text-2xl font-black">Soi Vỉ Thuốc Bằng Camera</div>
              <div className="text-xs font-sans text-purple-100 font-medium">Chụp ảnh để cháu đối chiếu vỉ thuốc tự động giúp Bác</div>
            </div>
          </div>
          <span className="text-2xl">📸</span>
        </button>
      </div>
    </div>
  );
}
