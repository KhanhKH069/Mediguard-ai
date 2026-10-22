import httpx
import logging
from app.config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)

async def send_telegram_alert(message: str) -> bool:
    """
    Gửi cảnh báo đến nhóm chat hoặc tài khoản Telegram của Người chăm sóc.
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID. Bỏ qua gửi thông báo Telegram.")
        print(f"[GIẢ LẬP THÔNG BÁO TELEGRAM]: {message}")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": f"🚨 [CẢNH BÁO MEDIGUARD AI]\n\n{message}",
        "parse_mode": "HTML"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                logger.info("Đã gửi cảnh báo Telegram thành công.")
                return True
            else:
                logger.error(f"Lỗi gửi Telegram: {res.text}")
                return False
    except Exception as e:
        logger.error(f"Ngoại lệ khi gửi cảnh báo Telegram: {e}")
        return False
