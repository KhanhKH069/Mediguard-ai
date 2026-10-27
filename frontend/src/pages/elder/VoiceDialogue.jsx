import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  ArrowLeft,
  Volume2,
  VolumeX,
  RotateCcw,
  HeartPulse,
  MessageSquareQuote,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { createSpeechRecognizer, playVoiceSpeech, stopAllSpeech, unlockAllAudio } from '../../services/voiceService';
import { fastAIReply } from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';
import AudioEqualizer from '../../components/AudioEqualizer';

const GOOGLE_VOICE = 'vi-VN-Google';
const INITIAL_GREETING = 'Dạ thưa Bác, cháu là Chị Google - trợ lý y tế của Bác đây ạ. Bác chạm vào chiếc micro bên dưới hoặc chọn câu hỏi mẫu để trò chuyện cùng cháu nhé.';

export default function VoiceDialogue({ onBack, currentUser, elderId = null }) {
  const [voiceRate, setVoiceRate] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mediguard_rate') || '+0%';
    }
    return '+0%';
  });

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState(INITIAL_GREETING);
  const [lastAudioUrl, setLastAudioUrl] = useState(null);
  const [groundingUsed, setGroundingUsed] = useState(false);
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [symptomAlertInfo, setSymptomAlertInfo] = useState(null);
  const [micNotice, setMicNotice] = useState('');

  const isExecutingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const recognizerRef = useRef(null);
  const voiceRateRef = useRef(voiceRate);
  voiceRateRef.current = voiceRate;

  useEffect(() => {
    unlockAllAudio();

    if (typeof window !== 'undefined') {
      localStorage.setItem('mediguard_voice', GOOGLE_VOICE);
    }

    const rec = createSpeechRecognizer(
      (text, isFinal) => {
        if (!text || isExecutingRef.current) return;
        setTranscript(text);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (isFinal) {
          handleSpeechProcessing(text.trim());
        } else {
          silenceTimerRef.current = setTimeout(() => {
            if (text && text.trim().length >= 2 && !isExecutingRef.current) {
              handleSpeechProcessing(text.trim());
            }
          }, 650);
        }
      },
      (err) => {
        console.warn('Lỗi nhận diện:', err);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
    recognizerRef.current = rec;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopAllSpeech();
      if (rec) {
        try {
          rec.abort();
        } catch (e) {}
      }
    };
  }, []);

  const stopListening = () => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const startListening = async () => {
    await unlockAllAudio();
    stopAllSpeech();
    setMicNotice('');
    if (!recognizerRef.current) {
      setMicNotice('Trình duyệt chưa cấp quyền micro. Bác có thể chạm vào các câu mẫu bên dưới để trò chuyện với cháu nhé!');
      return;
    }
    setTranscript('');
    setSymptomAlertInfo(null);
    setGroundingUsed(false);
    setSources([]);
    playChimeSound();
    try {
      recognizerRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn('Lỗi bật micro:', e);
      setIsListening(false);
    }
  };

  const toggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleRateChange = async (rate) => {
    setVoiceRate(rate);
    voiceRateRef.current = rate;
    localStorage.setItem('mediguard_rate', rate);
    const sampleText = rate === '-5%'
      ? 'Dạ thưa Bác, cháu sẽ đọc thật chậm rãi từng chữ để Bác nghe rõ nhất nhé ạ.'
      : 'Dạ thưa Bác, cháu đang đọc ở tốc độ tự nhiên, rõ ràng rồi ạ.';
    setReply(sampleText);
    setLastAudioUrl(null);
    setIsPlayingVoice(true);
    try {
      await playVoiceSpeech(null, sampleText, GOOGLE_VOICE, rate);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  const handleSpeechProcessing = async (userText) => {
    if (!userText || !userText.trim() || isExecutingRef.current) return;
    isExecutingRef.current = true;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // Tắt micro ngay lập tức để không bị tiếng loa thu ngược vào micro
    stopListening();
    stopAllSpeech();

    setIsLoading(true);
    setSymptomAlertInfo(null);
    const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);

    try {
      const data = await fastAIReply(
        targetElderId,
        userText.trim(),
        GOOGLE_VOICE,
        voiceRateRef.current
      );

      if (data && data.reply) {
        setReply(data.reply);
        setLastAudioUrl(data.audio_url || null);
        setGroundingUsed(Boolean(data.grounding_used));
        setSources(Array.isArray(data.sources) ? data.sources : []);

        if (data.symptom_detected) {
          setSymptomAlertInfo({
            name: data.symptom_name,
            date: data.reported_date,
            time: data.reported_time
          });
          playChimeSound();
        }

        setIsPlayingVoice(true);
        setIsLoading(false);
        await playVoiceSpeech(
          data.audio_url,
          data.reply,
          GOOGLE_VOICE,
          voiceRateRef.current
        );
      } else {
        throw new Error('Không nhận được câu trả lời');
      }
    } catch (err) {
      console.warn('Lỗi xử lý giọng nói:', err);
      const lower = userText.toLowerCase().trim();
      let fallback = 'Dạ cháu đã ghi nhận thông tin của Bác rồi ạ. Bác nhớ uống đủ nước ấm và nghỉ ngơi nhé.';
      if (lower.includes('uống rồi') || lower.includes('uống xong') || lower.includes('đã uống')) {
        fallback = 'Dạ cháu đã ghi nhận Bác vừa uống thuốc xong rồi ạ. Cháu đã lưu vào sổ và báo cho gia đình rồi.';
      } else if (lower.includes('chóng mặt') || lower.includes('đau đầu') || lower.includes('buồn nôn') || lower.includes('mệt')) {
        fallback = 'Dạ thưa Bác, cháu đã lưu triệu chứng vào sổ theo dõi hôm nay và báo ngay cho con cháu rồi ạ. Bác ngồi nghỉ ngơi tại chỗ nhé.';
        setSymptomAlertInfo({ name: 'Triệu chứng mệt mỏi', date: new Date().toLocaleDateString('vi-VN'), time: 'Vừa xong' });
      }

      setReply(fallback);
      setIsPlayingVoice(true);
      await playVoiceSpeech(null, fallback, GOOGLE_VOICE, voiceRateRef.current);
    } finally {
      setIsLoading(false);
      setIsPlayingVoice(false);
      isExecutingRef.current = false;
    }
  };

  const handleReplayCurrent = async () => {
    if (!reply || isLoading) return;
    setIsPlayingVoice(true);
    try {
      await playVoiceSpeech(lastAudioUrl, reply, GOOGLE_VOICE, voiceRateRef.current);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  const handleStopSpeakingNow = () => {
    stopAllSpeech();
    setIsPlayingVoice(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      {/* Nút quay lại & Tốc độ đọc */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2.5 text-base font-bold text-[#0B1F3A] dark:text-white bg-white dark:bg-[#0E1E36] hover:bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-saas transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#0D9488]" />
          <span>Quay lại trang chính</span>
        </button>

        {/* Nút chỉnh tốc độ đọc của Chị Google */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#0E1E36] p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-saas">
          <button
            onClick={() => handleRateChange('+0%')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              voiceRate === '+0%'
                ? 'bg-[#0D9488] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            ⚡ Tự nhiên (+0%)
          </button>
          <button
            onClick={() => handleRateChange('-5%')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              voiceRate === '-5%'
                ? 'bg-[#0D9488] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            🐢 Đọc chậm rãi (-5%)
          </button>
        </div>
      </div>

      {/* Tiêu đề trang */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-[#0D9488] px-3.5 py-1 rounded-md bg-[#F0FDFA] dark:bg-[#0D9488]/20 border border-[#99F6E4]/40">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Trợ Lý Sức Khỏe Giọng Nói Tiếng Việt • Chị Google</span>
        </span>
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-[#0B1F3A] dark:text-white">
          Trò Chuyện Cùng Cháu
        </h2>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
          Cháu dùng một giọng đọc Chị Google quen thuộc, rõ ràng, luôn túc trực lắng nghe và chăm lo sức khỏe cho Bác.
        </p>
      </div>

      {micNotice && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-3 text-base font-semibold">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{micNotice}</span>
        </div>
      )}

      {/* Cảnh báo nếu vừa phát hiện triệu chứng */}
      {symptomAlertInfo && (
        <div className="w-full p-5 rounded-2xl bg-red-50 dark:bg-red-950/50 border-2 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <HeartPulse className="w-8 h-8 text-red-600 shrink-0" />
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider">
                Đã ghi vào sổ triệu chứng ngày {symptomAlertInfo.date}
              </div>
              <div className="text-lg sm:text-xl font-display font-bold">
                Đã báo tin cho con cháu: “{symptomAlertInfo.name}”
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-white/70 dark:bg-black/30 shrink-0">
            {symptomAlertInfo.time}
          </span>
        </div>
      )}

      {/* Khu vực Micro vật lý + Phản hồi */}
      <div className="bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas-md rounded-3xl p-6 sm:p-10 flex flex-col items-center gap-6">
        <div className="relative">
          {isListening && (
            <div className="absolute -inset-3 rounded-full border-4 border-red-500/40 animate-ping pointer-events-none" />
          )}
          <button
            onClick={toggleListen}
            disabled={isLoading}
            className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center transition-all transform active:translate-y-1 border-4 border-b-8 cursor-pointer ${
              isListening
                ? 'bg-red-600 text-white border-red-800'
                : 'bg-[#0D9488] hover:bg-[#0F766E] text-white border-[#115E59]'
            }`}
            title="Chạm để bắt đầu nói"
          >
            {isListening ? <MicOff className="w-16 h-16 stroke-[2.2]" /> : <Mic className="w-16 h-16 stroke-[2.2]" />}
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xl sm:text-2xl font-display font-bold text-[#0B1F3A] dark:text-white">
            {isListening
              ? 'Cháu đang lắng nghe Bác nói...'
              : isLoading
              ? 'Cháu đang suy nghĩ câu trả lời cho Bác...'
              : isPlayingVoice
              ? 'Cháu đang thưa chuyện với Bác...'
              : 'Chạm vào nút tròn để bắt đầu nói'}
          </p>
          <AudioEqualizer isSpeaking={isPlayingVoice} />
        </div>

        {transcript && (
          <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Lời Bác vừa nói:</span>
            <p className="text-xl sm:text-2xl font-display font-bold text-[#0B1F3A] dark:text-white mt-1">
              “{transcript}”
            </p>
          </div>
        )}

        {/* Lời đáp của Chị Google */}
        <div className="w-full bg-[#F0FDFA] dark:bg-[#0D9488]/15 border-2 border-[#99F6E4] dark:border-[#0D9488]/40 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-[#99F6E4] dark:border-[#0D9488]/30 pb-3">
            <span className="text-xs font-mono font-bold text-[#0D9488] dark:text-[#2DD4BF] uppercase tracking-wider flex items-center gap-2">
              <MessageSquareQuote className="w-4 h-4" />
              <span>Chị Google (Trợ lý Y tế MediGuard):</span>
            </span>
            <div className="flex items-center gap-2">
              {isPlayingVoice ? (
                <button
                  onClick={handleStopSpeakingNow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 font-bold text-xs sm:text-sm rounded-lg border border-rose-300 dark:border-rose-700 transition-colors cursor-pointer"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Dừng đọc</span>
                </button>
              ) : (
                <button
                  onClick={handleReplayCurrent}
                  disabled={isLoading || isPlayingVoice}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 text-[#0D9488] dark:text-[#2DD4BF] font-bold text-xs sm:text-sm rounded-lg border border-[#99F6E4] dark:border-[#0D9488]/40 hover:bg-[#F0FDFA] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Nghe lại</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-[#0B1F3A] dark:text-white leading-relaxed">
            {reply}
          </p>
          {groundingUsed && sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#99F6E4]/50 dark:border-[#0D9488]/30">
              <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                Nguồn tra cứu trực tuyến:
              </span>
              <div className="flex flex-wrap gap-2">
                {sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-white/80 dark:bg-slate-800 text-[#0D9488] dark:text-[#2DD4BF] border border-slate-200 dark:border-slate-700 hover:underline"
                  >
                    🌐 {src.title || src.url || `Nguồn ${idx + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Các câu hỏi mẫu một chạm */}
      <div className="bg-white dark:bg-[#0E1E36] border border-slate-200 dark:border-slate-800 shadow-saas p-6 rounded-3xl space-y-4">
        <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
          Hoặc Bác chạm vào câu hỏi có sẵn dưới đây:
        </p>
        <div className="grid grid-cols-1 gap-3">
          {[
            {
              text: 'Dạ cháu ơi, Bác uống thuốc cữ sáng rồi nhé',
              tag: 'Báo đã uống'
            },
            {
              text: 'Hôm nay thời tiết như thế nào hả cháu?',
              tag: 'Hỏi thời tiết thực tế'
            },
            {
              text: 'Thông tin về chế độ dinh dưỡng làm sao cho người già khỏe hơn',
              tag: 'Tư vấn dinh dưỡng'
            },
            {
              text: 'Cháu ơi, Bác thấy hơi chóng mặt và mệt trong người',
              tag: 'Báo triệu chứng'
            },
            {
              text: 'Hôm nay Bác cần uống những thuốc gì hả cháu?',
              tag: 'Hỏi đơn thuốc'
            },
            {
              text: 'Cháu kể cho Bác nghe một chuyện vui đi',
              tag: 'Bầu bạn tâm sự'
            },
            {
              text: 'Hôm nay Bác thấy hơi buồn và cô đơn quá cháu ơi',
              tag: 'Tâm sự nỗi niềm'
            },
            {
              text: 'Sáng nay Bác quên, trưa Bác uống bù gấp đôi được không cháu?',
              tag: 'Hỏi an toàn thuốc'
            }
          ].map((item) => (
            <button
              key={item.text}
              onClick={() => {
                setTranscript(item.text);
                handleSpeechProcessing(item.text);
              }}
              className="text-left p-4 rounded-xl bg-slate-50 hover:bg-[#F0FDFA] dark:bg-slate-800 dark:hover:bg-[#0D9488]/20 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-semibold text-base sm:text-lg transition-colors flex items-center justify-between gap-3 cursor-pointer"
            >
              <span>“{item.text}”</span>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 text-[#0D9488] dark:text-[#2DD4BF] border border-slate-200 dark:border-slate-700 shrink-0">
                {item.tag}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}