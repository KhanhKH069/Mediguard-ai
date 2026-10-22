import React, { useState, useEffect } from 'react';
import { Volume2, CheckCircle2, HelpCircle, AlertTriangle, Camera, Mic, Play } from 'lucide-react';
import SeniorButton from '../../components/SeniorButton';
import { playChimeSound } from '../../utils/soundEffects';
import { playVoiceSpeech, unlockAllAudio } from '../../services/voiceService';
import { fetchSchedules, respondSchedule, triggerReminder } from '../../services/api';

export default function ElderHome({ onOpenVoice, onOpenScan }) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Bảo vệ giao diện: Tự động giải phóng trạng thái xử lý sau 10 giây nếu có lỗi mạng/âm thanh
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
      setCurrentDate(now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSchedules = async () => {
    try {
      const data = await fetchSchedules();
      setSchedules(data);
      if (data && data.length > 0 && !selectedSchedule) {
        setSelectedSchedule(data[0]);
      }
    } catch (err) {
      console.error('Lỗi tải lịch:', err);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  // Phát lời nhắc giọng đọc AI Agent cho cữ thuốc hiện tại
  const handlePlayReminderSpeech = async (targetSch = null) => {
    const sch = targetSch || selectedSchedule;
    if (!sch) return;

    setIsProcessing(true);
    setIsSpeaking(true);
    try {
      playChimeSound();
      // Gọi API trigger reminder để sinh Edge-TTS và ghi nhật ký reminder_sent
      const result = await triggerReminder(sch.id);
      if (result && (result.audio_url || result.speech_text)) {
        await playVoiceSpeech(result.audio_url, result.speech_text);
      }
    } catch (err) {
      console.warn('Lỗi gọi triggerReminder backend, phát fallback:', err);
      const medNames = sch.medications?.map((m) => m.name).join(', ') || 'thuốc';
      const prompt = `Kính chào Bác! Đã đến giờ dùng thuốc buổi ${sch.time_period.toLowerCase()} rồi ạ. Cữ này gồm có: ${medNames}. Bác vui lòng lấy đúng ngăn thuốc và uống kèm nước ấm nhé!`;
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
      // 1. GỌI API GHI NHẬN & NHẬN GIỌNG ĐỌC TÊN THUỐC
      const result = await respondSchedule(selectedSchedule.id, 'HEARD');

      setStatusMessage(`Đã ghi nhận bác đã uống xong: ${result.medications.join(', ')}`);

      // 2. PHÁT NGAY GIỌNG ĐỌC AI ĐỌC TO TÊN CÁC LOẠI THUỐC ĐÃ UỐNG
      if (result.audio_url || result.speech_text) {
        setIsSpeaking(true);
        await playVoiceSpeech(result.audio_url, result.speech_text);
      }

      await loadSchedules();
    } catch (err) {
      console.error('Lỗi xác nhận:', err);
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  // Nút 2: CHƯA CHẮC CHẮN
  const handleUnsure = async () => {
    if (!selectedSchedule) return;
    setIsProcessing(true);
    playChimeSound();
    try {
      const result = await respondSchedule(selectedSchedule.id, 'UNSURE');
      setStatusMessage('Đã báo cho người nhà kiểm tra lại thuốc giúp bác.');
      if (result.audio_url || result.speech_text) {
        setIsSpeaking(true);
        await playVoiceSpeech(result.audio_url, result.speech_text);
      }
      await loadSchedules();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  // Nút 3: CẦN GIÚP ĐỠ
  const handleNeedHelp = async () => {
    if (!selectedSchedule) return;
    setIsProcessing(true);
    playChimeSound();
    try {
      const result = await respondSchedule(selectedSchedule.id, 'HELP');
      setStatusMessage('Đã phát tín hiệu khẩn cấp đến điện thoại gia đình!');
      if (result.audio_url || result.speech_text) {
        setIsSpeaking(true);
        await playVoiceSpeech(result.audio_url, result.speech_text);
      }
      await loadSchedules();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Nút mở khóa âm thanh nếu chưa tương tác */}
      {!isAudioUnlocked ? (
        <div className="bg-amber-100 border-2 border-amber-400 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between shadow-lg gap-4">
          <div className="flex items-center gap-3">
            <Volume2 className="w-9 h-9 text-amber-700 animate-bounce flex-shrink-0" />
            <div>
              <p className="text-xl md:text-2xl font-black text-amber-950">
                Bác bấm nút bên cạnh để bắt đầu nghe trợ lý nhắc thuốc
              </p>
              <p className="text-sm font-semibold text-amber-800">
                Trợ lý sẽ tự động đọc to tên thuốc và hướng dẫn uống kèm nước ấm
              </p>
            </div>
          </div>
          <button
            onClick={handleStartSession}
            className="w-full md:w-auto px-8 py-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold text-xl rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all flex-shrink-0"
          >
            <Play className="w-6 h-6" /> BẬT ÂM THANH
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-2xl flex items-center justify-between">
          <span className="text-emerald-800 font-bold text-base flex items-center gap-2">
            <Volume2 className={`w-6 h-6 text-emerald-600 ${isSpeaking ? 'animate-bounce' : ''}`} />
            {isSpeaking ? '🔊 Trợ lý AI đang nói...' : 'Hệ thống âm thanh & giọng nói tiếng Việt đang sẵn sàng'}
          </span>
          <button
            onClick={async () => {
              playChimeSound();
              await playVoiceSpeech(null, 'Xin chào bác! Cháu là trợ lý nhắc thuốc MediGuard A I. Chúc bác một ngày thật nhiều sức khỏe!');
            }}
            className="text-sm bg-white hover:bg-emerald-100 text-emerald-800 font-bold px-4 py-2 rounded-xl border border-emerald-300 transition-colors shadow-sm"
          >
            🔊 Nghe thử giọng trợ lý
          </button>
        </div>
      )}

      {/* Header Đồng hồ siêu to */}
      <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 text-center">
        <p className="text-xl md:text-2xl font-medium text-slate-500 capitalize">{currentDate}</p>
        <h1 className="text-6xl md:text-8xl font-black text-blue-700 tracking-tight my-2">
          {currentTime}
        </h1>
        <p className="text-lg md:text-xl text-slate-600 font-semibold">
          Trợ lý MediGuard AI luôn đồng hành cùng bác
        </p>
      </div>

      {/* Thẻ Cữ thuốc hiện tại */}
      {selectedSchedule ? (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-lg border-2 border-blue-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-2">
            <div>
              <span className="text-base font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full">
                Cữ Thuốc Buổi {selectedSchedule.time_period} ({selectedSchedule.target_time})
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 mt-3">
                Danh sách thuốc cần uống:
              </h2>
            </div>
            {selectedSchedule.status?.device_recorded && (
              <span className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 text-lg font-bold px-4 py-2 rounded-2xl self-start md:self-auto">
                <CheckCircle2 className="w-6 h-6" /> Đã ghi nhận
              </span>
            )}
          </div>

          {/* NÚT TO ĐỂ NGHE LẠI LỜI NHẮC CỦA TRỢ LÝ BẤT KỲ LÚC NÀO */}
          <button
            onClick={() => handlePlayReminderSpeech(selectedSchedule)}
            disabled={isProcessing}
            className="w-full mb-6 py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-98 text-white font-black text-xl md:text-2xl rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <Volume2 className="w-8 h-8 animate-pulse" />
            <span>{isSpeaking ? 'TRỢ LÝ ĐANG ĐỌC LỜI NHẮC...' : 'BÁC BẤM VÀO ĐÂY ĐỂ NGHE NHẮC THUỐC'}</span>
          </button>

          {/* Danh sách các loại thuốc với chữ to rõ ràng */}
          <div className="space-y-4 my-6">
            {selectedSchedule.medications.map((med) => (
              <div
                key={med.id}
                className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-start justify-between"
              >
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-800">{med.name}</h3>
                  <p className="text-xl text-blue-700 font-semibold mt-1">
                    Liều lượng: {med.dosage}
                  </p>
                  <p className="text-lg text-slate-600 mt-1">📌 {med.instruction}</p>
                </div>
                <span className="text-3xl">💊</span>
              </div>
            ))}
          </div>

          {/* Thông báo kết quả chữ to */}
          {statusMessage && (
            <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-900 font-bold text-xl md:text-2xl text-center">
              {statusMessage}
            </div>
          )}

          {/* 3 NÚT BẤM LỚN NHẤT MÀN HÌNH */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <SeniorButton
              onClick={handleConfirmIntake}
              disabled={isProcessing}
              variant="primary"
              icon={CheckCircle2}
              className="md:col-span-1"
            >
              ĐÃ NGHE NHẮC
            </SeniorButton>

            <SeniorButton
              onClick={handleUnsure}
              disabled={isProcessing}
              variant="warning"
              icon={HelpCircle}
            >
              CHƯA CHẮC CHẮN
            </SeniorButton>

            <SeniorButton
              onClick={handleNeedHelp}
              disabled={isProcessing}
              variant="danger"
              icon={AlertTriangle}
            >
              CẦN GIÚP
            </SeniorButton>
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-white rounded-3xl text-xl text-slate-500 font-semibold">
          Đang tải dữ liệu lịch thuốc...
        </div>
      )}

      {/* Nút Chức năng phụ: Trò chuyện giọng nói & Soi Camera */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onOpenVoice}
          className="h-20 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xl rounded-3xl flex items-center justify-center gap-3 border-2 border-blue-200 transition-colors shadow-sm"
        >
          <Mic className="w-8 h-8 text-blue-600" />
          <span>NÓI VỚI TRỢ LÝ</span>
        </button>

        <button
          onClick={onOpenScan}
          className="h-20 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xl rounded-3xl flex items-center justify-center gap-3 border-2 border-purple-200 transition-colors shadow-sm"
        >
          <Camera className="w-8 h-8 text-purple-600" />
          <span>SOI VỈ THUỐC (CAMERA)</span>
        </button>
      </div>
    </div>
  );
}
