import asyncio
import hashlib
import logging
import os
import re
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import edge_tts

from app.config import AUDIO_CACHE_DIR, DEFAULT_VIETNAMESE_VOICE, DEFAULT_VOICE_RATE
from app.voice.dialogue_manager import (
    get_reminder_dialogue,
    get_intake_confirmed_dialogue,
    get_unsure_dialogue,
    get_help_dialogue,
    normalize_for_speech,
)

logger = logging.getLogger(__name__)

MIN_VALID_SIZE = 100          # byte; nhỏ hơn mức này coi như file lỗi
MAX_ATTEMPTS = 1              # Thử 1 lần, nếu mạng chậm/lỗi lập tức fallback sang giọng nữ Edge-TTS
TTS_TIMEOUT_SECONDS = 6.0     # Tối đa 6.0s để đảm bảo mạng tải đầy đủ dữ liệu âm thanh

# Mỗi câu thoại (theo tên file cache) có một lock riêng,
# tránh 2 yêu cầu cùng lúc cùng ghi một file.
_locks: dict[str, asyncio.Lock] = {}

VALID_VOICES = {"vi-VN-HoaiMyNeural", "vi-VN-Google"}
DEFAULT_VOICE_VOLUME = os.getenv("MEDIGUARD_VOICE_VOLUME", "+0%")


def _fetch_google_tts_bytes(text: str) -> bytes:
    """Tải âm thanh chuẩn giọng Chị Google (Google Translate TTS tiếng Việt)."""
    clean = text.strip()
    if not clean:
        return b''

    # Tách thành các đoạn câu an toàn (< 140 ký tự) để Google Translate TTS không bao giờ bị lỗi 400
    words = clean.split()
    chunks = []
    curr = []
    curr_len = 0
    for w in words:
        if curr_len + len(w) + 1 <= 140:
            curr.append(w)
            curr_len += len(w) + 1
        else:
            if curr:
                chunks.append(" ".join(curr))
            curr = [w]
            curr_len = len(w)
    if curr:
        chunks.append(" ".join(curr))

    audio_data = b''
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    for c in chunks:
        q = urllib.parse.quote(c)
        url = f'https://translate.google.com/translate_tts?ie=UTF-8&q={q}&tl=vi&client=tw-ob'
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            audio_data += resp.read()
    return audio_data


async def fetch_google_tts(text: str) -> bytes:
    """Gọi tải Google TTS trong threadpool bất đồng bộ."""
    return await asyncio.to_thread(_fetch_google_tts_bytes, text)


def sanitize_tts_params(voice: str | None, rate: str | float | None, volume: str | None):
    """Đảm bảo voice luôn là Chị Google (hoặc nữ Hoài My), rate, volume luôn đúng định dạng chuỗi chuẩn."""
    if not voice:
        v = DEFAULT_VIETNAMESE_VOICE
    elif "hoai" in voice.lower():
        v = "vi-VN-HoaiMyNeural"
    else:
        # Mọi trường hợp khác (kể cả truyền nam hay rỗng) đều chuyển về Chị Google
        v = "vi-VN-Google"

    # Rate: edge-tts bắt buộc phải là chuỗi có định dạng phần trăm (VD: "-5%", "+0%")
    if isinstance(rate, (int, float)):
        pct = int((rate - 1.0) * 100) if rate != 1.0 else 0
        r = f"{pct:+d}%"
    elif isinstance(rate, str) and rate.endswith("%"):
        r = rate
    else:
        r = "+0%"

    # Volume: chuỗi phần trăm (VD: "+0%", "+50%")
    if isinstance(volume, str) and volume.endswith("%"):
        vol = volume
    else:
        vol = "+0%"

    return v, r, vol


def get_tts_filename(text: str, voice: str, rate: str = "+0%", volume: str = "+0%") -> tuple[str, Path]:
    """
    Tạo tên file dạng băm nhất quán theo nội dung văn bản, giọng đọc, tốc độ đọc và âm lượng.
    Giúp tái sử dụng file đã sinh (cache), không cần gọi lại Edge-TTS qua mạng.
    """
    hash_key = hashlib.md5(f"{voice}_{rate}_{volume}_{text.strip()}".encode("utf-8")).hexdigest()[:16]
    filename = f"tts_{hash_key}.mp3"
    filepath = AUDIO_CACHE_DIR / filename
    return filename, filepath


def _is_valid(path: Path) -> bool:
    try:
        return path.exists() and path.stat().st_size > MIN_VALID_SIZE
    except OSError:
        return False


