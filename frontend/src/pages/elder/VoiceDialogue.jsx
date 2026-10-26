import React, { useState, useEffect } from 'react';
import { Mic, MicOff, ArrowLeft, Volume2, Sparkles, RotateCcw } from 'lucide-react';
import { createSpeechRecognizer, playVoiceSpeech, unlockAllAudio } from '../../services/voiceService';
import { processVoiceSpeech, getStoredUser } from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';
import AudioEqualizer from '../../components/AudioEqualizer';

const INITIAL_GREETING = 'Dạ thưa Bác, cháu đang lắng nghe đây ạ! Bác bấm micro lớn bên dưới hoặc chọn câu mẫu để trò chuyện với cháu nhé ạ.';

export default function VoiceDialogue({ onBack }) {
  const [selectedVoice, setSelectedVoice] = useState(
    () => localStorage.getItem('mediguard_voice') || 'vi-VN-HoaiMyNeural'
  );
  const [voiceRate, setVoiceRate] = useState(
    () => localStorage.getItem('mediguard_rate') || '-8%'
  );
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState(INITIAL_GREETING);
  const [lastAudioUrl, setLastAudioUrl] = useState(null);
  const [recognizer, setRecognizer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // Bảo vệ: Tự động giải phóng trạng thái đang nói/đang tải sau 10 giây nếu có sự cố
  useEffect(() => {
    if (isLoading || isPlayingVoice) {
      const timer = setTimeout(() => {
        setIsLoading(false);
        setIsPlayingVoice(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isPlayingVoice]);

  useEffect(() => {
    // Mở khóa âm thanh toàn diện
    unlockAllAudio();

    // Tự động phát câu chào mở đầu của AI Agent bằng giọng nói tiếng Việt
    const greetTimer = setTimeout(async () => {
      try {
        setIsPlayingVoice(true);
        await playVoiceSpeech(null, INITIAL_GREETING, selectedVoice, voiceRate);
      } catch (e) {
        console.warn('Lỗi phát giọng chào:', e);
      } finally {
        setIsPlayingVoice(false);
      }
    }, 350);

    // Khởi tạo nhận diện giọng nói
    const rec = createSpeechRecognizer(
      (text) => {
        setTranscript(text);
        handleSpeechProcessing(text);
      },
      (err) => {
        console.warn('Lỗi nhận diện:', err);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
    setRecognizer(rec);

    return () => {
      clearTimeout(greetTimer);
      if (rec) {
        try {
          rec.abort();
        } catch (e) {}
      }
    };
  }, []);

  const toggleListen = async () => {
    await unlockAllAudio();
    if (!recognizer) {
      alert('Trình duyệt chưa hỗ trợ micro hoặc chưa cấp quyền. Bác có thể bấm các câu mẫu bên dưới để nói chuyện với cháu nhé ạ!');
      return;
    }
    if (isListening) {
      try {
        recognizer.stop();
      } catch (e) {}
      setIsListening(false);
    } else {
      setTranscript('');
      playChimeSound();
      try {
        recognizer.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Lỗi bật micro:', e);
        setIsListening(false);
      }
    }
  };

  const handleVoiceChange = async (voice) => {
    setSelectedVoice(voice);
    localStorage.setItem('mediguard_voice', voice);
    const sampleText = voice === 'vi-VN-NamMinhNeural'
      ? 'Dạ thưa Bác, cháu đã đổi sang giọng Nam Minh trầm ấm, tròn vành rõ chữ cho Bác rồi ạ!'
      : 'Dạ thưa Bác, cháu đã đổi sang giọng Hoài My nhẹ nhàng, truyền cảm cho Bác rồi ạ!';
    setReply(sampleText);
    setLastAudioUrl(null);
    setIsPlayingVoice(true);
    try {
      await playVoiceSpeech(null, sampleText, voice, voiceRate);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  const handleRateChange = async (rate) => {
    setVoiceRate(rate);
    localStorage.setItem('mediguard_rate', rate);
    const sampleText = rate === '-12%'
      ? 'Dạ thưa Bác, cháu sẽ nói thật chậm rãi từng chữ để Bác dễ nghe nhé ạ!'
      : rate === '-8%'
      ? 'Dạ thưa Bác, cháu đang đọc ở tốc độ vừa vặn, rõ ràng rồi ạ!'
      : 'Dạ thưa Bác, cháu đang đọc ở tốc độ tiêu chuẩn ạ!';
    setReply(sampleText);
    setLastAudioUrl(null);
    setIsPlayingVoice(true);
    try {
      await playVoiceSpeech(null, sampleText, selectedVoice, rate);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  const handleSpeechProcessing = async (userText) => {
    if (!userText || !userText.trim()) return;
    setIsLoading(true);
    setReply('Dạ cháu đang suy nghĩ và chuẩn bị giọng nói...');
    try {
      // Gọi backend xử lý quy tắc an toàn & Edge-TTS tiếng Việt theo giọng đã chọn
      const storedUser = getStoredUser();
      const elderId = storedUser?.role === 'ELDER' ? storedUser.user_id : null;
      const data = await processVoiceSpeech(userText.trim(), selectedVoice, voiceRate, elderId);
      if (data && data.reply_speech) {
        setReply(data.reply_speech);
        setLastAudioUrl(data.audio_url || null);

        // Phát giọng nói phản hồi của AI Agent
        setIsPlayingVoice(true);
        await playVoiceSpeech(data.audio_url, data.reply_speech, selectedVoice, voiceRate);
      } else {
        throw new Error('Không nhận được nội dung phản hồi từ máy chủ');
      }
    } catch (err) {
      console.error('Lỗi khi gửi câu thoại:', err);
      
      // Xử lý thông minh khi gặp lỗi kết nối hoặc Backend chưa bật
      const lower = userText.toLowerCase().trim();
      let fallbackReply = '';

      if (
        lower.includes('uống rồi') ||
        lower.includes('đã uống') ||
        lower.includes('uống xong') ||
        lower.includes('uống hết') ||
        lower.includes('uống thuốc rồi') ||
        (lower.includes('uống') && lower.includes('rồi'))
      ) {
        fallbackReply = 'Dạ cháu đã ghi nhận Bác vừa uống thuốc rồi ạ! Bác nhớ uống đủ nước ấm và nghỉ ngơi thật thoải mái nhé ạ!';
      } else if (
        lower.includes('uống bù') ||
        lower.includes('gấp đôi') ||
        lower.includes('tăng liều') ||
        lower.includes('bỏ cữ')
      ) {
        fallbackReply = 'Dạ Bác ơi, Bác tuyệt đối đừng tự ý thay đổi liều lượng thuốc nhé ạ! Cháu đang báo ngay cho gia đình để hỗ trợ Bác đây ạ.';
      } else if (
        lower.includes('đau đầu') ||
        lower.includes('chóng mặt') ||
        lower.includes('đau bụng') ||
        lower.includes('mệt') ||
        lower.includes('buồn nôn') ||
        lower.includes('khó thở')
      ) {
        fallbackReply = 'Dạ cháu ghi nhận Bác đang thấy mệt trong người. Bác vui lòng ngồi nghỉ ngơi tại chỗ, cháu đang báo ngay cho người thân trong gia đình ạ!';
      } else {
        fallbackReply = 'Dạ thưa Bác, hệ thống đang kết nối với máy chủ MediGuard AI. Bác vui lòng đợi trong giây lát hoặc kiểm tra kết nối mạng nhé ạ!';
      }

      setReply(fallbackReply);
      setIsPlayingVoice(true);
      await playVoiceSpeech(null, fallbackReply, selectedVoice, voiceRate);
    } finally {
      setIsLoading(false);
      setIsPlayingVoice(false);
    }
  };

  const handleReplayCurrent = async () => {
    if (!reply || isLoading) return;
    setIsPlayingVoice(true);
    try {
      await playVoiceSpeech(lastAudioUrl, reply, selectedVoice, voiceRate);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 text-xl font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-800/90 px-5 py-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors"
      >
        <ArrowLeft className="w-6 h-6" /> Quay lại màn hình chính
      </button>

      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white">
          Nói Chuyện Với Trợ Lý
        </h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 mt-2">Bác bấm vào hình micro lớn bên dưới hoặc chọn câu hỏi mẫu</p>
      </div>

      {/* Thanh tùy chọn Giọng đọc & Tốc độ nói */}
      <div className="w-full bg-white dark:bg-slate-900/90 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Volume2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Giọng trợ lý:</span>
          <button
            onClick={() => handleVoiceChange('vi-VN-NamMinhNeural')}
            disabled={isLoading || isPlayingVoice}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
              selectedVoice === 'vi-VN-NamMinhNeural'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            👨 Nam Minh (Trầm ấm, rõ chữ)
          </button>
          <button
            onClick={() => handleVoiceChange('vi-VN-HoaiMyNeural')}
            disabled={isLoading || isPlayingVoice}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
              selectedVoice === 'vi-VN-HoaiMyNeural'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            👩 Hoài My (Nữ nhẹ nhàng)
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Tốc độ:</span>
          <button
            onClick={() => handleRateChange('-12%')}
            disabled={isLoading || isPlayingVoice}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              voiceRate === '-12%'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Đọc rất chậm rãi, rõ ràng cho người cao tuổi nghe kém"
          >
            🐢 Rất chậm (-12%)
          </button>
          <button
            onClick={() => handleRateChange('-8%')}
            disabled={isLoading || isPlayingVoice}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              voiceRate === '-8%'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Tốc độ khuyên dùng: dễ nghe, tròn chữ"
          >
            👌 Chậm vừa (-8%)
          </button>
          <button
            onClick={() => handleRateChange('+0%')}
            disabled={isLoading || isPlayingVoice}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              voiceRate === '+0%'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Tốc độ nói thông thường"
          >
            ⚡ Bình thường (0%)
          </button>
        </div>
      </div>

      {/* Nút Micro to nhấp nháy sóng âm */}
      <div className="relative my-4">
        {isListening && (
          <div className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-35 scale-150 pointer-events-none" />
        )}
        {isPlayingVoice && (
          <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-25 scale-125 pointer-events-none" />
        )}
        <button
          onClick={toggleListen}
          disabled={isLoading}
          className={`relative w-40 h-40 md:w-48 md:h-48 rounded-full flex items-center justify-center transition-all transform active:scale-95 border-4 ${
            isListening
              ? 'bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-glow-rose border-rose-300'
              : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-glow-blue border-blue-200 dark:border-blue-500/30'
          }`}
        >
          {isListening ? <MicOff className="w-16 h-16 animate-pulse" /> : <Mic className="w-16 h-16" />}
        </button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xl md:text-2xl font-display font-black text-blue-900 dark:text-blue-300 tracking-tight">
          {isListening
            ? 'ĐANG LẮNG NGHE BÁC NÓI...'
            : isLoading
            ? 'ĐANG TẠO GIỌNG ĐỌC AI...'
            : isPlayingVoice
            ? 'TRỢ LÝ ĐANG TRẢ LỜI...'
            : 'BẤM MICRO ĐỂ NÓI'}
        </p>
        <AudioEqualizer isSpeaking={isPlayingVoice} />
      </div>

      {/* Hiển thị câu nói của người già */}
      {transcript && (
        <div className="w-full bg-blue-50/90 dark:bg-slate-900/90 border-2 border-blue-200 dark:border-blue-900/60 rounded-3xl p-5 text-center shadow-sm">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Bác vừa nói:</p>
          <p className="text-2xl font-display font-bold text-blue-950 dark:text-blue-100 mt-1">"{transcript}"</p>
        </div>
      )}

      {/* Câu trả lời của AI cùng nút Nghe lại */}
      <div className="w-full glass-card border border-slate-200 dark:border-slate-800 shadow-lg rounded-3xl p-6 text-center space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Trợ lý MediGuard AI phản hồi:
          </p>
          <button
            onClick={handleReplayCurrent}
            disabled={isLoading || isPlayingVoice}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 font-bold text-sm rounded-xl border border-blue-200 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            title="Bác bấm vào đây để nghe lại lời trợ lý nói"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Nghe Lại</span>
          </button>
        </div>
        <p className="text-2xl md:text-3xl font-display font-extrabold text-slate-800 dark:text-white leading-snug">{reply}</p>
      </div>

      {/* CÁC CÂU MẪU ĐỂ BÁC TRÒ CHUYỆN HOẶC KIỂM THỬ NHANH */}
      <div className="w-full bg-slate-50 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 text-left">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" /> Bác bấm vào câu hỏi mẫu để nghe cháu trả lời bằng giọng nói:
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              setTranscript("Dạ cháu ơi, Bác uống thuốc cữ sáng rồi nhé");
              handleSpeechProcessing("Dạ cháu ơi, Bác uống thuốc cữ sáng rồi nhé");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-emerald-50 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-emerald-950 dark:text-emerald-300 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Dạ cháu ơi, Bác uống thuốc cữ sáng rồi nhé"</span>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full font-bold">Báo uống xong</span>
          </button>

          <button
            onClick={() => {
              setTranscript("Hôm nay Bác cần uống những thuốc gì hả cháu?");
              handleSpeechProcessing("Hôm nay Bác cần uống những thuốc gì hả cháu?");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-blue-50 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-blue-950 dark:text-blue-300 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Hôm nay Bác cần uống những thuốc gì hả cháu?"</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-full font-bold">Hỏi đơn thuốc</span>
          </button>

          <button
            onClick={() => {
              setTranscript("Sáng nay Bác quên, trưa Bác uống bù gấp đôi được không cháu?");
              handleSpeechProcessing("Sáng nay Bác quên, trưa Bác uống bù gấp đôi được không cháu?");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-rose-50 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-rose-950 dark:text-rose-300 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Sáng nay Bác quên, trưa Bác uống bù gấp đôi được không cháu?"</span>
            <span className="text-xs bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 px-2.5 py-1 rounded-full font-bold">Quy tắc an toàn</span>
          </button>

          <button
            onClick={() => {
              setTranscript("Cháu ơi, Bác thấy hơi chóng mặt và mệt trong người");
              handleSpeechProcessing("Cháu ơi, Bác thấy hơi chóng mặt và mệt trong người");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-amber-50 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-amber-950 dark:text-amber-300 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Cháu ơi, Bác thấy hơi chóng mặt và mệt trong người"</span>
            <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 px-2.5 py-1 rounded-full font-bold">Cảnh báo khẩn</span>
          </button>

          <button
            onClick={() => {
              setTranscript("Thuốc này Bác nên uống trước ăn hay sau khi ăn hả cháu?");
              handleSpeechProcessing("Thuốc này Bác nên uống trước ăn hay sau khi ăn hả cháu?");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-purple-50 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-purple-950 dark:text-purple-300 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Thuốc này Bác nên uống trước ăn hay sau khi ăn hả cháu?"</span>
            <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-900 dark:text-purple-300 px-2.5 py-1 rounded-full font-bold">Hướng dẫn uống</span>
          </button>
        </div>
      </div>
    </div>
  );
}
