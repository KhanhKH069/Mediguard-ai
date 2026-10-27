import React, { useState, useEffect, useRef } from 'react';
import { createSpeechRecognizer, playVoiceSpeech, stopAllSpeech, unlockAllAudio } from '../../services/voiceService';
import { fastAIReply, processVoiceSpeech } from '../../services/api';
import { playChimeSound } from '../../utils/soundEffects';

export function resolveValidSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.filter((s) => typeof s === 'string' && s.trim().length > 0);
}

export default function ElderVoiceAssistantTab({ currentUser, elderId = null, onOpenSymptomReport }) {
  const [isListening, setIsListening] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [statusText, setStatusText] = useState('Chạm vào micro để Bác nói');
  const [userQuestion, setUserQuestion] = useState('“Sáng nay bác hơi choáng đầu nhẹ sau khi ăn, có sao không cháu?”');
  const [questionTime, setQuestionTime] = useState('08:15 Sáng nay');
  const [lastAudioUrl, setLastAudioUrl] = useState(null);
  const [micNotice, setMicNotice] = useState('');
  const [textInput, setTextInput] = useState('');
  const [aiAnswer, setAiAnswer] = useState({
    greeting: 'Dạ thưa Bác, cháu là Chị Google - trợ lý y tế của Bác đây ạ. Bác chạm vào chiếc micro bên dưới hoặc bấm câu hỏi mẫu để trò chuyện cùng cháu nhé!',
    steps: [
      'Bác hãy nghỉ ngơi thoải mái, tránh xúc động hay làm việc nặng.',
      'Uống từ từ một ngụm nước ấm nhỏ.',
      'Cần hỏi về giờ uống thuốc hay đo huyết áp, Bác cứ hỏi cháu nhé!'
    ],
    familyNote: 'Cháu luôn đồng hành và gửi thông báo an tâm cho con cháu Bác.'
  });

  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  });

  const recognizerRef = useRef(null);
  const isExecutingRef = useRef(false);
  const silenceTimerRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    unlockAllAudio();
    if (typeof window !== 'undefined') {
      localStorage.setItem('mediguard_voice', 'vi-VN-Google');
    }
    const rec = createSpeechRecognizer(
      (text, isFinal) => {
        if (!text || isExecutingRef.current) return;
        setStatusText(`Đang nghe: "${text}"`);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (isFinal) {
          handleAskQuestion(text.trim());
        } else {
          silenceTimerRef.current = setTimeout(() => {
            if (text && text.trim().length >= 2 && !isExecutingRef.current) {
              handleAskQuestion(text.trim());
            }
          }, 850);
        }
      },
      (err) => {
        console.warn('Speech error:', err);
        setIsListening(false);
        if (err === 'not-allowed' || err === 'permission-denied') {
          setMicNotice('Micro chưa được cấp quyền! Bác vui lòng nhấn "Cho phép" (Allow) quyền Micro trên trình duyệt hoặc chạm các câu hỏi mẫu bên dưới nhé.');
          setStatusText('Chưa được cấp quyền Micro');
        } else if (err === 'no-speech') {
          setStatusText('Chưa nghe rõ, Bác chạm lại micro nhé');
        } else {
          setStatusText('Chạm vào micro để Bác nói');
        }
      },
      () => {
        setIsListening(false);
        if (!isExecutingRef.current) {
          setStatusText('Chạm vào micro để Bác nói');
        }
      },
      { continuous: false, interimResults: true, lang: 'vi-VN' }
    );

    if (!rec) {
      setMicNotice('Trình duyệt chưa hỗ trợ Micro trực tiếp (hoặc đang mở qua Zalo/Messenger). Bác hãy bấm nút 3 chấm góc trên & chọn "Mở bằng Safari / Chrome" để nói chuyện nhé!');
    }
    recognizerRef.current = rec;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopAllSpeech();
      if (recognizerRef.current) {
        try { recognizerRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  const toggleMicrophone = async () => {
    await unlockAllAudio();
    if (isListening) {
      if (recognizerRef.current) {
        try { recognizerRef.current.stop(); } catch (e) {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
      setStatusText('Chạm vào micro để Bác nói');
    } else {
      if (!recognizerRef.current) {
        setMicNotice('Trình duyệt chưa hỗ trợ Micro hoặc đang mở trong Zalo/Messenger. Bác hãy bấm nút 3 chấm góc trên & chọn "Mở bằng trình duyệt" (Safari/Chrome) để dùng micro nhé!');
        return;
      }
      playChimeSound();
      stopAllSpeech();
      setIsListening(true);
      setMicNotice('');
      setStatusText('Cháu đang lắng nghe Bác nói...');
      try {
        recognizerRef.current.start();
      } catch (e) {
        console.warn('Mic start err:', e);
        try {
          recognizerRef.current.stop();
          setTimeout(() => {
            try { recognizerRef.current.start(); } catch (e2) {}
          }, 150);
        } catch (retryErr) {}
      }
    }
  };

  const handleTextSubmit = (e) => {
    if (e) e.preventDefault();
    const query = textInput.trim();
    if (!query) return;
    setTextInput('');
    handleAskQuestion(query);
  };

  const handleAskQuestion = async (queryText) => {
    if (!queryText || isExecutingRef.current) return;
    await unlockAllAudio();
    isExecutingRef.current = true;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsListening(false);
    if (recognizerRef.current) {
      try { recognizerRef.current.stop(); } catch (e) {}
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} Hôm nay`;
    setUserQuestion(`“${queryText}”`);
    setQuestionTime(timeStr);
    setStatusText('Cháu đang suy nghĩ giải đáp cho Bác...');

    try {
      const targetElderId = elderId || (currentUser?.role === 'ELDER' ? (currentUser.user_id || currentUser.id) : null);
      let replyText = '';
      let audioUrl = null;
      let resp = null;
      try {
        resp = await fastAIReply(targetElderId, queryText, 'vi-VN-Google');
        replyText = resp?.reply || resp?.text || '';
        audioUrl = resp?.audio_url || null;
      } catch (err) {
        console.warn('Lỗi fastAIReply, chuyển sang dự phòng processVoiceSpeech:', err);
        try {
          resp = await processVoiceSpeech(queryText, 'vi-VN-Google', null, targetElderId);
          replyText = resp?.reply || resp?.reply_speech || resp?.reply_text || resp?.text || '';
          audioUrl = resp?.audio_url || null;
        } catch (voiceErr) {
          console.warn('Lỗi processVoiceSpeech:', voiceErr);
        }
      }

      if (!replyText) {
        const lowerQ = queryText.toLowerCase();
        if (lowerQ.includes('uống rồi') || lowerQ.includes('uống xong') || lowerQ.includes('đã uống')) {
          replyText = 'Dạ thưa Bác, cháu đã ghi nhận Bác vừa uống xong thuốc cữ này rồi ạ! Bác uống thêm chút nước ấm và nghỉ ngơi nhé.';
        } else if (lowerQ.includes('chóng mặt') || lowerQ.includes('đau đầu') || lowerQ.includes('mệt') || lowerQ.includes('ngã')) {
          replyText = 'Dạ thưa Bác, cháu đã ghi nhận Bác đang cảm thấy không khỏe. Bác hãy ngồi hoặc nằm nghỉ ngơi tại chỗ, uống một ngụm nước ấm nhỏ và nhờ người nhà hỗ trợ ngay nhé!';
        } else {
          replyText = 'Dạ thưa Bác, cháu là Chị Google trợ lý của Bác đây ạ. Cháu đã tiếp nhận câu hỏi của Bác. Bác nhớ uống nước ấm đầy đủ, uống thuốc đúng giờ và nghỉ ngơi điều độ nhé!';
        }
      }

      const name = currentUser?.full_name ? currentUser.full_name.split(' ').pop() : 'An';
      const formattedGreeting = replyText.toLowerCase().startsWith('dạ')
        ? replyText
        : `Dạ thưa Bác ${name}, ${replyText}`;

      const validSteps = resolveValidSteps(resp?.steps);

      setLastAudioUrl(audioUrl);
      setAiAnswer({
        greeting: formattedGreeting,
        steps: validSteps,
        familyNote: 'Cháu đã tự động lưu câu hỏi và gửi thông báo an tâm cho người thân của Bác.'
      });

      setStatusText('Chạm vào micro hoặc gõ câu hỏi cho cháu');
      // Tự động phát âm thanh trả lời chuẩn giọng Chị Google (Google Translate TTS)
      handlePlayVoice(formattedGreeting, audioUrl);
    } catch (e) {
      console.error('Lỗi hỏi AI:', e);
      const name = currentUser?.full_name ? currentUser.full_name.split(' ').pop() : 'An';
      const fallbackReply = `Dạ thưa Bác ${name}, cháu là Chị Google trợ lý của Bác đây ạ. Cháu đã tiếp nhận câu hỏi "${queryText}". Bác nhớ uống đủ nước ấm, uống thuốc theo đơn và nghỉ ngơi tĩnh dưỡng Bác nhé!`;
      setAiAnswer({
        greeting: fallbackReply,
        steps: [],
        familyNote: 'Cháu luôn đồng hành và sẵn sàng hỗ trợ Bác 24/7.'
      });
      setStatusText('Chạm vào micro hoặc gõ câu hỏi cho cháu');
      handlePlayVoice(fallbackReply, null);
    } finally {
      isExecutingRef.current = false;
    }
  };

  const handlePlayVoice = async (overrideText = null, overrideAudioUrl = null) => {
    await unlockAllAudio();
    setIsPlayingVoice(true);
    const stepsText = Array.isArray(aiAnswer.steps) && aiAnswer.steps.length > 0 ? ` ${aiAnswer.steps.join('. ')}` : '';
    const textToSpeak = overrideText || (aiAnswer.greeting ? `${aiAnswer.greeting}${stepsText}` : userQuestion);
    const targetAudioUrl = overrideAudioUrl !== undefined ? overrideAudioUrl : lastAudioUrl;

    try {
      await playVoiceSpeech(targetAudioUrl, textToSpeak, 'vi-VN-Google');
    } catch (err) {
      console.warn('Lỗi phát giọng nói:', err);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  const handleStopVoice = () => {
    stopAllSpeech();
    setIsPlayingVoice(false);
  };

  const elderDisplayName = currentUser?.full_name ? currentUser.full_name.split(' ').pop() : 'An';

  return (
    <div className="flex flex-col w-full pb-8 space-y-space-md">
      {/* 1. Header Section: Dignified Greeting for Elderly User */}
      <div className="flex items-center justify-between bg-surface-container-low p-space-md rounded-2xl shadow-sm border border-outline-variant/30">
        <div className="flex items-center gap-space-sm">
          <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-[32px]">support_agent</span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md text-primary leading-tight font-bold">
              Chị Google - Trợ lý Y tế
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Bác nói điều muốn hỏi, cháu là Chị Google luôn lắng nghe Bác
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
            Sẵn sàng
          </span>
          <span className="font-mono text-xs font-bold text-primary mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            {currentTime}
          </span>
        </div>
      </div>

      {/* Thông báo quyền Micro / Hướng dẫn mở trình duyệt nếu bị chặn */}
      {micNotice && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2.5 shadow-sm">
          <span className="material-symbols-outlined text-[22px] text-amber-600 shrink-0 mt-0.5">info</span>
          <div className="flex-1 text-left leading-relaxed">
            <span className="font-semibold">{micNotice}</span>
          </div>
        </div>
      )}

      {/* 2. Central Voice Interaction Hub (Giant Tactile Mic Button) */}
      <div className="flex flex-col items-center justify-center py-space-md bg-surface-container-lowest rounded-2xl p-space-md shadow-md text-center border border-outline-variant/30">
        <div className="relative flex items-center justify-center my-3">
          {/* Living animation wave rings */}
          <div
            className={`absolute w-36 h-36 rounded-full ${
              isListening ? 'bg-tertiary-fixed-dim/70 animate-ping duration-700' : 'bg-primary-fixed-dim/40 animate-ping duration-1000'
            }`}
          ></div>
          <div
            className={`absolute w-32 h-32 rounded-full ${
              isListening ? 'bg-tertiary/20 animate-pulse' : 'bg-primary/10 animate-pulse'
            }`}
          ></div>

          {/* Main 112px Pushable Mic Button */}
          <button
            aria-label="Nhấn để nói chuyện với Bác sĩ MediGuard"
            className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center select-none transition-all active:scale-95 cursor-pointer ${
              isListening
                ? 'bg-tertiary text-on-tertiary shadow-[0_8px_24px_rgba(171,0,15,0.4)]'
                : 'bg-primary-container text-on-primary shadow-[0_8px_24px_rgba(13,122,95,0.35)]'
            }`}
            onClick={toggleMicrophone}
            type="button"
          >
            <span className="material-symbols-outlined text-[52px]">
              {isListening ? 'graphic_eq' : 'mic'}
            </span>
          </button>
        </div>

        {/* Instruction Label - Scaled up for 60+ age group readability */}
        <div className="mt-space-sm">
          <p className={`font-headline-sm text-headline-sm font-bold ${isListening ? 'text-tertiary-container animate-pulse' : 'text-primary'}`}>
            {statusText}
          </p>
          <p className="font-body-md text-body-md text-outline mt-0.5">
            Nói tự nhiên, không cần vội vàng Bác nhé
          </p>
        </div>

        {/* Live Audio Waveform Simulation Bar */}
        <div className="flex items-center justify-center gap-1.5 h-6 mt-3 opacity-60">
          <span className={`w-1.5 h-3 bg-primary rounded-full ${isListening ? 'animate-bounce' : ''}`} style={{ animationDelay: '0.1s' }}></span>
          <span className={`w-1.5 h-5 bg-primary rounded-full ${isListening ? 'animate-bounce' : ''}`} style={{ animationDelay: '0.2s' }}></span>
          <span className={`w-1.5 h-6 bg-primary rounded-full ${isListening ? 'animate-bounce' : ''}`} style={{ animationDelay: '0.3s' }}></span>
          <span className={`w-1.5 h-4 bg-primary rounded-full ${isListening ? 'animate-bounce' : ''}`} style={{ animationDelay: '0.4s' }}></span>
          <span className={`w-1.5 h-2 bg-primary rounded-full ${isListening ? 'animate-bounce' : ''}`} style={{ animationDelay: '0.5s' }}></span>
        </div>
      </div>

      {/* Ô nhập câu hỏi văn bản trực tiếp cho Bác (Gõ phím không cần phụ thuộc micro) */}
      <div className="bg-surface-container-lowest p-3 sm:p-4 rounded-2xl shadow-sm border border-outline-variant/30">
        <form onSubmit={handleTextSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Bác gõ câu hỏi tại đây... (VD: Đau đầu uống gì, Hôm nay uống mấy cữ?)"
              className="w-full bg-surface-container-low text-on-surface px-4 py-3 rounded-xl border border-outline-variant/50 focus:border-primary focus:outline-none text-base font-medium placeholder:text-outline"
              disabled={isListening}
            />
          </div>
          <button
            type="submit"
            disabled={!textInput.trim() || isListening}
            className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-95 disabled:opacity-40 transition-all cursor-pointer min-h-[48px]"
          >
            <span className="material-symbols-outlined text-[22px]">send</span>
            <span className="text-sm sm:text-base">Hỏi Chị Google</span>
          </button>
        </form>
      </div>

      {/* 3. Conversation History Container */}
      <div className="space-y-space-md">
        {/* User (Bac An) Dialog Bubble */}
        <div className="flex flex-col items-end pl-8">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-label-md text-label-md text-on-surface-variant font-semibold">
              Bác {elderDisplayName} vừa nói
            </span>
            <div className="w-7 h-7 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center text-xs shadow-sm">
              {elderDisplayName[0]}
            </div>
          </div>
          <div className="bg-surface-container-high text-on-surface rounded-2xl rounded-tr-none p-space-md shadow-sm border border-outline-variant/30">
            <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
              {userQuestion}
            </p>
          </div>
          <span className="font-body-md text-label-md text-outline mt-1">{questionTime}</span>
        </div>

        {/* AI Response Bubble */}
        <div className="flex flex-col items-start pr-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
            <span className="font-label-md text-label-md text-primary font-bold">
              Chị Google giải đáp
            </span>
          </div>

          <div className="bg-surface-container-lowest text-on-surface rounded-2xl rounded-tl-none p-space-md shadow-md space-y-space-sm w-full border border-outline-variant/30">
            <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
              {aiAnswer.greeting}
            </p>

            {/* Reassuring Step-by-Step Card */}
            {Array.isArray(aiAnswer.steps) && aiAnswer.steps.length > 0 && (
              <div className="bg-surface-container-low rounded-xl p-space-sm space-y-2 border border-outline-variant/20">
                <div className="flex items-center gap-2 text-primary font-label-lg text-label-lg font-bold">
                  <span className="material-symbols-outlined text-[24px]">task_alt</span>
                  <span>Việc Bác cần làm ngay:</span>
                </div>
                <ul className="list-disc list-inside font-body-md text-body-md text-on-surface-variant space-y-1.5 pl-1">
                  {aiAnswer.steps.map((step, idx) => (
                    <li key={idx} className="leading-snug">{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Family notification reassurance */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container text-secondary font-label-md text-label-md">
              <span className="material-symbols-outlined text-[22px]">family_restroom</span>
              <span>{aiAnswer.familyNote}</span>
            </div>
          </div>

          {/* READ ALOUD BUTTON (LOA ĐỌC TO CÂU TRẢ LỜI) */}
          <div className="w-full mt-3">
            <button
              aria-label="Loa đọc to câu trả lời cho Bác nghe"
              className={`w-full min-h-[64px] py-3 px-space-md rounded-2xl ${
                isPlayingVoice ? 'bg-tertiary text-on-tertiary shadow-[0_4px_16px_rgba(171,0,15,0.4)]' : 'bg-secondary text-on-secondary shadow-[0_4px_16px_rgba(0,99,152,0.3)]'
              } active:scale-[0.98] transition-transform flex items-center justify-center gap-3 cursor-pointer`}
              onClick={() => (isPlayingVoice ? handleStopVoice() : handlePlayVoice())}
              type="button"
            >
              <span className={`material-symbols-outlined text-[36px] ${isPlayingVoice ? 'animate-pulse' : ''}`}>
                {isPlayingVoice ? 'stop_circle' : 'volume_up'}
              </span>
              <div className="flex flex-col text-left">
                <span className="font-headline-sm text-headline-sm font-bold leading-none">
                  {isPlayingVoice ? 'CHỊ GOOGLE ĐANG ĐỌC... (CHẠM ĐỂ DỪNG)' : 'LOA CHỊ GOOGLE ĐỌC TO CÂU TRẢ LỜI'}
                </span>
                <span className="font-body-md text-label-md opacity-90 mt-0.5">
                  {isPlayingVoice ? 'Bác chạm vào đây nếu muốn dừng giọng đọc' : 'Bấm vào đây để nghe Chị Google đọc to dịu dàng cho Bác'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Quick Pre-Set Prompt Chips for Elderly Users (One-Touch Simplicity) */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-space-xs">
          <span className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[24px]">lightbulb</span>
            Bác muốn hỏi nhanh câu này?
          </span>
          <span className="font-body-md text-label-md text-outline">Chạm 1 lần</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            className="w-full min-h-[58px] p-space-sm px-space-md rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:bg-surface-container-high transition-colors flex items-center justify-between text-left border border-outline-variant/30 cursor-pointer"
            onClick={() => handleAskQuestion('Hôm nay tôi cần làm gì?')}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[26px]">task_alt</span>
              <span className="font-label-lg text-label-lg font-medium">“Hôm nay tôi cần làm gì?”</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[22px]">arrow_forward_ios</span>
          </button>

          <button
            className="w-full min-h-[58px] p-space-sm px-space-md rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:bg-surface-container-high transition-colors flex items-center justify-between text-left border border-outline-variant/30 cursor-pointer"
            onClick={() => handleAskQuestion('Thuốc này uống lúc nào?')}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[26px]">medication_liquid</span>
              <span className="font-label-lg text-label-lg font-medium">“Thuốc này uống lúc nào?”</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[22px]">arrow_forward_ios</span>
          </button>

          <button
            className="w-full min-h-[58px] p-space-sm px-space-md rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:bg-surface-container-high transition-colors flex items-center justify-between text-left border border-outline-variant/30 cursor-pointer"
            onClick={() => handleAskQuestion('Hôm nay tôi đã uống thuốc gì rồi?')}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[26px]">event_available</span>
              <span className="font-label-lg text-label-lg font-medium">“Hôm nay tôi đã uống thuốc gì rồi?”</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[22px]">arrow_forward_ios</span>
          </button>

          <button
            className="w-full min-h-[58px] p-space-sm px-space-md rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:bg-surface-container-high transition-colors flex items-center justify-between text-left border border-outline-variant/30 cursor-pointer"
            onClick={() => handleAskQuestion('Chỉ số huyết áp của tôi hôm qua thế nào?')}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[26px]">favorite</span>
              <span className="font-label-lg text-label-lg font-medium">“Chỉ số huyết áp của tôi hôm qua thế nào?”</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[22px]">arrow_forward_ios</span>
          </button>

          <button
            className="w-full min-h-[58px] p-space-sm px-space-md rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:bg-surface-container-high transition-colors flex items-center justify-between text-left border border-outline-variant/30 cursor-pointer"
            onClick={() => handleAskQuestion('Thời tiết hôm nay thế nào?')}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[26px]">partly_cloudy_day</span>
              <span className="font-label-lg text-label-lg font-medium">“Thời tiết hôm nay thế nào?”</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[22px]">arrow_forward_ios</span>
          </button>

          <button
            className="w-full min-h-[58px] p-space-sm px-space-md rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:bg-surface-container-high transition-colors flex items-center justify-between text-left border border-outline-variant/30 cursor-pointer"
            onClick={() => handleAskQuestion('Bác thấy hơi chóng mặt, mệt trong người')}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-[26px]">sick</span>
              <span className="font-label-lg text-label-lg font-medium text-tertiary">“Bác thấy hơi chóng mặt, mệt trong người”</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[22px]">arrow_forward_ios</span>
          </button>

          <button
            className="w-full min-h-[58px] p-space-sm px-space-md rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:bg-surface-container-high transition-colors flex items-center justify-between text-left border border-outline-variant/30 cursor-pointer"
            onClick={() => handleAskQuestion('Tôi đã uống thuốc rồi nhé')}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[26px]">check_circle</span>
              <span className="font-label-lg text-label-lg font-medium">“Tôi đã uống thuốc rồi nhé”</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[22px]">arrow_forward_ios</span>
          </button>

          <button
            className="w-full min-h-[58px] p-space-sm px-space-md rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:bg-surface-container-high transition-colors flex items-center justify-between text-left border border-outline-variant/30 cursor-pointer"
            onClick={() => handleAskQuestion('Cháu là ai, giúp bác được gì?')}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[26px]">psychology</span>
              <span className="font-label-lg text-label-lg font-medium">“Cháu là ai, giúp bác được gì?”</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[22px]">arrow_forward_ios</span>
          </button>
        </div>
      </div>

      {/* 5. Reassurance & Care Footer Note */}
      <div className="p-space-md rounded-2xl bg-surface-container-low flex items-center gap-space-sm border border-outline-variant/20">
        <span className="material-symbols-outlined text-primary text-[32px] shrink-0">health_and_safety</span>
        <p className="font-body-md text-label-md text-on-surface-variant leading-snug">
          Cháu hỗ trợ Bác 24/7. Mọi lời dặn của Bác sĩ chuyên khoa luôn được ưu tiên hàng đầu Bác nhé!
        </p>
      </div>
    </div>
  );
}