def get_cached_tts(text: str, voice: str = None, rate: str = None, volume: str = None) -> str | None:
    """
    Kiểm tra nhanh xem câu thoại đã có file mp3 sẵn trong cache chưa (< 1ms).
    Nếu có trả về filename để client phát ngay lập tức không cần chờ mạng.
    """
    if not text or not text.strip():
        return None
    v, r, vol = sanitize_tts_params(
        voice or DEFAULT_VIETNAMESE_VOICE,
        rate or DEFAULT_VOICE_RATE,
        volume or DEFAULT_VOICE_VOLUME
    )
    clean_text = normalize_for_speech(text.strip())
    filename, filepath = get_tts_filename(clean_text, v, r, vol)
    if _is_valid(filepath):
        return filename
    return None


COMMON_VOICE_REPLIES = [
    "Dạ thưa Bác, cháu đã chuyển về Màn hình chính cho Bác rồi ạ!",
    "Dạ thưa Bác, cháu đã mở sổ Tra cứu thuốc cho Bác rồi ạ. Bác có thể tìm tên thuốc hoặc chụp ảnh vỏ hộp nhé!",
    "Dạ thưa Bác, cháu đã mở camera Soi kiểm tra thuốc cho Bác rồi ạ. Bác đưa khay thuốc trước máy nhé!",
    "Dạ thưa Bác, cháu đã mở sổ Báo triệu chứng sức khỏe cho Bác rồi ạ.",
    "Dạ, cháu đang ở đây trò chuyện cùng Bác đây ạ!",
    "Dạ thưa Bác, cháu đã ghi nhận Bác uống xong thuốc cữ này và gửi thông báo an tâm cho con cháu rồi ạ! Bác uống thêm chút nước ấm và nghỉ ngơi nhé.",
    "Dạ Bác cứ để nguyên khay thuốc ở đó, cháu đã nhắn các con kiểm tra lại giúp Bác rồi ạ.",
    "Dạ thưa Bác, cháu đã gửi tín hiệu khẩn cấp tới điện thoại của con cháu ngay lập tức rồi ạ! Bác giữ bình tĩnh và ngồi nghỉ ngơi tại chỗ nhé.",
    "Dạ cháu đã phóng to cỡ chữ cho Bác dễ nhìn hơn rồi ạ!",
    "Dạ cháu đã chỉnh cỡ chữ về mức vừa vặn cho Bác rồi ạ!",
    "Dạ cháu đã chuyển sang màn hình tối dịu mắt cho Bác rồi ạ.",
    "Dạ cháu đã chuyển sang màn hình sáng rõ nét cho Bác rồi ạ.",
    "Dạ, cháu đã dừng đọc rồi ạ.",
    "Dạ thưa Bác, Bác có thể nói: Về trang chủ, Tôi đã uống thuốc rồi, Đọc lịch thuốc, Tra cứu thuốc, Soi kiểm tra thuốc, Bác bị mệt, hoặc Chữ to hơn ạ!",
    "Dạ thưa Bác, cháu đang lắng nghe đây ạ. Bác chạm vào chiếc micro bên dưới hoặc chọn câu nói mẫu để trò chuyện cùng cháu nhé.",
    "Dạ cháu đã đổi sang giọng đọc Hoài My nhẹ nhàng, truyền cảm cho Bác rồi ạ.",
    "Dạ cháu đã đổi sang giọng đọc Nam Minh trầm ấm, rõ chữ cho Bác rồi ạ."
]


async def prewarm_common_voice_cache():
    """Tự động sinh trước tệp âm thanh giọng Chị Google cho các câu thoại chuẩn lúc khởi động hệ thống."""
    for voice in ("vi-VN-Google",):
        for text in COMMON_VOICE_REPLIES:
            try:
                if not get_cached_tts(text, voice=voice, rate="+0%"):
                    await text_to_speech(text, voice=voice, rate="+0%")
            except Exception as e:
                logger.warning(f"Lỗi prewarm TTS ({voice}): {e}")


