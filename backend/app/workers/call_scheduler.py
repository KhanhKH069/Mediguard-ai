# ==============================================================================
# MEDIGUARD CARE - CALL SCHEDULER WORKER (CELERY)
# Automatically scans Day 1 / 3 / 7 cadence, sends ZNS 15m prior, triggers calls
# ==============================================================================

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from ..config import settings
from ..services.voice_bot.telephony_client import telephony_client
from ..services.voice_bot.zalo_zns_service import zalo_zns_service

logger = logging.getLogger(__name__)


class CallSchedulerWorker:
    """
    Worker quét lịch gọi tự động theo phác đồ hậu phẫu Ngày 1, 3, 7
    """

    async def scan_and_dispatch_calls(self):
        """
        Quét danh sách các ca đến lịch gọi trong khung giờ hiện tại
        """
        logger.info("[SCHEDULER] Bắt đầu quét lịch gọi tự động sau xuất viện...")

        # Giả lập 1 ca đến lịch gọi D+3
        mock_scheduled_patient = {
            "id": "PT-2026-0891",
            "full_name": "Nguyễn Văn Tuấn",
            "phone_number": "0912 345 678",
            "procedure_name": "Cắt túi mật nội soi",
            "current_day": "D+3"
        }

        # 1. Gửi tin nhắn Zalo ZNS báo trước 15 phút
        await zalo_zns_service.send_pre_call_notification(
            phone_number=mock_scheduled_patient["phone_number"],
            patient_name=mock_scheduled_patient["full_name"],
            call_time_str="09:00 sáng nay",
            procedure_name=mock_scheduled_patient["procedure_name"]
        )

        # 2. Khởi tạo cuộc gọi ra qua tổng đài
        call_res = await telephony_client.initiate_outbound_call(
            phone_number=mock_scheduled_patient["phone_number"],
            patient_name=mock_scheduled_patient["full_name"],
            session_id=f"sess_{mock_scheduled_patient['id']}_D3",
            webhook_url="https://api.mediguard.vn/api/v1/telephony/call-event"
        )

        logger.info(f"[SCHEDULER] Đã kích hoạt cuộc gọi: {call_res}")
        return {"dispatched_count": 1}


call_scheduler_worker = CallSchedulerWorker()
