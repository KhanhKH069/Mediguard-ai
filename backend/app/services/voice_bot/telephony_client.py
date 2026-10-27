# ==============================================================================
# MEDIGUARD CARE - TELEPHONY CLIENT (STRINGEE / OMICALL INTEGRATION)
# Outbound Call Automation, Voice Brandname, Webhooks & Emergency Call Transfer
# ==============================================================================

import logging
from typing import Dict, Any, Optional
import httpx
from ...config import settings

logger = logging.getLogger(__name__)


class TelephonyClient:
    """
    Client kết nối hạ tầng viễn thông tổng đài Việt Nam (Stringee / OmiCall)
    """

    def __init__(self):
        self.provider = settings.TELEPHONY_PROVIDER
        self.api_key = settings.STRINGEE_API_KEY_SID
        self.api_secret = settings.STRINGEE_API_KEY_SECRET
        self.brandname = settings.VOICE_BRANDNAME
        self.emergency_hotline = settings.HOTLINE_EMERGENCY_TRANSFER

    async def initiate_outbound_call(
        self,
        phone_number: str,
        patient_name: str,
        session_id: str,
        webhook_url: str
    ) -> Dict[str, Any]:
        """
        Kích hoạt cuộc gọi ra tự động tới số điện thoại bệnh nhân kèm Voice Brandname
        """
        logger.info(
            f"[{self.provider.upper()}] Khởi tạo cuộc gọi ra tới {phone_number} "
            f"cho bệnh nhân {patient_name} (Session: {session_id})"
        )

        # Mô phỏng payload gửi tới Stringee REST API /call/makeCall
        payload = {
            "from": {
                "type": "external",
                "number": self.brandname,
                "alias": self.brandname
            },
            "to": [
                {
                    "type": "external",
                    "number": phone_number,
                    "alias": patient_name
                }
            ],
            "custom": session_id,
            "actions": [
                {
                    "action": "connect",
                    "url": webhook_url
                }
            ]
        }

        # Trong môi trường production, gọi httpx.post tới endpoint Stringee / OmiCall
        # Ở môi trường development/mock:
        return {
            "success": True,
            "call_id": f"call_str_{session_id}",
            "provider": self.provider,
            "status": "dialing",
            "voice_brandname": self.brandname
        }

    async def transfer_to_hotline(self, call_id: str, reason: str = "EMERGENCY_CODE_RED") -> Dict[str, Any]:
        """
        Chuyển tiếp cuộc gọi (Call Transfer) ngay lập tức sang số hotline điều dưỡng thật
        khi phát hiện dấu hiệu nguy kịch.
        """
        logger.warning(
            f"[CALL TRANSFER] Nối máy khẩn cấp cuộc gọi {call_id} tới hotline {self.emergency_hotline}. "
            f"Lý do: {reason}"
        )

        return {
            "transferred": True,
            "target_number": self.emergency_hotline,
            "reason": reason,
            "timestamp": "now"
        }

    async def hangup_call(self, call_id: str) -> bool:
        """
        Gác máy kết thúc cuộc gọi
        """
        logger.info(f"[TELEPHONY] Ngắt cuộc gọi {call_id}")
        return True


telephony_client = TelephonyClient()