async def text_to_speech(
    text: str,
    voice: str = None,
    rate: str | float = None,
    volume: str = None,
) -> str:
    """
    Sinh file âm thanh mp3 tiếng Việt từ văn bản bằng Edge-TTS.
    Có cache tự động: nếu câu thoại đã được tạo trước đó thì trả về ngay.
    Hỗ trợ chỉnh giọng (Nam/Nữ), tốc độ đọc chậm rãi và âm lượng khuếch đại to rõ cho người cao tuổi.
    """
    if not text or not text.strip():
        return ""

    voice, rate, volume = sanitize_tts_params(
        voice or DEFAULT_VIETNAMESE_VOICE,
        rate or DEFAULT_VOICE_RATE,
        volume or DEFAULT_VOICE_VOLUME
    )

    # Chuẩn hóa để đọc rõ liều lượng (5mg -> 5 mi li gam); cache băm theo văn bản đã chuẩn hóa
    clean_text = normalize_for_speech(text.strip())
    AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    filename, filepath = get_tts_filename(clean_text, voice, rate, volume)

    # Cache hit
    if _is_valid(filepath):
        return filename

    # File tồn tại nhưng quá nhỏ -> tàn dư của lần lỗi trước
    filepath.unlink(missing_ok=True)

    lock = _locks.setdefault(filename, asyncio.Lock())
    async with lock:
        # Có thể request khác đã sinh xong trong lúc mình chờ lock
        if _is_valid(filepath):
            return filename

        tmp_path = filepath.with_name(f"{filepath.stem}.{uuid.uuid4().hex[:8]}.tmp")

        # 1. Nếu người dùng chọn giọng Chị Google (Google Translate TTS tiếng Việt)
        if voice == "vi-VN-Google":
            try:
                audio_bytes = await fetch_google_tts(clean_text)
                if audio_bytes and len(audio_bytes) > MIN_VALID_SIZE:
                    tmp_path.write_bytes(audio_bytes)
                    os.replace(tmp_path, filepath)
                    return filename
                else:
                    logger.warning("Google TTS trả về dữ liệu rỗng hoặc quá nhỏ. Chuyển sang Edge-TTS.")
            except Exception as e:
                logger.warning("Lỗi tải giọng chị Google: %s. Fallback sang Edge-TTS", e)

            try:
                communicate = edge_tts.Communicate(text=clean_text, voice="vi-VN-HoaiMyNeural", rate=rate, volume=volume)
                await asyncio.wait_for(communicate.save(str(tmp_path)), timeout=TTS_TIMEOUT_SECONDS)
                if _is_valid(tmp_path):
                    os.replace(tmp_path, filepath)
                    return filename
            except Exception as edge_err:
                logger.warning("Edge-TTS fallback cũng gặp lỗi: %s", edge_err)
            finally:
                tmp_path.unlink(missing_ok=True)
            return ""

        # 2. Xử lý Edge-TTS với fallback tự động sang giọng chị Google
        for attempt in range(MAX_ATTEMPTS):
            try:
                communicate = edge_tts.Communicate(text=clean_text, voice=voice, rate=rate, volume=volume)
                await asyncio.wait_for(
                    communicate.save(str(tmp_path)),
                    timeout=TTS_TIMEOUT_SECONDS,
                )
                if _is_valid(tmp_path):
                    os.replace(tmp_path, filepath)  # atomic
                    return filename
            except Exception as e:
                # Nếu Edge-TTS gặp sự cố kết nối, tự động fallback sang giọng chị Google siêu ổn định
                try:
                    audio_bytes = await fetch_google_tts(clean_text)
                    if audio_bytes and len(audio_bytes) > MIN_VALID_SIZE:
                        tmp_path.write_bytes(audio_bytes)
                        os.replace(tmp_path, filepath)
                        return filename
                except Exception:
                    pass
                logger.warning("Edge-TTS lần thử %d gặp sự cố: %s", attempt + 1, e)
            finally:
                tmp_path.unlink(missing_ok=True)

    logger.error("Lỗi TTS không thể sinh file cho: '%s...'", clean_text[:40])
    return ""


async def generate_reminder_speech(
    elder_name: str, time_period: str, medication_names: list[str]
) -> tuple[str, str]:
    text = get_reminder_dialogue(elder_name, time_period, medication_names)
    audio_file = await text_to_speech(text)
    return audio_file, text


async def generate_confirmation_speech(
    elder_name: str, time_period: str, medication_names: list[str]
) -> tuple[str, str]:
    text = get_intake_confirmed_dialogue(elder_name, time_period, medication_names)
    audio_file = await text_to_speech(text)
    return audio_file, text


async def generate_unsure_speech(elder_name: str) -> tuple[str, str]:
    text = get_unsure_dialogue(elder_name)
    audio_file = await text_to_speech(text)
    return audio_file, text


async def generate_help_speech(elder_name: str) -> tuple[str, str]:
    text = get_help_dialogue(elder_name)
    audio_file = await text_to_speech(text)
    return audio_file, text