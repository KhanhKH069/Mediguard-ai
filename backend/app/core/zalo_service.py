"""
MediGuard AI - Zalo OA (Official Account) & Zalo Mini App Service
Giai đoạn MVP: Tích hợp thông báo Zalo OA, gửi báo cáo cữ thuốc kèm ảnh chụp ngăn thuốc thẳng qua tin nhắn Zalo của con cái.
Hỗ trợ cả Zalo OpenAPI thực tế (khi có Token) và Mock Realtime Simulator cho trình diễn MVP.
"""

import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx

from app.config import STORAGE_DIR
from app.api.websocket import broadcast_sync

logger = logging.getLogger(__name__)

# File lưu trữ tin nhắn Zalo OA để không bị mất khi khởi động lại
ZALO_MESSAGES_FILE = STORAGE_DIR / "zalo_messages.json"

# Cấu hình Zalo OA từ môi trường
ZALO_OA_ID = os.getenv("ZALO_OA_ID", "382910482910482")
ZALO_APP_ID = os.getenv("ZALO_APP_ID", "482019284019284")
ZALO_ACCESS_TOKEN = os.getenv("ZALO_ACCESS_TOKEN", "")
DEFAULT_CAREGIVER_PHONE = os.getenv("DEFAULT_CAREGIVER_PHONE", "0987654321")


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ZaloService:
    def __init__(self):
        self._messages: List[Dict[str, Any]] = []
        self._load_messages()

    def _load_messages(self):
        """Nạp danh sách tin nhắn Zalo đã lưu từ storage."""
        if ZALO_MESSAGES_FILE.exists():
            try:
                with open(ZALO_MESSAGES_FILE, "r", encoding="utf-8") as f:
                    self._messages = json.load(f)
            except Exception as e:
                logger.warning(f"Không thể đọc zalo_messages.json: {e}")
                self._messages = []
        else:
            self._messages = self._create_sample_messages()
            self._save_messages()

    def _save_messages(self):
        """Lưu danh sách tin nhắn vào storage."""
        try:
            with open(ZALO_MESSAGES_FILE, "w", encoding="utf-8") as f:
                json.dump(self._messages, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Lỗi ghi zalo_messages.json: {e}")

    def _create_sample_messages(self) -> List[Dict[str, Any]]:
        """Dữ liệu mẫu ban đầu để giao diện Zalo OA luôn có sẵn thông tin trực quan sinh động."""
        now = datetime.now()
        today_morning = now.strftime("%Y-%m-%d 07:32:15")
        yesterday_evening = now.strftime("%Y-%m-%d 19:05:40")

        return [
            {
                "id": "zalo_msg_sample_01",
                "oa_name": "MediGuard AI - Chăm Sóc Cha Mẹ",
                "oa_avatar": "https://img.icons8.com/color/96/zalo.png",
                "recipient_phone": "0987654321",
                "recipient_name": "Nguyễn Văn Nam (Con trai)",
                "elder_name": "Bác Nguyễn Văn Ba (72 tuổi)",
                "elder_id": 1,
                "schedule_id": 1,
                "time_period": "Sáng",
                "target_time": "07:30",
                "event_type": "PILL_REPORT",
                "captured_image_url": "/storage/reference_images/ref_amlodipine.jpg",
                "reference_image_url": "/storage/reference_images/ref_amlodipine.jpg",
                "cv_status": "MATCHED",
                "confidence_score": 0.94,
                "elder_speech": "Dạ, Bác đã uống xong thuốc rồi con nhé!",
                "medications": ["Amlodipine 5mg", "Ginkgo Biloba 120mg"],
                "notes": "Điện thoại trên giá đỡ (Stand) tự động chụp & nhận diện giọng nói Bác.",
                "status": "DELIVERED",
                "caregiver_confirmed": True,
                "confirmed_at": today_morning,
                "timestamp": today_morning,
            },
            {
                "id": "zalo_msg_sample_02",
                "oa_name": "MediGuard AI - Chăm Sóc Cha Mẹ",
                "oa_avatar": "https://img.icons8.com/color/96/zalo.png",
                "recipient_phone": "0987654321",
                "recipient_name": "Nguyễn Văn Nam (Con trai)",
                "elder_name": "Bác Nguyễn Văn Ba (72 tuổi)",
                "elder_id": 1,
                "schedule_id": 2,
                "time_period": "Tối",
                "target_time": "19:00",
                "event_type": "PILL_REPORT",
                "captured_image_url": "/storage/reference_images/ref_redoxin.jpg",
                "reference_image_url": "/storage/reference_images/ref_redoxin.jpg",
                "cv_status": "MATCHED",
                "confidence_score": 0.91,
                "elder_speech": "Bác uống xong cữ tối rồi, chuẩn bị nghỉ ngơi.",
                "medications": ["Omeprazole 20mg"],
                "notes": "Hệ thống Zero-Touch ghi nhận đúng giờ.",
                "status": "DELIVERED",
                "caregiver_confirmed": True,
                "confirmed_at": yesterday_evening,
                "timestamp": yesterday_evening,
            }
        ]

    def get_messages(self, elder_id: Optional[int] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Lấy danh sách tin nhắn Zalo OA, mới nhất lên đầu."""
        msgs = self._messages
        if elder_id:
            msgs = [m for m in msgs if m.get("elder_id") == elder_id]
        return sorted(msgs, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]

    async def send_pill_report(
        self,
        elder_name: str,
        elder_id: int,
        schedule_id: Optional[int],
        time_period: str,
        target_time: str,
        medications: List[str],
        captured_image_url: Optional[str] = None,
        reference_image_url: Optional[str] = None,
        cv_status: str = "MATCHED",
        confidence_score: float = 0.92,
        elder_speech: Optional[str] = None,
        notes: Optional[str] = None,
        recipient_phone: Optional[str] = None,
        recipient_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Tạo và gửi báo cáo cữ thuốc kèm ảnh chụp ngăn thuốc thẳng qua tin nhắn Zalo OA.
        Tự động broadcast qua WebSocket tới Zalo Mini App và Chat UI.
        """
        import uuid
        msg_id = f"zalo_msg_{uuid.uuid4().hex[:10]}"
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Chuẩn hóa ảnh chụp (nếu chưa có thì dùng ảnh demo)
        cap_img = captured_image_url
        if not cap_img:
            cap_img = "/storage/reference_images/ref_amlodipine.jpg"

        ref_img = reference_image_url
        if not ref_img:
            ref_img = "/storage/reference_images/ref_amlodipine.jpg"

        message = {
            "id": msg_id,
            "oa_name": "MediGuard AI - Chăm Sóc Cha Mẹ",
            "oa_avatar": "https://img.icons8.com/color/96/zalo.png",
            "recipient_phone": recipient_phone or DEFAULT_CAREGIVER_PHONE,
            "recipient_name": recipient_name or "Nguyễn Văn Nam (Con trai)",
            "elder_name": elder_name,
            "elder_id": elder_id,
            "schedule_id": schedule_id,
            "time_period": time_period,
            "target_time": target_time,
            "event_type": "PILL_REPORT",
            "captured_image_url": cap_img,
            "reference_image_url": ref_img,
            "cv_status": cv_status,
            "confidence_score": round(confidence_score, 2),
            "elder_speech": elder_speech or "Dạ, Bác đã uống xong thuốc rồi con nhé!",
            "medications": medications,
            "notes": notes or "Điện thoại trên giá đỡ (Stand) tự động chụp & đối chiếu theo mẫu con đã chia.",
            "status": "DELIVERED",
            "caregiver_confirmed": False,
            "confirmed_at": None,
            "timestamp": now_str,
        }

        # Lưu vào danh sách tin nhắn
        self._messages.insert(0, message)
        # Giữ tối đa 100 tin nhắn gần nhất
        if len(self._messages) > 100:
            self._messages = self._messages[:100]
        self._save_messages()

        # Phát thông báo WebSocket để giao diện Zalo Mini App cập nhật tức thì
        broadcast_sync("zalo_message_sent", message)

        logger.info(
            f"[ZALO OA] Đã gửi báo cáo kèm ảnh cữ {time_period} của {elder_name} "
            f"đến Zalo con cái ({message['recipient_phone']}). Ảnh: {cap_img}"
        )

        # Nếu có Zalo OpenAPI Token thật, gọi API Zalo OpenAPI v3
        if ZALO_ACCESS_TOKEN:
            try:
                await self._call_zalo_openapi(message)
            except Exception as ex:
                logger.warning(f"Lỗi gửi qua Zalo OpenAPI chính thức: {ex}")

        return message

    async def confirm_message(self, message_id: str, caregiver_name: str = "Nguyễn Văn Nam") -> bool:
        """Con cái bấm nút 'Xác nhận an tâm' ngay trên tin nhắn Zalo."""
        for m in self._messages:
            if m["id"] == message_id:
                m["caregiver_confirmed"] = True
                m["confirmed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                m["notes"] = f"{m.get('notes', '')} • Con ({caregiver_name}) đã bấm xác nhận an tâm qua Zalo."
                self._save_messages()
                broadcast_sync("zalo_message_confirmed", {"message_id": message_id, "confirmed_at": m["confirmed_at"]})
                return True
        return False

    async def _call_zalo_openapi(self, message: Dict[str, Any]):
        """Gửi tin nhắn qua Zalo Official Account OpenAPI v3."""
        endpoint = "https://openapi.zalo.me/v3.0/oa/message/cs"
        headers = {
            "access_token": ZALO_ACCESS_TOKEN,
            "Content-Type": "application/json"
        }
        # Cấu hình payload tin nhắn Zalo OA
        payload = {
            "recipient": {
                "user_id": ZALO_OA_ID
            },
            "message": {
                "text": f"🔔 [BÁO CÁO CỰC NHANH - CỮ {message['time_period'].upper()}]\n"
                        f"Bác {message['elder_name']} đã được camera giá đỡ tự động ghi nhận.\n"
                        f"• Thuốc: {', '.join(message['medications'])}\n"
                        f"• Độ tin cậy AI: {int(message['confidence_score'] * 100)}%\n"
                        f"• Phản hồi: \"{message['elder_speech']}\"\n\n"
                        f"👉 Mở Zalo Mini App để xem ảnh chụp ngăn thuốc đối chiếu trực tiếp!"
            }
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            logger.info(f"Zalo OpenAPI Response: status={resp.status_code}, data={resp.text}")


# Singleton instance
zalo_service = ZaloService()
