# ==============================================================================
# MEDIGUARD CARE - DIALOG MANAGER (STATE MACHINE CONVERSATION CONTROLLER)
# Manages multi-turn clinical inquiry, identity verification, ambiguity clarification,
# and emergency handover to human clinical staff
# ==============================================================================

import logging
from typing import Dict, Any, List, Optional
from enum import Enum
from .telephony_client import telephony_client

logger = logging.getLogger(__name__)


class DialogState(str, Enum):
    INITIATED = "INITIATED"
    IDENTITY_VERIFICATION = "IDENTITY_VERIFICATION"
    PROTOCOL_INQUIRY = "PROTOCOL_INQUIRY"
    CLARIFICATION_LOOP = "CLARIFICATION_LOOP"
    CONCLUSION = "CONCLUSION"
    EMERGENCY_HANDOVER = "EMERGENCY_HANDOVER"
    COMPLETED = "COMPLETED"


class DialogManager:
    """
    Quản lý luồng đàm thoại lâm sàng thông minh theo máy trạng thái (State Machine)
    """

    CRITICAL_EMERGENCY_KEYWORDS = [
        "chảy máu ồ ạt", "máu phun", "băng huyết", "ra máu tươi đẫm",
        "khó thở", "thở không được", "tức nghẹn ngực", "đau thắt ngực",
        "ngất xỉu", "choáng ngất", "co giật"
    ]

    AMBIGUOUS_REPLY_PATTERNS = [
        "cũng bình thường", "hơi khó chịu", "thấy mệt mệt", "nói chung là ổn",
        "cũng tàm tạm", "hơi lạ lạ trong người", "không biết nữa"
    ]

    def __init__(self, patient_info: Dict[str, Any], protocol_questions: List[Dict[str, Any]]):
        self.patient = patient_info
        self.questions = protocol_questions
        self.current_state = DialogState.INITIATED
        self.current_question_index = 0
        self.clarification_attempts = 0
        self.transcript_history: List[Dict[str, Any]] = []

    def step_1_verify_identity(self) -> Dict[str, Any]:
        """
        Bước 1: Chào hỏi, thông báo cuộc gọi từ chương trình chăm sóc sau xuất viện,
        xác nhận người nghe là bệnh nhân hay người nhà trả lời thay.
        """
        self.current_state = DialogState.IDENTITY_VERIFICATION

        greeting = (
            f"Dạ xin chào, tôi là MediGuard - Trợ lý AI theo dõi sức khỏe của Bệnh viện. "
            f"Tôi xin phép được liên hệ với bác {self.patient.get('full_name')} được không ạ?"
        )

        return {
            "state": self.current_state,
            "speak_text": greeting,
            "barge_in_enabled": True
        }

    def process_patient_reply(self, user_text: str) -> Dict[str, Any]:
        """
        Xử lý lời nói của bệnh nhân tại mỗi lượt thoại và điều hướng máy trạng thái
        """
        lower_text = user_text.lower().strip()
        self.transcript_history.append({"speaker": "patient", "text": user_text})

        # 1. KIỂM TRA TỪ KHÓA BÁO ĐỘNG ĐỎ KHẨN CẤP (EMERGENCY RED FLAGS)
        for red_kw in self.CRITICAL_EMERGENCY_KEYWORDS:
            if red_kw in lower_text:
                return self.step_4_emergency_handover(triggered_keyword=red_kw)

        # 2. XỬ LÝ THEO TRẠNG THÁI HIỆN TẠI
        if self.current_state == DialogState.IDENTITY_VERIFICATION:
            # Xác nhận người nghe
            if any(k in lower_text for k in ["tôi đây", "đúng rồi", "nghe đây", "vâng", "phải"]):
                self.current_state = DialogState.PROTOCOL_INQUIRY
                return self.step_2_ask_protocol_questions()
            elif any(k in lower_text for k in ["người nhà", "vợ", "chồng", "con gái", "con trai"]):
                self.current_state = DialogState.PROTOCOL_INQUIRY
                intro_proxy = "Dạ chào bác, tôi xin phép được hỏi thăm tình trạng phục hồi của bệnh nhân qua bác nhé ạ."
                next_q = self.step_2_ask_protocol_questions()
                next_q["speak_text"] = f"{intro_proxy} {next_q['speak_text']}"
                return next_q
            else:
                return {
                    "state": self.current_state,
                    "speak_text": f"Dạ cho tôi xin hỏi đây có phải số máy của bác {self.patient.get('full_name')} không ạ?",
                    "barge_in_enabled": True
                }

        elif self.current_state == DialogState.PROTOCOL_INQUIRY:
            # Kiểm tra xem câu trả lời có quá mơ hồ không (Ambiguity Check)
            if self._is_ambiguous(lower_text) and self.clarification_attempts < 1:
                return self.step_3_clarification_loop(user_text)

            # Chuyển câu hỏi tiếp theo
            self.current_question_index += 1
            self.clarification_attempts = 0

            if self.current_question_index < len(self.questions):
                return self.step_2_ask_protocol_questions()
            else:
                return self.step_conclusion()

        elif self.current_state == DialogState.CLARIFICATION_LOOP:
            self.current_question_index += 1
            self.clarification_attempts = 0
            if self.current_question_index < len(self.questions):
                return self.step_2_ask_protocol_questions()
            else:
                return self.step_conclusion()

        return self.step_conclusion()

    def step_2_ask_protocol_questions(self) -> Dict[str, Any]:
        """
        Bước 2: Đọc câu hỏi ngắn gọn theo phác đồ Protocol của ngày tương ứng
        """
        current_q = self.questions[self.current_question_index]
        self.current_state = DialogState.PROTOCOL_INQUIRY

        self.transcript_history.append({"speaker": "ai", "text": current_q["text"]})

        return {
            "state": self.current_state,
            "speak_text": current_q["text"],
            "question_id": current_q["id"],
            "barge_in_enabled": True
        }

    def step_3_clarification_loop(self, vague_text: str) -> Dict[str, Any]:
        """
        Bước 3: Vòng lặp làm rõ nếu câu trả lời quá mơ hồ (tối đa hỏi lại 1 lần)
        """
        self.current_state = DialogState.CLARIFICATION_LOOP
        self.clarification_attempts += 1

        clarify_prompt = (
            "Dạ bác ơi, bác cho tôi hỏi rõ hơn một chút: hiện tại bác thấy khó chịu ở vị trí vết mổ "
            "hay người thấy sốt âm ấm mệt mỏi bên trong ạ?"
        )
        self.transcript_history.append({"speaker": "ai", "text": clarify_prompt})

        return {
            "state": self.current_state,
            "speak_text": clarify_prompt,
            "barge_in_enabled": True
        }

    def step_4_emergency_handover(self, triggered_keyword: str) -> Dict[str, Any]:
        """
        Bước 4: Ngắt kịch bản thường ngay lập tức khi phát hiện triệu chứng nguy kịch
        và chuyển tiếp cuộc gọi sang điều dưỡng trực.
        """
        self.current_state = DialogState.EMERGENCY_HANDOVER

        emergency_prompt = (
            "BÁC ƠI ĐÂY LÀ DẤU HIỆU CẦN ĐƯỢC XỬ LÝ KHẨN CẤP! Bác hãy ngồi hoặc nằm yên ngay tại chỗ, "
            "tôi đang chuyển máy trực tiếp tới Điều dưỡng trực cấp cứu của bệnh viện ngay bây giờ, "
            "bác giữ máy nhé!"
        )

        logger.critical(f"[CODE RED TRIGGERED] Phát hiện triệu chứng khẩn cấp: '{triggered_keyword}'")

        # Gọi hàm chuyển tiếp cuộc gọi của TelephonyClient
        return {
            "state": self.current_state,
            "speak_text": emergency_prompt,
            "trigger_call_transfer": True,
            "transfer_reason": f"Dấu hiệu nguy kịch: {triggered_keyword}",
            "barge_in_enabled": False
        }

    def step_conclusion(self) -> Dict[str, Any]:
        """
        Kết thúc cuộc gọi theo dõi, tóm tắt và cảm ơn
        """
        self.current_state = DialogState.COMPLETED
        closing_text = (
            "Dạ thông tin theo dõi của bác đã được ghi nhận đầy đủ vào hồ sơ bệnh án. "
            "Đội ngũ điều dưỡng sẽ xem xét và hỗ trợ nếu bác cần điều chỉnh. "
            "Bác nhớ uống đủ nước, nghỉ ngơi và uống thuốc đúng giờ. Chúc bác mau chóng bình phục ạ!"
        )
        self.transcript_history.append({"speaker": "ai", "text": closing_text})

        return {
            "state": self.current_state,
            "speak_text": closing_text,
            "is_call_finished": True
        }

    def _is_ambiguous(self, text: str) -> bool:
        return any(pat in text for pat in self.AMBIGUOUS_REPLY_PATTERNS)
