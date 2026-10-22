import asyncio
import hashlib
import logging
import os
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
MAX_ATTEMPTS = 1              # thử nhanh 1 lần, không lặp lại gây nghẽn
TTS_TIMEOUT_SECONDS = 3.5     # tối đa 3.5s để đảm bảo phản hồi tức thì cho người cao tuổi

# Mỗi câu thoại (theo tên file cache) có một lock riêng,
# tránh 2 yêu cầu cùng lúc cùng ghi một file.
_locks: dict[str, asyncio.Lock] = {}


def get_tts_filename(text: str, voice: str, rate: str = DEFAULT_VOICE_RATE) -> tuple[str, Path]:
    """
    Tạo tên file dạng băm nhất quán theo nội dung văn bản, giọng đọc và tốc độ đọc.
    Giúp tái sử dụng file đã sinh (cache), không cần gọi lại Edge-TTS qua mạng.
    """
    hash_key = hashlib.md5(f"{voice}_{rate}_{text.strip()}".encode("utf-8")).hexdigest()[:16]
    filename = f"tts_{hash_key}.mp3"
    filepath = AUDIO_CACHE_DIR / filename
    return filename, filepath


def _is_valid(path: Path) -> bool:
    try:
        return path.exists() and path.stat().st_size > MIN_VALID_SIZE
    except OSError:
        return False


async def text_to_speech(
    text: str,
    voice: str = DEFAULT_VIETNAMESE_VOICE,
    rate: str = DEFAULT_VOICE_RATE,
) -> str:
    """
    Sinh file âm thanh mp3 tiếng Việt từ văn bản bằng Edge-TTS.
    Có cache tự động: nếu câu thoại đã được tạo trước đó thì trả về ngay.
    Hỗ trợ chỉnh giọng (Nam/Nữ) và tốc độ đọc phù hợp cho người cao tuổi.
    """
    if not text or not text.strip():
        return ""

    # Chuẩn hóa để đọc rõ liều lượng (5mg -> 5 mi li gam); cache băm theo văn bản đã chuẩn hóa
    clean_text = normalize_for_speech(text.strip())
    AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    filename, filepath = get_tts_filename(clean_text, voice, rate)

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

        for attempt in range(MAX_ATTEMPTS):
            tmp_path = filepath.with_name(f"{filepath.stem}.{uuid.uuid4().hex[:8]}.tmp")
            try:
                communicate = edge_tts.Communicate(text=clean_text, voice=voice, rate=rate)
                await asyncio.wait_for(
                    communicate.save(str(tmp_path)),
                    timeout=TTS_TIMEOUT_SECONDS,
                )
                if _is_valid(tmp_path):
                    os.replace(tmp_path, filepath)  # atomic
                    return filename
            except Exception as e:
                # Nếu giọng đang dùng (ví dụ NamMinh) bị lỗi trên server Edge, lập tức thử giọng Hoài My siêu ổn định
                if voice != "vi-VN-HoaiMyNeural":
                    try:
                        fallback_comm = edge_tts.Communicate(text=clean_text, voice="vi-VN-HoaiMyNeural", rate=rate)
                        await asyncio.wait_for(
                            fallback_comm.save(str(tmp_path)),
                            timeout=TTS_TIMEOUT_SECONDS,
                        )
                        if _is_valid(tmp_path):
                            os.replace(tmp_path, filepath)
                            return filename
                    except Exception:
                        pass
                logger.warning("Edge-TTS lần thử %d gặp sự cố: %s", attempt + 1, e)
            finally:
                tmp_path.unlink(missing_ok=True)

    logger.error("Lỗi Edge-TTS không thể sinh file cho: '%s...'", clean_text[:40])
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