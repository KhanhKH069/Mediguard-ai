import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Home,
  Search,
  ScanEye,
  HeartPulse,
  MessageSquare,
  Type,
  Sun,
  Moon,
  Sparkles,
  RotateCcw,
  Radio,
  PhoneCall,
  ChevronRight,
  Info
} from 'lucide-react';
import AudioEqualizer from './AudioEqualizer';
import {
  createSpeechRecognizer,
  playVoiceSpeech,
  stopAllSpeech,
  unlockAllAudio
} from '../services/voiceService';
import {
  parseVoiceCommand,
  COMMAND_TYPES,
  SAMPLE_VOICE_COMMANDS
} from '../services/voiceCommandService';
import {
  fastAIReply,
  fetchSchedules,
  respondSchedule,
  reportSymptom,
  triggerReminder
} from '../services/api';
import { playChimeSound } from '../utils/soundEffects';

export default function ElderVoiceControl({
  isOpen,
  onClose,
  onOpen,
  currentPage = 'home',
  onNavigate,
  fontScale,
  onSetFontScale,
  theme,
  onSetTheme,
  currentUser = null,
  elderId = null,
  activeSchedule = null,
  onRefreshSchedules = null
}) {
  const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastSpokenText, setLastSpokenText] = useState('');
  const [executedAction, setExecutedAction] = useState(null);
  const [aiReply, setAiReply] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [micNotice, setMicNotice] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [symptomAlert, setSymptomAlert] = useState(null);

  const [selectedVoice, setSelectedVoice] = useState('vi-VN-Google');
  const [voiceRate, setVoiceRate] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mediguard_rate') || '+0%';
    }
    return '+0%';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mediguard_voice', 'vi-VN-Google');
    }
  }, [isOpen]);

  const recognizerRef = useRef(null);
  const isExecutingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);

  // Khởi tạo bộ nhận diện Web Speech API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const recognizer = createSpeechRecognizer(
      (text, isFinal) => {
        if (!text) return;
        setTranscript(text);

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (isFinal) {
          handleIncomingSpeech(text.trim());
        } else {
          // Chờ 650ms sau khi Bác ngưng nói thì mới xử lý, không bao giờ ngắt lời giữa chừng
          silenceTimerRef.current = setTimeout(() => {
            if (text && text.trim().length >= 2) {
              handleIncomingSpeech(text.trim());
            }
          }, 650);
        }
      },
      (error) => {
        console.warn('Speech recognition error:', error);
        setIsListening(false);
        if (error === 'not-allowed') {
          setMicNotice('Trình duyệt chưa cho phép dùng micro. Bác hãy bấm chọn các câu lệnh mẫu bên dưới nhé!');
        }
      },
      () => {
        setIsListening(false);
      },
      { continuous: false, interimResults: true, lang: 'vi-VN' }
    );

    recognizerRef.current = recognizer;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognizerRef.current) {
        try {
          recognizerRef.current.abort();
        } catch (e) {}
      }
      stopAllSpeech();
    };
  }, []);

  // Khi modal mở lên, tự động mở khóa âm thanh & bắt đầu nghe
  useEffect(() => {
    if (isOpen) {
      unlockAllAudio();
      setExecutedAction(null);
      setTranscript('');
      setMicNotice('');
      setSymptomAlert(null);
      const timer = setTimeout(() => {
        startListening();
      }, 350);
      return () => clearTimeout(timer);
    } else {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopListening();
      stopAllSpeech();
      setIsSpeaking(false);
    }
  }, [isOpen]);

  const startListening = async () => {
    await unlockAllAudio();
    stopAllSpeech();
    setIsSpeaking(false);
    setMicNotice('');
    setTranscript('');

    if (!recognizerRef.current) {
      setMicNotice('Thiết bị chưa hỗ trợ micro tự động. Bác hãy chạm vào các câu lệnh mẫu bên dưới nhé!');
      return;
    }

    try {
      playChimeSound();
      recognizerRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn('Cannot start recognition:', e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSelectVoice = async (voiceKey) => {
    setSelectedVoice(voiceKey);
    localStorage.setItem('mediguard_voice', voiceKey);
    const sample = voiceKey === 'vi-VN-Google'
      ? 'Dạ xin chào Bác, cháu là Trợ Lý Y Tế Thông Thái. Cháu luôn sẵn sàng giải đáp và theo dõi sức khỏe cho Bác thật chuẩn xác ạ.'
      : voiceKey === 'vi-VN-NamMinhNeural'
      ? 'Dạ thưa Bác, cháu Nam Minh đây ạ. Bác cứ yên tâm có cháu đồng hành, Bác nhớ ăn uống điều độ và giữ gìn sức khỏe nhé.'
      : 'Dạ thưa Bác, cháu Hoài My đây ạ. Cháu lúc nào cũng mong được thủ thỉ, chăm lo từng bữa ăn giấc ngủ cho Bác ạ.';
    setAiReply(sample);
    speakFeedback(sample, null, voiceKey, voiceRate);
  };

  const handleSelectRate = async (rateVal) => {
    setVoiceRate(rateVal);
    localStorage.setItem('mediguard_rate', rateVal);
    const sample = rateVal === '-5%'
      ? 'Dạ thưa Bác, cháu sẽ đọc thật chậm rãi từng chữ cho Bác dễ nghe nhé ạ.'
      : 'Dạ thưa Bác, cháu đang đọc ở tốc độ tự nhiên, rõ ràng rồi ạ.';
    setAiReply(sample);
    speakFeedback(sample, null, selectedVoice, rateVal);
  };

  /**
   * Xử lý câu nói của người dùng sau khi nhận diện
   */
  const handleIncomingSpeech = async (userText) => {
    if (!userText || isExecutingRef.current) return;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    isExecutingRef.current = true;
    stopListening();
    setLastSpokenText(userText);

    try {
      const command = parseVoiceCommand(userText);
      if (!command) {
        setIsProcessing(false);
        isExecutingRef.current = false;
        return;
      }

      // PHẢN HỒI GIAO DIỆN TỨC THÌ (< 5ms): Không bắt người già phải chờ đợi!
      setExecutedAction(command);
      if (command.reply) {
        setAiReply(command.reply);
      }
      setIsProcessing(false);

      await executeCommand(command, userText);
    } catch (err) {
      console.error('Error executing voice command:', err);
      const fallback = 'Dạ cháu đã nghe Bác nói rồi ạ. Bác nói lại giúp cháu một lần nữa nhé!';
      setAiReply(fallback);
      await speakFeedback(fallback);
    } finally {
      setIsProcessing(false);
      isExecutingRef.current = false;

      // Nếu đang bật chế độ nghe liên tục và người dùng không ra lệnh dừng
      if (continuousMode && isOpen) {
        setTimeout(() => {
          if (!isSpeakingRef.current) {
            startListening();
          }
        }, 1500);
      }
    }
  };

  /**
   * Phát âm thanh phản hồi siêu tốc
   */
  const speakFeedback = async (text, audioUrl = null, overrideVoice = null, overrideRate = null) => {
    if (!text || !text.trim()) return;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    try {
      await playVoiceSpeech(
        audioUrl,
        text.trim(),
        overrideVoice || selectedVoice,
        overrideRate || voiceRate
      );
    } catch (e) {
      console.warn('Playback error:', e);
    } finally {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    }
  };

  /**
   * Thực hiện chi tiết từng loại câu lệnh
   */
  const executeCommand = async (command, rawText) => {
    setExecutedAction(command);

    switch (command.type) {
      // 1. DỪNG LẠI / IM LẶNG
      case COMMAND_TYPES.STOP_SPEECH:
        stopAllSpeech();
        setIsSpeaking(false);
        setAiReply('Dạ, cháu đã dừng đọc rồi ạ.');
        break;

      // 2. VỀ TRANG CHỦ
      case COMMAND_TYPES.NAV_HOME:
        if (onNavigate) onNavigate('home');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 3. TRA CỨU THUỐC
      case COMMAND_TYPES.NAV_DRUG_LOOKUP:
        if (onNavigate) onNavigate('drug_lookup');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 4. SOI KIỂM TRA THUỐC
      case COMMAND_TYPES.NAV_PILL_SCANNER:
        if (onNavigate) onNavigate('pill_scanner');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 5. BÁO TRIỆU CHỨNG
      case COMMAND_TYPES.NAV_SYMPTOM_REPORT:
        if (onNavigate) onNavigate('symptom_report');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 6. TRÒ CHUYỆN VOI VOICE DIALOGUE
      case COMMAND_TYPES.NAV_VOICE_CHAT:
        if (onNavigate) onNavigate('voice');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 7. XÁC NHẬN ĐÃ UỐNG THUỐC
      case COMMAND_TYPES.ACTION_CONFIRM_INTAKE: {
        playChimeSound();
        let targetSchId = activeSchedule?.id;
        if (!targetSchId) {
          try {
            const list = await fetchSchedules(targetElderId);
            if (list && list.length > 0) {
              const pending = list.find((s) => !s.status?.user_responded);
              targetSchId = pending ? pending.id : list[0].id;
            }
          } catch (e) {}
        }

        if (targetSchId) {
          try {
            const resp = await respondSchedule(targetSchId, 'HEARD', `Xác nhận bằng giọng nói: "${rawText}"`);
            if (onRefreshSchedules) onRefreshSchedules();
            const replyMsg = resp.speech_text || command.reply;
            setAiReply(replyMsg);
            await speakFeedback(replyMsg, resp.audio_url);
            return;
          } catch (e) {}
        }

        setAiReply(command.reply);
        await speakFeedback(command.speechText);
        break;
      }

      // 8. ĐỌC LỊCH UỐNG THUỐC HÔM NAY
      case COMMAND_TYPES.ACTION_READ_SCHEDULE: {
        playChimeSound();
        let sch = activeSchedule;
        if (!sch) {
          try {
            const list = await fetchSchedules(targetElderId);
            if (list && list.length > 0) {
              sch = list.find((s) => !s.status?.user_responded) || list[0];
            }
          } catch (e) {}
        }

        if (sch && sch.id) {
          try {
            const result = await triggerReminder(sch.id);
            if (result && result.speech_text) {
              setAiReply(result.speech_text);
              await speakFeedback(result.speech_text, result.audio_url);
              return;
            }
          } catch (e) {}

          const medNames = sch.medications?.map((m) => `${m.name} (${m.dosage || ''})`).join(', ') || 'thuốc cữ này';
          const text = `Dạ thưa Bác, cữ buổi ${sch.time_period.toLowerCase()} lúc ${sch.target_time} của Bác gồm có: ${medNames}. Bác nhớ mở khay thuốc số 0${sch.compartment_number || 1} và uống kèm nước ấm nhé ạ!`;
          setAiReply(text);
          await speakFeedback(text);
        } else {
          const fallback = 'Dạ thưa Bác, hôm nay chưa có cữ thuốc nào cần uống thêm trong sổ. Bác yên tâm nghỉ ngơi nhé!';
          setAiReply(fallback);
          await speakFeedback(fallback);
        }
        break;
      }

      // 9. CHƯA CHẮC CHẮN / NHỜ CON XEM
      case COMMAND_TYPES.ACTION_UNSURE: {
        playChimeSound();
        let targetSchId = activeSchedule?.id;
        if (targetSchId) {
          try {
            const resp = await respondSchedule(targetSchId, 'UNSURE', `Bác chưa chắc chắn qua giọng nói: "${rawText}"`);
            if (onRefreshSchedules) onRefreshSchedules();
            const replyMsg = resp.speech_text || command.reply;
            setAiReply(replyMsg);
            await speakFeedback(replyMsg, resp.audio_url);
            return;
          } catch (e) {}
        }
        setAiReply(command.reply);
        await speakFeedback(command.speechText);
        break;
      }

      // 10. BÁO ĐỘNG KHẨN CẤP / CỨU TÔI
      case COMMAND_TYPES.ACTION_EMERGENCY: {
        playChimeSound();
        if (targetElderId) {
          try {
            await reportSymptom(targetElderId, 'YÊU CẦU CỨU HỘ KHẨN CẤP', 'Khẩn cấp', `Bác kêu cứu qua giọng nói: "${rawText}"`, 'Hệ thống đã phát báo động đỏ tới điện thoại con cháu.');
          } catch (e) {}
        }
        setAiReply(command.reply);
        await speakFeedback(command.speechText);
        break;
      }

      // 11. BÁO TRIỆU CHỨNG CỤ THỂ
      case COMMAND_TYPES.ACTION_REPORT_SYMPTOM: {
        playChimeSound();
        if (targetElderId) {
          try {
            const res = await reportSymptom(
              targetElderId,
              command.symptomName,
              command.severity,
              `Ghi nhận giọng nói: "${rawText}"`,
              'AI đã phát thông báo tới điện thoại người nhà.'
            );
            setSymptomAlert({
              name: command.symptomName,
              severity: command.severity,
              time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            });
          } catch (e) {
            console.warn('Lỗi ghi nhận triệu chứng:', e);
          }
        }
        setAiReply(command.reply);
        await speakFeedback(command.speechText);
        break;
      }

      // 12. PHÓNG TO CHỮ
      case COMMAND_TYPES.SETTING_FONT_LARGE:
        if (onSetFontScale) onSetFontScale('large');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 13. CHỮ CHUẨN
      case COMMAND_TYPES.SETTING_FONT_NORMAL:
        if (onSetFontScale) onSetFontScale('normal');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 14. CHẾ ĐỘ TỐI
      case COMMAND_TYPES.SETTING_THEME_DARK:
        if (onSetTheme) onSetTheme('dark');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 15. CHẾ ĐỘ SÁNG
      case COMMAND_TYPES.SETTING_THEME_LIGHT:
        if (onSetTheme) onSetTheme('light');
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 16. HƯỚNG DẪN CÂU LỆNH
      case COMMAND_TYPES.HELP_COMMANDS:
        setShowHelpModal(true);
        setAiReply(command.reply);
        playChimeSound();
        await speakFeedback(command.speechText);
        break;

      // 17. TRÒ CHUYỆN / HỎI ĐÁP AI FALLBACK
      case COMMAND_TYPES.AI_CHAT_FALLBACK:
      default: {
        try {
          const data = await fastAIReply(targetElderId, rawText, selectedVoice, voiceRate);
          if (data && data.reply) {
            setAiReply(data.reply);
            if (data.symptom_detected) {
              setSymptomAlert({
                name: data.symptom_name || 'Triệu chứng bất thường',
                severity: 'Khẩn cấp',
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
              });
            }
            await speakFeedback(data.reply, data.audio_url);
            return;
          }
        } catch (e) {
          console.warn('Lỗi gọi fastAIReply:', e);
        }

        const fallbackMsg = 'Dạ cháu đã lắng nghe Bác rồi ạ. Bác nhớ uống đủ nước ấm và giữ gìn sức khỏe nhé!';
        setAiReply(fallbackMsg);
        await speakFeedback(fallbackMsg);
        break;
      }
    }
  };

  /**
   * Bác chạm trực tiếp vào câu lệnh mẫu
   */
  const handleSelectSample = (sampleText) => {
    setTranscript(sampleText);
    handleIncomingSpeech(sampleText);
  };

  const handleStopSpeakingNow = () => {
    stopAllSpeech();
    setIsSpeaking(false);
  };

  return (
    <>
      {/* =========================================================================
          1. NÚT MICRO NỔI ĐIỀU KHIỂN GIỌNG NÓI (ALWAYS VISIBLE FLOATING ACTION BUTTON)
         ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        <button
          id="elder-voice-fab-btn"
          onClick={() => {
            if (isOpen) {
              onClose();
            } else {
              onOpen();
            }
          }}
          className={`group flex items-center gap-3.5 px-5 py-4 rounded-full shadow-2xl transition-all duration-300 transform active:scale-95 cursor-pointer border-2 ${
            isOpen
              ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-300 shadow-rose-500/40'
              : 'bg-gradient-to-r from-[#0D9488] to-[#0F766E] hover:from-[#0F766E] hover:to-[#115E59] text-white border-teal-300/40 shadow-teal-500/30 hover:shadow-teal-500/50'
          }`}
          title="Điều khiển ứng dụng bằng giọng nói tiếng Việt"
          aria-label="Điều khiển ứng dụng bằng giọng nói"
        >
          {/* Animated ripple circle */}
          <span className="relative flex h-7 w-7 items-center justify-center">
            {isListening ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <Mic className="w-6 h-6 text-white relative z-10 animate-bounce" />
              </>
            ) : isOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <>
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-teal-300 opacity-40" />
                <Mic className="w-6 h-6 text-white relative z-10" />
              </>
            )}
          </span>

          <div className="text-left hidden sm:block">
            <div className="text-base font-display font-bold leading-tight">
              {isOpen ? 'Đóng Trợ Lý' : 'Bác Nói Đi'}
            </div>
            <div className="text-[11px] font-medium text-teal-100 opacity-90 leading-tight">
              {isOpen ? 'Chạm để thu nhỏ' : 'Điều khiển bằng giọng nói'}
            </div>
          </div>
        </button>
      </div>

      {/* =========================================================================
          2. TRUNG TÂM ĐIỀU KHIỂN GIỌNG NÓI DÀNH CHO NGƯỜI CAO TUỔI (VOICE MODAL / DRAWER)
         ========================================================================= */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#0E1E36] w-full max-w-2xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header trung tâm */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-[#0B1F3A] to-[#1E3A5F] text-white flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#0D9488] text-white flex items-center justify-center shadow-md">
                  <Mic className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight">
                      Điều Khiển Bằng Giọng Nói
                    </h2>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-400/20 text-teal-200 border border-teal-300/30">
                      Tiếng Việt
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Bác hãy chạm vào micro và nói to, rõ ràng câu lệnh
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHelpModal(!showHelpModal)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-200 transition-colors cursor-pointer"
                  title="Xem danh sách các câu lệnh có thể nói"
                >
                  <Info className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Đóng trợ lý giọng nói"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Thanh hiển thị giọng đọc Chị Google & Tốc độ đọc */}
            <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">Trợ lý:</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-[#0E1E36] text-[#0D9488] font-bold text-xs border border-teal-200 dark:border-teal-800 shadow-xs">
                  <span>🩺</span>
                  <span>Chị Google (Quen thuộc, rõ ràng)</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Tốc độ:</span>
                <button
                  onClick={() => handleSelectRate('+0%')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    voiceRate === '+0%'
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'bg-white/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  title="Tốc độ tự nhiên"
                >
                  ⚡ Chuẩn (+0%)
                </button>
                <button
                  onClick={() => handleSelectRate('-5%')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    voiceRate === '-5%'
                      ? 'bg-[#0D9488] text-white shadow-xs'
                      : 'bg-white/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  title="Đọc chậm rãi từng chữ"
                >
                  🐢 Chậm rãi (-5%)
                </button>
              </div>
            </div>

            {/* Nội dung điều khiển chính */}
            <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
              {/* Cảnh báo micro nếu có */}
              {micNotice && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm sm:text-base font-semibold">{micNotice}</p>
                </div>
              )}

              {/* Cảnh báo sức khỏe nếu vừa phát hiện triệu chứng */}
              {symptomAlert && (
                <div className="p-4 sm:p-5 rounded-2xl bg-red-50 dark:bg-red-950/60 border-2 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <HeartPulse className="w-8 h-8 text-red-600 shrink-0 animate-pulse" />
                    <div>
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-300">
                        Đã báo động triệu chứng y tế
                      </div>
                      <div className="text-lg sm:text-xl font-display font-bold">
                        “{symptomAlert.name}” ({symptomAlert.time})
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-600 text-white shrink-0">
                    Đã báo con cháu
                  </span>
                </div>
              )}



              {/* VÙNG TƯƠNG TÁC MICRO LỚN Ở GIỮA */}
              <div className="flex flex-col items-center justify-center text-center py-4 space-y-4">
                <div className="relative">
                  {/* Glowing pulse rings */}
                  {isListening && (
                    <div className="absolute -inset-4 rounded-full bg-teal-400/30 dark:bg-teal-500/20 animate-ping" />
                  )}
                  {isSpeaking && (
                    <div className="absolute -inset-4 rounded-full bg-sky-400/30 dark:bg-sky-500/20 animate-pulse" />
                  )}

                  <button
                    id="elder-voice-listen-toggle"
                    onClick={toggleListening}
                    disabled={isProcessing}
                    className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer border-4 ${
                      isListening
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-300 scale-105'
                        : isSpeaking
                        ? 'bg-sky-600 hover:bg-sky-700 text-white border-sky-300'
                        : 'bg-gradient-to-br from-[#0D9488] to-[#0F766E] hover:from-[#0F766E] hover:to-[#115E59] text-white border-teal-200'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <Mic className="w-12 h-12 animate-bounce stroke-[2.2]" />
                        <span className="text-xs font-bold uppercase mt-1">Đang nghe</span>
                      </>
                    ) : isSpeaking ? (
                      <>
                        <Volume2 className="w-12 h-12 stroke-[2.2] animate-pulse" />
                        <span className="text-xs font-bold uppercase mt-1">Đang nói</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-12 h-12 stroke-[2.2]" />
                        <span className="text-xs font-bold uppercase mt-1">Chạm để nói</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Trạng thái hiện thời */}
                <div className="space-y-1">
                  {isListening ? (
                    <div className="flex items-center justify-center gap-2 text-teal-600 dark:text-teal-300 font-bold text-lg">
                      <AudioEqualizer isSpeaking={true} />
                      <span>Cháu đang lắng nghe Bác nói...</span>
                    </div>
                  ) : isProcessing ? (
                    <p className="text-amber-600 dark:text-amber-400 font-bold text-lg animate-pulse">
                      Đang nhận diện câu nói của Bác...
                    </p>
                  ) : isSpeaking ? (
                    <div className="flex items-center justify-center gap-2 text-sky-600 dark:text-sky-300 font-bold text-lg">
                      <AudioEqualizer isSpeaking={true} />
                      <span>Cháu đang đọc phản hồi cho Bác...</span>
                    </div>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-300 font-medium text-base">
                      Chạm vào chiếc micro tròn ở trên và nói câu lệnh
                    </p>
                  )}
                </div>
              </div>

              {/* HIỂN THỊ CÂU BÁC VỪA NÓI */}
              {(transcript || lastSpokenText) && (
                <div className="p-5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-[#0D9488] dark:text-[#2DD4BF]">
                    <span>Bác vừa nói:</span>
                    {isListening && <span className="animate-pulse">Đang ghi nhận...</span>}
                  </div>
                  <p className="text-2xl sm:text-3xl font-display font-bold text-[#0B1F3A] dark:text-white leading-relaxed">
                    “{transcript || lastSpokenText}”
                  </p>
                </div>
              )}

              {/* KẾT QUẢ THỰC HIỆN CÂU LỆNH & CÂU PHẢN HỒI CỦA AI */}
              {(executedAction || aiReply) && (
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-3">
                  {executedAction && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{executedAction.actionName || executedAction.title}</span>
                    </div>
                  )}

                  {aiReply && (
                    <div className="space-y-2">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Lời nhắn gửi Bác:
                      </div>
                      <p className="text-xl sm:text-2xl font-display font-medium text-[#0B1F3A] dark:text-white leading-relaxed">
                        {aiReply}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center gap-2.5">
                    {isSpeaking ? (
                      <button
                        onClick={handleStopSpeakingNow}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-sm transition-all cursor-pointer"
                      >
                        <VolumeX className="w-4 h-4" />
                        <span>Dừng đọc</span>
                      </button>
                    ) : (
                      aiReply && (
                        <button
                          onClick={() => speakFeedback(aiReply)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-sm transition-all cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Nghe lại</span>
                        </button>
                      )
                    )}

                    <button
                      onClick={startListening}
                      disabled={isListening}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 text-white font-bold text-sm transition-all cursor-pointer ml-auto"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Nói câu lệnh khác</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BẢNG CÂU LỆNH MẪU DỄ CHẠM (SAMPLE COMMANDS) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Bác có thể nói (hoặc chạm nhanh):
                  </h3>
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className="text-xs text-[#0D9488] hover:underline font-semibold cursor-pointer"
                  >
                    Xem tất cả lệnh
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SAMPLE_VOICE_COMMANDS.slice(0, 6).map((cmd, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSample(cmd.text)}
                      className="p-3.5 rounded-xl bg-slate-50 hover:bg-teal-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cmd.icon}</span>
                        <div>
                          <div className="font-display font-bold text-base text-[#0B1F3A] dark:text-white group-hover:text-[#0D9488] transition-colors">
                            “{cmd.text}”
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {cmd.desc}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0D9488] group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer chân trang */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={continuousMode}
                  onChange={(e) => setContinuousMode(e.target.checked)}
                  className="w-4 h-4 text-[#0D9488] rounded focus:ring-teal-500"
                />
                <span>Tự động lắng nghe câu tiếp theo (Rảnh tay)</span>
              </label>

              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-sm transition-colors cursor-pointer"
              >
                Đóng Trợ Lý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. BẢNG HƯỚNG DẪN CHI TIẾT TẤT CẢ CÂU LỆNH (FULL HELP SHEET)
         ========================================================================= */}
      {showHelpModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0E1E36] w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#0D9488] flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-[#0B1F3A] dark:text-white">
                    Sổ Tay Câu Lệnh Giọng Nói
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bác có thể nói bằng giọng nói tự nhiên hàng ngày
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0D9488]">
                  1. Chuyển màn hình & Tra cứu
                </h4>
                <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <p>• <strong>“Về trang chủ”</strong> hoặc <strong>“Màn hình chính”</strong>: Xem phiếu thuốc hôm nay</p>
                  <p>• <strong>“Tra cứu thuốc”</strong> hoặc <strong>“Tìm hộp thuốc”</strong>: Xem công dụng và liều dùng</p>
                  <p>• <strong>“Soi kiểm tra thuốc”</strong> hoặc <strong>“Quét thuốc”</strong>: Mở camera đối chiếu viên thuốc</p>
                  <p>• <strong>“Báo triệu chứng”</strong>: Mở sổ ghi nhận sức khỏe</p>
                  <p>• <strong>“Trò chuyện cùng cháu”</strong>: Mở đối thoại y tế với AI</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  2. Thao tác uống thuốc & Lịch nhắc
                </h4>
                <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <p>• <strong>“Tôi đã uống thuốc rồi”</strong>: Xác nhận uống xong cữ này và báo con</p>
                  <p>• <strong>“Đọc lịch uống thuốc”</strong>: Nghe lại tên các viên thuốc cần uống</p>
                  <p>• <strong>“Bác chưa chắc chắn”</strong>: Nhờ con cháu kiểm tra lại khay thuốc</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  3. Báo triệu chứng sức khỏe trực tiếp
                </h4>
                <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <p>• <strong>“Bác bị chóng mặt”</strong>, <strong>“Tôi thấy đau đầu”</strong></p>
                  <p>• <strong>“Bác thấy buồn nôn”</strong>, <strong>“Đau tức ngực”</strong>, <strong>“Khó thở”</strong></p>
                  <p>• <strong>“Cứu tôi, khẩn cấp”</strong>: Gửi tín hiệu báo động đỏ tới điện thoại con cháu</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  4. Tiện ích & Hiển thị
                </h4>
                <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <p>• <strong>“Chữ to hơn”</strong> / <strong>“Chữ vừa”</strong>: Điều chỉnh cỡ chữ</p>
                  <p>• <strong>“Bật chế độ tối”</strong> / <strong>“Bật chế độ sáng”</strong>: Đổi giao diện</p>
                  <p>• <strong>“Dừng lại”</strong> hoặc <strong>“Im lặng”</strong>: Tắt tiếng giọng đọc</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-3 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-base transition-colors cursor-pointer"
            >
              Dạ, Bác Đã Hiểu Rồi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
