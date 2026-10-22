// ==============================================================================
// MEDIGUARD AI - SOUND EFFECTS (TẠO ÂM CHUÔNG TING-TING & MỞ KHÓA AUDIO CONTEXT)
// ==============================================================================

let sharedAudioCtx = null;

export function getAudioContext() {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  return sharedAudioCtx;
}

/**
 * Mở khóa AudioContext khi người dùng bấm nút "Bắt đầu" hoặc tương tác lần đầu
 * (Bắt buộc theo Web Autoplay Policy của Chrome/Edge/Safari).
 */
export async function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
      console.log('>>> AudioContext đã được mở khóa thành công!');
    } catch (e) {
      console.warn('Lỗi khi mở khóa AudioContext:', e);
    }
  }
  return ctx;
}

// Tự động lắng nghe lần click/chạm đầu tiên trên màn hình để mở khóa AudioContext
if (typeof window !== 'undefined') {
  const autoUnlockHandler = () => {
    unlockAudioContext();
    window.removeEventListener('click', autoUnlockHandler);
    window.removeEventListener('touchstart', autoUnlockHandler);
    window.removeEventListener('keydown', autoUnlockHandler);
  };
  window.addEventListener('click', autoUnlockHandler, { once: true, passive: true });
  window.addEventListener('touchstart', autoUnlockHandler, { once: true, passive: true });
  window.addEventListener('keydown', autoUnlockHandler, { once: true, passive: true });
}

/**
 * Phát tiếng chuông báo "Ting-ting 🔔" êm dịu, trong trẻo.
 * Tần số nốt Mi (659.25Hz) và Sol (783.99Hz), sóng sin không chát chúa.
 */
export function playChimeSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const notes = [659.25, 783.99]; // E5, G5
    notes.forEach((freq, index) => {
      const startTime = ctx.currentTime + index * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Fade-in nhẹ và fade-out mượt mà
      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.75);
    });
  } catch (err) {
    console.warn('Không thể phát âm chuông:', err);
  }
}
