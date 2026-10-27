# ==============================================================================
# MEDIGUARD CARE - SLA MONITOR & ESCALATION SERVICE
# Monitors resolution deadlines and triggers automated escalation on breach
# ==============================================================================

import logging
from typing import List, Dict, Any
from datetime import datetime
from ...schemas.triage_schema import TriageLevel, TicketStatus

logger = logging.getLogger(__name__)


class SlaMonitor:
    """
    Giám sát thời hạn xử lý phiếu Triage theo cam kết chất lượng điều trị (SLA)
    """

    @staticmethod
    def calculate_remaining_minutes(deadline: datetime) -> int:
        now = datetime.utcnow()
        delta = deadline - now
        return int(delta.total_seconds() / 60)

    @staticmethod
    def check_and_escalate_tickets(open_tickets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Quét danh sách các ca chưa xử lý, nếu vượt quá thời hạn cam kết
        thì tự động leo thang (Escalate) tới Trưởng khoa.
        """
        escalated_list = []
        now = datetime.utcnow()

        for ticket in open_tickets:
            if ticket.get("status") in [TicketStatus.RESOLVED.value, TicketStatus.ESCALATED.value]:
                continue

            deadline = ticket.get("sla_deadline")
            if deadline and now > deadline:
                logger.warning(
                    f"[SLA BREACH] Phiếu {ticket.get('ticket_id')} (Mức: {ticket.get('priority_level')}) "
                    f"đã QUÁ HẠN {int((now - deadline).total_seconds()/60)} phút! Tự động gửi SMS tới Bác sĩ Trưởng khoa."
                )
                ticket["status"] = TicketStatus.ESCALATED.value
                ticket["is_sla_breached"] = 1
                escalated_list.append(ticket)

        return escalated_list


sla_monitor = SlaMonitor()
