# ==============================================================================
# MEDIGUARD CARE - TICKET DISPATCHER & REAL-TIME WEBSOCKET BROADCASTER
# Manages ticket lifecycle and broadcasts live alerts to nurse dashboards
# ==============================================================================

import logging
from typing import Dict, Any, List, Set
from datetime import datetime
from ...schemas.triage_schema import TriageLevel, TicketStatus

logger = logging.getLogger(__name__)


class TicketDispatcher:
    """
    Điều phối phân công phiếu cảnh báo y tế và phát sóng sự kiện thời gian thực (WebSockets/SSE)
    """

    def __init__(self):
        self.active_websockets: Set[Any] = set()

    def register_client(self, websocket: Any):
        self.active_websockets.add(websocket)
        logger.info(f"[WEBSOCKET] Client kết nối Dashboard mới. Tổng clients: {len(self.active_websockets)}")

    def unregister_client(self, websocket: Any):
        self.active_websockets.discard(websocket)
        logger.info(f"[WEBSOCKET] Client ngắt kết nối. Còn lại: {len(self.active_websockets)}")

    async def broadcast_ticket_event(self, event_type: str, ticket_data: Dict[str, Any]):
        """
        Bắn sự kiện cảnh báo tức thời tới màn hình Dashboard của Điều dưỡng & Bác sĩ
        """
        payload = {
            "event": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "ticket": ticket_data
        }

        logger.info(
            f"[DISPATCHER] Phát sóng sự kiện '{event_type}' cho phiếu {ticket_data.get('ticket_id')} "
            f"(Mức: {ticket_data.get('priority_level')})"
        )

        for client in list(self.active_websockets):
            try:
                await client.send_json(payload)
            except Exception as e:
                logger.error(f"[WEBSOCKET ERROR] Lỗi khi gửi event: {e}")
                self.active_websockets.discard(client)


ticket_dispatcher = TicketDispatcher()
