// ==============================================================================
// MEDIGUARD AI - VOICE SERVICE (STT TRÌNH DUYỆT & EDGE-TTS TIẾNG VIỆT)
// ==============================================================================

import { getAudioContext, unlockAudioContext } from '../utils/soundEffects';
import { API_BASE, speakText } from './api';

let sharedAudio = null;

function getSharedAudio() {
  if (!sharedAudio && typeof window !== 'undefined') {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

/**
 * Mở khóa quyền phát âm thanh toàn diện (cả HTML5 Audio và Web Audio Context)
 * Được gọi ở lần click đầu tiên của người dùng hoặc nút "BẬT ÂM THANH".
 */
export async function unlockAllAudio() {
  // 1. Mở khóa Web Audio Context
  await unlockAudioContext();

  // 2. Mở khóa HTML5 Audio Element bằng mẫu âm thanh câm cực ngắn (0.01s base64)
  const audio = getSharedAudio();
  if (audio) {
    try {
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      await audio.play();
      audio.pause();
      console.log('>>> HTML5 Audio Player đã được mở khóa Autoplay thành công!');
    } catch (e) {
      // Bỏ qua nếu trình duyệt yêu cầu gesture sau
    }
  }
}

/**
 * Phát âm thanh giọng đọc tiếng Việt:
 * 1. Nếu có audioUrl (Edge-TTS từ backend), ưu tiên phát bằng thẻ HTML5 Audio dùng chung.
 * 2. Dự phòng bằng Web Audio API nếu thẻ Audio gặp trục trặc.
 * 3. Nếu chưa có audioUrl, gọi backend sinh file qua API /api/voice/speak.
 * 4. Không bao giờ bị treo vô hạn (có timeout bảo vệ 12s).
 */
export async function playVoiceSpeech(audioUrl, fallbackText, voice = null, rate = null) {
  let targetUrl = audioUrl;

  const currentVoice = voice || (typeof window !== 'undefined' ? localStorage.getItem('mediguard_voice') : null) || 'vi-VN-HoaiMyNeural';
  const currentRate = rate || (typeof window !== 'undefined' ? localStorage.getItem('mediguard_rate') : null) || '-8%';

  // Nếu chưa có file âm thanh nhưng có text câu thoại, gọi backend Edge-TTS
  if (!targetUrl && fallbackText && fallbackText.trim()) {
    try {
      const data = await speakText(fallbackText.trim(), currentVoice, currentRate);
      if (data && data.audio_url) {
        targetUrl = data.audio_url;
      }
    } catch (e) {
      console.warn('Lỗi gọi API /api/voice/speak:', e);
    }
  }

  // Nếu đã có file âm thanh từ Edge-TTS
  if (targetUrl) {
    const fullUrl = targetUrl.startsWith('http')
      ? targetUrl
      : `${API_BASE || ''}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

    // Cách 1: Phát bằng HTML5 Audio (nhanh nhất, ổn định nhất)
    const htmlSuccess = await playWithHtmlAudio(fullUrl);
    if (htmlSuccess) return true;

    // Cách 2: Phát bằng Web Audio Buffer nếu context đang running
    const webSuccess = await playWithWebAudio(fullUrl);
    if (webSuccess) return true;
  }

  // Dự phòng cuối cùng: SpeechSynthesis của trình duyệt
  if (fallbackText && fallbackText.trim()) {
    return speakWithBrowser(fallbackText.trim());
  }

  return false;
}

/**
 * Phát qua HTML5 Audio Element dùng chung, có timeout chống treo UI
 */
function playWithHtmlAudio(url) {
  return new Promise((resolve) => {
    try {
      const audio = getSharedAudio();
      if (!audio) {
        resolve(false);
        return;
      }

      let finished = false;
      let timer = null;

      const cleanup = () => {
        if (!finished) {
          finished = true;
          if (timer) clearTimeout(timer);
          audio.onended = null;
          audio.onerror = null;
        }
      };

      // Giới hạn tối đa 12 giây cho một câu thoại, tự ngắt để tránh treo UI
      timer = setTimeout(() => {
        cleanup();
        resolve(true);
      }, 12000);

      audio.onended = () => {
        cleanup();
        resolve(true);
      };

      audio.onerror = (e) => {
        cleanup();
        console.warn('HTMLAudio onerror:', e);
        resolve(false);
      };

      audio.src = url;
      audio.currentTime = 0;

      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          cleanup();
          console.warn('HTMLAudio play() rejected:', err);
          resolve(false);
        });
      }
    } catch (err) {
      resolve(false);
    }
  });
}

/**
 * Phát qua Web Audio Buffer (chỉ chạy khi AudioContext đã 'running')
 */
async function playWithWebAudio(url) {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') {
    return false;
  }

  return new Promise(async (resolve) => {
    let timer = setTimeout(() => resolve(false), 12000);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        clearTimeout(timer);
        resolve(false);
        return;
      }
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await new Promise((resBuf, rejBuf) => {
        ctx.decodeAudioData(arrayBuffer, resBuf, rejBuf);
      });
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        clearTimeout(timer);
        resolve(true);
      };
      source.start(0);
    } catch (e) {
      clearTimeout(timer);
      console.warn('Web Audio playback failed:', e);
      resolve(false);
    }
  });
}

export function speakWithBrowser(text, rate = 0.85) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = rate;

      // Tìm kiếm giọng đọc tiếng Việt thực sự trong hệ thống
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(
        (v) => v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.toLowerCase().startsWith('vi')
      );

      // QUAN TRỌNG: Nếu máy tính không cài gói ngôn ngữ tiếng Việt (chỉ có Microsoft David/Zira en-US),
      // TUYỆT ĐỐI KHÔNG dùng giọng tiếng Anh để đọc tiếng Việt vì sẽ phát âm ngọng líu ngọng lô như người nước ngoài!
      if (!viVoice) {
        console.warn('Hệ thống không có voice tiếng Việt của trình duyệt, bỏ qua SpeechSynthesis.');
        resolve(false);
        return;
      }

      utterance.voice = viVoice;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Khởi tạo nhận diện giọng nói tiếng Việt trên trình duyệt (Web Speech API)
 */
export function createSpeechRecognizer(onResult, onError, onEnd) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Trình duyệt không hỗ trợ Web Speech API.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'vi-VN';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    try {
      const transcript = event.results[0][0].transcript;
      if (onResult) onResult(transcript);
    } catch (e) {
      console.warn('Lỗi xử lý kết quả nhận diện:', e);
    }
  };

  recognition.onerror = (event) => {
    console.warn('Sự kiện lỗi Web Speech:', event.error);
    if (onError) onError(event.error);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return recognition;
}
