import os
from pathlib import Path
from dotenv import load_dotenv

# Tìm file .env ở thư mục gốc hoặc backend
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

dotenv_path = ROOT_DIR / ".env"
if not dotenv_path.exists():
    dotenv_path = BASE_DIR / ".env"
load_dotenv(dotenv_path)

# Cấu hình Thư mục lưu trữ
STORAGE_DIR = BASE_DIR / "storage"
AUDIO_CACHE_DIR = STORAGE_DIR / "audio_cache"
REF_IMAGES_DIR = STORAGE_DIR / "reference_images"
CAPTURED_IMAGES_DIR = STORAGE_DIR / "captured_images"

for d in [STORAGE_DIR, AUDIO_CACHE_DIR, REF_IMAGES_DIR, CAPTURED_IMAGES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Bảo mật & Mã PIN Kiosk
SECRET_KEY = os.getenv("SECRET_KEY", "mediguard-ai-super-secret-key-change-me-in-production-2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
CAREGIVER_PIN = os.getenv("CAREGIVER_PIN", "1234")

# Cơ sở dữ liệu
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'mediguard.db'}")

# Cảnh báo quá hạn
NO_RESPONSE_MINUTES = int(os.getenv("NO_RESPONSE_MINUTES", "15"))

# Telegram Bot
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# Voice mặc định (HoaiMy: tốc độ phản hồi cực nhanh ~0.7s, ổn định 100% không bị timeout)
DEFAULT_VIETNAMESE_VOICE = os.getenv("MEDIGUARD_VOICE", "vi-VN-HoaiMyNeural")
DEFAULT_VOICE_RATE = os.getenv("MEDIGUARD_VOICE_RATE", "-8%")
