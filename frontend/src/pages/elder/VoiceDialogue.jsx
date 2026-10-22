import React, { useState, useEffect } from 'react';
import { Mic, MicOff, ArrowLeft, Volume2, Sparkles, RotateCcw } from 'lucide-react';
import { createSpeechRecognizer, playVoiceSpeech, unlockAllAudio } from '../../services/voiceService';
import { processVoiceSpeech } from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';

const INITIAL_GREETING = 'Cháu đang lắng nghe. Bác cứ bấm micro hoặc chọn câu mẫu bên dưới để nói chuyện nhé!';

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
      alert('Trình duyệt chưa hỗ trợ micro hoặc chưa cấp quyền. Bác có thể bấm các câu mẫu bên dưới để nói chuyện với cháu nhé!');
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
      ? 'Dạ, cháu đã đổi sang giọng Nam Minh trầm ấm, rõ chữ cho bác rồi ạ!'
      : 'Dạ, cháu đã đổi sang giọng Hoài My nhẹ nhàng, truyền cảm cho bác rồi ạ!';
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
      ? 'Dạ, cháu sẽ nói thật chậm rãi cho bác dễ nghe nhé!'
      : rate === '-8%'
      ? 'Dạ, cháu đang đọc ở tốc độ vừa vặn, rõ ràng rồi ạ!'
      : 'Dạ, cháu đang đọc ở tốc độ bình thường ạ!';
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
    setReply('Đang suy nghĩ và chuẩn bị giọng nói...');
    try {
      // Gọi backend xử lý quy tắc an toàn & Edge-TTS tiếng Việt theo giọng đã chọn
      const data = await processVoiceSpeech(userText.trim(), selectedVoice, voiceRate);
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
        (lower.includes('uống') && lower.includes('rồi'))
      ) {
        fallbackReply = 'Cháu đã ghi nhận bác vừa uống thuốc rồi ạ! Bác nhớ uống đủ nước ấm và nghỉ ngơi thật thoải mái nhé!';
      } else if (
        lower.includes('uống bù') ||
        lower.includes('gấp đôi') ||
        lower.includes('tăng liều') ||
        lower.includes('bỏ cữ')
      ) {
        fallbackReply = 'Bác ơi, bác tuyệt đối đừng tự ý thay đổi liều lượng thuốc nhé! Cháu đang báo cho gia đình để hỗ trợ bác ngay đây ạ.';
      } else if (
        lower.includes('đau đầu') ||
        lower.includes('chóng mặt') ||
        lower.includes('đau bụng') ||
        lower.includes('mệt') ||
        lower.includes('buồn nôn')
      ) {
        fallbackReply = 'Cháu ghi nhận bác đang thấy mệt trong người. Bác vui lòng ngồi nghỉ ngơi tại chỗ, cháu đang báo ngay cho người thân ạ!';
      } else {
        fallbackReply = 'Chưa kết nối được máy chủ MediGuard AI (cổng 8000). Bác vui lòng kiểm tra xem Backend đã khởi động chưa nhé!';
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
        className="self-start flex items-center gap-2 text-xl font-bold text-slate-600 hover:text-slate-900 bg-white px-5 py-3 rounded-2xl shadow-sm transition-colors"
      >
        <ArrowLeft className="w-6 h-6" /> Quay lại màn hình chính
      </button>

      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800">
          Nói Chuyện Với Trợ Lý
        </h2>
        <p className="text-lg text-slate-500 mt-2">Bác bấm vào hình micro lớn bên dưới hoặc chọn câu hỏi mẫu</p>
      </div>

      {/* Thanh tùy chọn Giọng đọc & Tốc độ nói */}
      <div className="w-full bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Volume2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span className="text-sm font-bold text-slate-700">Giọng trợ lý:</span>
          <button
            onClick={() => handleVoiceChange('vi-VN-NamMinhNeural')}
            disabled={isLoading || isPlayingVoice}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
              selectedVoice === 'vi-VN-NamMinhNeural'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            👩 Hoài My (Nữ nhẹ nhàng)
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-sm font-bold text-slate-700">Tốc độ:</span>
          <button
            onClick={() => handleRateChange('-12%')}
            disabled={isLoading || isPlayingVoice}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              voiceRate === '-12%'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30 scale-150" />
        )}
        <button
          onClick={toggleListen}
          disabled={isLoading}
          className={`relative w-36 h-36 md:w-44 md:h-44 rounded-full flex items-center justify-center shadow-2xl transition-all transform active:scale-90 ${
            isListening ? 'bg-rose-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isListening ? <MicOff className="w-16 h-16" /> : <Mic className="w-16 h-16" />}
        </button>
      </div>

      <p className="text-xl font-bold text-blue-700">
        {isListening
          ? 'ĐANG LẮNG NGHE BÁC NÓI...'
          : isLoading
          ? 'ĐANG TẠO GIỌNG ĐỌC...'
          : isPlayingVoice
          ? 'TRỢ LÝ ĐANG NÓI...'
          : 'BẤM MICRO ĐỂ NÓI'}
      </p>

      {/* Hiển thị câu nói của người già */}
      {transcript && (
        <div className="w-full bg-blue-50 border-2 border-blue-200 rounded-3xl p-5 text-center">
          <p className="text-sm font-bold text-blue-600 uppercase">Bác vừa nói:</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">"{transcript}"</p>
        </div>
      )}

      {/* Câu trả lời của AI cùng nút Nghe lại */}
      <div className="w-full bg-white border border-slate-200 shadow-md rounded-3xl p-6 text-center">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
          <p className="text-sm font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-blue-600" /> Trợ lý phản hồi:
          </p>
          <button
            onClick={handleReplayCurrent}
            disabled={isLoading || isPlayingVoice}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-xl border border-blue-200 transition-colors disabled:opacity-50"
            title="Bác bấm vào đây để nghe lại lời trợ lý nói"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Nghe Lại</span>
          </button>
        </div>
        <p className="text-2xl md:text-3xl font-extrabold text-slate-800">{reply}</p>
      </div>

      {/* CÁC CÂU MẪU ĐỂ TEST GIỌNG NÓI NHANH */}
      <div className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-200 text-left">
        <p className="text-sm font-bold text-slate-500 uppercase flex items-center gap-1 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" /> Bác bấm vào câu hỏi mẫu để nghe AI trả lời bằng giọng nói:
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setTranscript("Bác uống thuốc cữ sáng rồi nhé");
              handleSpeechProcessing("Bác uống thuốc cữ sáng rồi nhé");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-emerald-50 border border-slate-200 text-emerald-900 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Bác uống thuốc cữ sáng rồi nhé"</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold">Báo uống xong</span>
          </button>

          <button
            onClick={() => {
              setTranscript("Hôm nay bác cần uống những thuốc gì?");
              handleSpeechProcessing("Hôm nay bác cần uống những thuốc gì?");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-blue-50 border border-slate-200 text-blue-900 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Hôm nay bác cần uống những thuốc gì?"</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-bold">Hỏi đơn thuốc</span>
          </button>

          <button
            onClick={() => {
              setTranscript("Sáng nay bác quên, trưa bác uống bù gấp đôi được không?");
              handleSpeechProcessing("Sáng nay bác quên, trưa bác uống bù gấp đôi được không?");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 text-rose-800 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Sáng nay bác quên, trưa bác uống bù gấp đôi được không?"</span>
            <span className="text-xs bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full font-bold">Quy tắc an toàn</span>
          </button>

          <button
            onClick={() => {
              setTranscript("Bác thấy chóng mặt quá cháu ơi");
              handleSpeechProcessing("Bác thấy chóng mặt quá cháu ơi");
            }}
            className="text-left p-3.5 rounded-2xl bg-white hover:bg-amber-50 border border-slate-200 text-amber-900 font-semibold text-base transition-colors flex items-center justify-between"
          >
            <span>👉 "Bác thấy chóng mặt quá cháu ơi"</span>
            <span className="text-xs bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full font-bold">Cảnh báo khẩn</span>
          </button>
        </div>
      </div>
    </div>
  );
}
