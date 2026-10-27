// ==============================================================================
// MEDIGUARD AI - VOICE SERVICE (STT TRÌNH DUYỆT & EDGE-TTS TIẾNG VIỆT)
// ==============================================================================

import { getAudioContext, unlockAudioContext } from '../utils/soundEffects';
import { API_BASE, speakText } from './api';

let sharedAudio = null;
let currentActiveAudio = null;
let currentActiveWebSource = null;

function getSharedAudio() {
  if (!sharedAudio && typeof window !== 'undefined') {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

let activeUtterance = null;

/**
 * Dừng ngay lập tức mọi âm thanh đang phát (HTML5 Audio, Web Audio, SpeechSynthesis)
 */
export function stopAllSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  activeUtterance = null;
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch (e) {}
    currentActiveAudio = null;
  }
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    } catch (e) {}
  }
  if (currentActiveWebSource) {
    try {
      currentActiveWebSource.stop();
      currentActiveWebSource.disconnect();
    } catch (e) {}
    currentActiveWebSource = null;
  }
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

// Quản lý bộ giọng đọc trình duyệt chuẩn tiếng Việt
let cachedBrowserVoices = [];

function initBrowserVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    cachedBrowserVoices = window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        cachedBrowserVoices = window.speechSynthesis.getVoices();
      };
    }
  }
}
initBrowserVoices();

/**
 * Lấy giọng tiếng Việt tự nhiên và chuẩn nhất trên trình duyệt (Windows/Chrome/Edge)
 * Có hỗ trợ ưu tiên giọng Nữ (Hoài My) hoặc Nam (Nam Minh) theo lựa chọn của người dùng.
 */
export function getBestVietnameseVoice(preferredVoiceKey = 'vi-VN-Google') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (!cachedBrowserVoices.length) {
    cachedBrowserVoices = window.speechSynthesis.getVoices();
  }

  // 1. ƯU TIÊN TUYỆT ĐỐI: Giọng Google Tiếng Việt ("Chị Google" chính gốc quen thuộc)
  const googleVi = cachedBrowserVoices.find(
    (v) => (v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.toLowerCase().startsWith('vi')) &&
      v.name.toLowerCase().includes('google')
  );
  if (googleVi) return googleVi;

  const isMale = preferredVoiceKey && (preferredVoiceKey.includes('NamMinh') || preferredVoiceKey.toLowerCase().includes('nam') || preferredVoiceKey.toLowerCase().includes('male'));
  const isFemale = preferredVoiceKey && (preferredVoiceKey.includes('HoaiMy') || preferredVoiceKey.toLowerCase().includes('nu') || preferredVoiceKey.toLowerCase().includes('female'));

  if (isMale) {
    const maleVoice = cachedBrowserVoices.find(
      (v) => (v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.toLowerCase().startsWith('vi')) &&
        (v.name.toLowerCase().includes('namminh') || v.name.toLowerCase().includes('nam') || v.name.toLowerCase().includes('male'))
    );
    if (maleVoice) return maleVoice;
  }

  if (isFemale) {
    const femaleVoice = cachedBrowserVoices.find(
      (v) => (v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.toLowerCase().startsWith('vi')) &&
        (v.name.toLowerCase().includes('hoaimy') || v.name.toLowerCase().includes('female'))
    );
    if (femaleVoice) return femaleVoice;
  }

  // 1. Ưu tiên giọng Neural/Online tiếng Việt trong Edge/Windows (Hoài My, Nam Minh)
  const neuralVi = cachedBrowserVoices.find(
    (v) => (v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.toLowerCase().startsWith('vi')) &&
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online'))
  );
  if (neuralVi) return neuralVi;

  if (googleVi) return googleVi;

  // 3. Bất kỳ giọng nào hỗ trợ mã ngôn ngữ vi
  return cachedBrowserVoices.find(
    (v) => v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.toLowerCase().startsWith('vi')
  ) || null;
}

/**
 * Phát âm thanh giọng đọc tiếng Việt siêu tốc (< 50ms):
 * 1. Nếu có audioUrl (Edge-TTS đã cache), phát ngay bằng HTML5 Audio.
 * 2. Nếu chưa có audioUrl: Thử lấy file Edge-TTS trong tối đa 350ms (nếu server đã cache).
 * 3. Nếu server chưa cache hoặc mạng chậm: Phát NGAY LẬP TỨC bằng giọng đọc tiếng Việt của trình duyệt,
 *    không bắt người già phải chờ đợi trong im lặng. File Edge-TTS vẫn được tạo ngầm để cache cho lần sau!
 */
export async function playVoiceSpeech(audioUrl, fallbackText, voice = null, rate = null) {
  // Dừng mọi âm thanh cũ trước khi phát mới để chống nói đè/nói lặp
  stopAllSpeech();

  let targetUrl = audioUrl;

  // Luôn ưu tiên tuyệt đối giọng Chị Google (Google Translate TTS tiếng Việt)
  const storedVoice = typeof window !== 'undefined' ? localStorage.getItem('mediguard_voice') : null;
  const currentVoice = (voice && !voice.includes('NamMinh')) ? voice : (storedVoice && !storedVoice.includes('NamMinh') ? storedVoice : 'vi-VN-Google');
  if (typeof window !== 'undefined' && storedVoice && storedVoice.includes('NamMinh')) {
    localStorage.setItem('mediguard_voice', 'vi-VN-Google');
  }
  const currentRate = rate || (typeof window !== 'undefined' ? localStorage.getItem('mediguard_rate') : null) || '+0%';

  // 1. Nếu đã có sẵn audioUrl từ trước -> phát ngay lập tức
  if (targetUrl) {
    const fullUrl = targetUrl.startsWith('http')
      ? targetUrl
      : `${API_BASE || ''}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

    const played = await playAudioResource(fullUrl);
    if (played) return true;
  }

  // 2. Nếu chưa có audioUrl hoặc phát thất bại:
  if (fallbackText && fallbackText.trim()) {
    const cleanText = fallbackText.trim();

    // Luôn ưu tiên phát file âm thanh giọng Chị Google từ backend (chờ tối đa 8000ms để đảm bảo Google TTS tải xong)
    try {
      const fastFetch = speakText(cleanText, currentVoice, currentRate);
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
      const res = await Promise.race([fastFetch, timeoutPromise]);

      if (res && res.audio_url) {
        const fullUrl = res.audio_url.startsWith('http')
          ? res.audio_url
          : `${API_BASE || ''}${res.audio_url.startsWith('/') ? '' : '/'}${res.audio_url}`;
        const played = await playAudioResource(fullUrl);
        if (played) return true;
      }
    } catch (e) {
      // Bỏ qua lỗi và chuyển sang browser TTS tức thì nếu có
    }

    // 3. Fallback sang Web SpeechSynthesis CHỈ KHI máy có giọng tiếng Việt thực thụ (không bao giờ dùng Microsoft David)
    const numericRate = typeof currentRate === 'string' && currentRate.includes('-5%') ? 0.95 : 1.0;
    return await speakWithBrowser(cleanText, numericRate, currentVoice);
  }

  return false;
}

/**
 * Phát âm thanh với cơ chế dự phòng kép (Dual Pipeline):
 * 1. Thử HTML5 Audio Element (nhanh nhất).
 * 2. Nếu HTML5 Audio bị Mobile Safari/Chrome Autoplay chặn (hoặc lỗi), ngay lập tức
 *    phát qua Web Audio Buffer Context (đã mở khóa vĩnh viễn lúc chạm nút) + khuếch đại 1.8x.
 */
async function playAudioResource(url) {
  const htmlSuccess = await playWithHtmlAudio(url);
  if (htmlSuccess) return true;

  console.log('>>> HTML5 Audio không phát được (hoặc bị chặn Autoplay). Đang kích hoạt Web Audio Context...');
  const webSuccess = await playWithWebAudio(url);
  return webSuccess;
}

/**
 * Phát qua HTML5 Audio Element dùng chung, có timeout chống treo UI
 */
function playWithHtmlAudio(url) {
  return new Promise((resolve) => {
    try {
      // Ưu tiên dùng sharedAudio đã được mở khóa bằng gesture người dùng (unlockAllAudio)
      const audio = getSharedAudio() || new Audio();
      currentActiveAudio = audio;
      audio.preload = 'auto';
      audio.volume = 1.0; // Luôn giữ âm lượng tối đa 100%

      let finished = false;
      let timer = null;

      const cleanup = () => {
        if (!finished) {
          finished = true;
          if (timer) clearTimeout(timer);
          audio.onended = null;
          audio.onerror = null;
          if (currentActiveAudio === audio) {
            currentActiveAudio = null;
          }
        }
      };

      // Giới hạn tối đa 45 giây cho một câu thoại, tự ngắt để tránh treo UI
      timer = setTimeout(() => {
        cleanup();
        resolve(true);
      }, 45000);

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
      try {
        audio.load();
      } catch (e) {}

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
 * Phát qua Web Audio Buffer kết hợp GainNode khuếch đại âm lượng lên 1.8x (+180%) cho người cao tuổi
 */
async function playWithWebAudio(url) {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') {
    return false;
  }

  return new Promise((resolve) => {
    let timer = setTimeout(() => resolve(false), 45000);
    let source = null;

    (async () => {
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
        source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        currentActiveWebSource = source;

        // Bộ khuếch đại âm thanh GainNode tăng thêm 80% (1.8x) cho người cao tuổi nặng tai
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.8, ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.onended = () => {
          if (currentActiveWebSource === source) {
            currentActiveWebSource = null;
          }
          clearTimeout(timer);
          resolve(true);
        };
        source.start(0);
      } catch (e) {
        if (source && currentActiveWebSource === source) {
          currentActiveWebSource = null;
        }
        clearTimeout(timer);
        console.warn('Web Audio playback failed:', e);
        resolve(false);
      }
    })();
  });
}

export function speakWithBrowser(text, rate = 1.0, preferredVoiceKey = null) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      activeUtterance = utterance; // Giữ tham chiếu ngăn Garbage Collector ngắt lời giữa chừng
      utterance.lang = 'vi-VN';
      utterance.rate = typeof rate === 'number' ? rate : 1.0;
      utterance.pitch = 1.0;

      // Tìm kiếm giọng đọc tiếng Việt chuẩn nhất trong hệ thống
      const viVoice = getBestVietnameseVoice(preferredVoiceKey);

      // BẢO VỆ CHỐNG GIỌNG NAM TIẾNG ANH (Microsoft David / Mark):
      // Nếu Windows/trình duyệt không cài gói giọng tiếng Việt thực thụ (lang bắt đầu bằng 'vi'),
      // TUYỆT ĐỐI KHÔNG GỌI window.speechSynthesis.speak() vì Windows sẽ tự gán Microsoft David
      // phát âm tiếng Việt bằng giọng nam tiếng Anh kỳ dị khó nghe!
      if (!viVoice || !viVoice.lang.toLowerCase().startsWith('vi')) {
        console.warn('Hệ điều hành không có giọng tiếng Việt cục bộ (SpeechSynthesis). Chặn phát để tránh giọng tiếng Anh (David/Mark).');
        resolve(false);
        return;
      }

      utterance.voice = viVoice;

      let finished = false;
      let safetyTimer = null;

      const finish = (success) => {
        if (!finished) {
          finished = true;
          if (safetyTimer) clearTimeout(safetyTimer);
          activeUtterance = null;
          resolve(success);
        }
      };

      // Tự ngắt tối đa tính theo độ dài câu thoại để không bao giờ bị treo trạng thái
      safetyTimer = setTimeout(() => {
        finish(true);
      }, Math.max(3000, text.length * 150));

      utterance.onend = () => finish(true);
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        finish(false);
      };

      // Trễ 30ms trước khi speak để tránh bug cancel() của Chromium
      setTimeout(() => {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      }, 30);
    } catch (e) {
      activeUtterance = null;
      resolve(false);
    }
  });
}

/**
 * Khởi tạo nhận diện giọng nói tiếng Việt trên trình duyệt (Web Speech API)
 * Hỗ trợ options: { continuous, interimResults, lang }
 */
export function createSpeechRecognizer(onResult, onError, onEnd, options = {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Trình duyệt không hỗ trợ Web Speech API.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = options.lang || 'vi-VN';
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? false;

  recognition.onresult = (event) => {
    try {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }
      const full = (finalTranscript || interimTranscript || event.results[0][0].transcript || '').trim();
      if (onResult) onResult(full, Boolean(finalTranscript));
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
