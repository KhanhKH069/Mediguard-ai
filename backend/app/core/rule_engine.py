"""
MediGuard AI - Safety Rule Engine (Bộ quy tắc an toàn cốt lõi)
Nhiệm vụ sống còn:
1. Phân loại ý định người dùng.
2. CHẶN ĐỨNG các yêu cầu nguy hiểm: 'uống bù', 'uống gấp đôi', 'tăng liều', 'bỏ cữ'.
3. Phát hiện triệu chứng cấp tính ('đau bụng', 'chóng mặt', 'nôn mửa') để báo người nhà.
4. Tuyệt đối không cho phép AI tự suy đoán hay đưa ra lời khuyên y tế.
"""

# Danh sách cụm từ nguy hiểm và lý do từ chối
FORBIDDEN_PATTERNS = [
    ("uống bù", "Việc uống bù liều đã quên cần có chỉ định của bác sĩ hoặc sự đồng ý từ người nhà."),
    ("gấp đôi", "Tuyệt đối không tự ý uống gấp đôi liều thuốc vì có thể gây ngộ độc hoặc hạ huyết áp quá mức."),
    ("uống gấp đôi", "Tuyệt đối không tự ý uống gấp đôi liều thuốc vì có thể gây ngộ độc hoặc hạ huyết áp quá mức."),
    ("tăng liều", "Người dùng không được tự ý tăng liều thuốc."),
    ("bỏ cữ", "Không nên tự ý bỏ cữ thuốc điều trị khi chưa hỏi ý kiến chuyên môn."),
    ("uống thêm", "Không được tự ý uống thêm thuốc ngoài đơn đã xác nhận.")
]

SYMPTOM_PATTERNS = [
    ("đau đầu", "Bác đang cảm thấy đau đầu"),
    ("nhức đầu", "Bác đang cảm thấy nhức đầu"),
    ("chóng mặt", "Bác đang cảm thấy chóng mặt, hoa mắt"),
    ("hoa mắt", "Bác đang cảm thấy hoa mắt, chóng mặt"),
    ("choáng váng", "Bác đang cảm thấy choáng váng"),
    ("đau bụng", "Bác đang có triệu chứng đau bụng"),
    ("quặn bụng", "Bác đang có triệu chứng đau quặn bụng"),
    ("buồn nôn", "Bác đang có triệu chứng buồn nôn"),
    ("khó thở", "Bác đang cảm thấy khó thở, hụt hơi"),
    ("tức ngực", "Bác đang cảm thấy tức ngực khó chịu"),
    ("đau ngực", "Bác đang cảm thấy đau thắt ngực"),
    ("đau thắt ngực", "Bác đang cảm thấy đau thắt ngực"),
    ("té ngã", "Bác vừa bị té ngã"),
    ("ngã", "Bác vừa bị ngã"),
    ("tim đập nhanh", "Bác cảm thấy hồi hộp, tim đập nhanh"),
    ("uống nhầm", "Bác báo có thể đã uống nhầm thuốc"),
    ("mệt quá", "Bác đang cảm thấy rất mệt trong người"),
    ("mệt trong người", "Bác đang cảm thấy mệt mỏi trong người"),
    ("mệt mỏi", "Bác đang cảm thấy mệt mỏi bất thường"),
    ("thấy mệt", "Bác đang cảm thấy mệt trong người"),
    ("mệt", "Bác đang cảm thấy mệt mỏi trong người"),
    ("sốt", "Bác đang bị sốt, người nóng ran"),
    ("nóng sốt", "Bác đang bị nóng sốt bất thường"),
    ("đau lưng", "Bác đang cảm thấy đau nhức lưng"),
    ("nhức mỏi", "Bác đang cảm thấy nhức mỏi cơ thể")
]

def evaluate_safety_and_intent(user_text: str) -> dict:
    """
    Phân tích câu nói của người cao tuổi và trả về đánh giá an toàn.
    """
    text_clean = user_text.lower().strip()

    # 1. Kiểm tra các cụm từ bị CẤM (đổi liều, uống bù, tăng liều)
    for pattern, reason in FORBIDDEN_PATTERNS:
        if pattern in text_clean:
            return {
                "is_safe": False,
                "intent": "DANGEROUS_REQUEST",
                "pattern_matched": pattern,
                "warning_reason": reason,
                "action": "REJECT_AND_NOTIFY_CAREGIVER",
                "reply_speech": (
                    f"Dạ thưa Bác, Bác tuyệt đối đừng tự ý thay đổi liều lượng thuốc nhé ạ. {reason} "
                    f"Cháu đang gửi thông báo cho người nhà để kiểm tra và gọi điện hỗ trợ Bác ngay đây ạ!"
                )
            }

    # 2. Kiểm tra các triệu chứng cấp tính
    for symptom, desc in SYMPTOM_PATTERNS:
        if symptom in text_clean:
            return {
                "is_safe": False,
                "intent": "REPORT_SYMPTOM",
                "pattern_matched": symptom,
                "warning_reason": desc,
                "action": "EMERGENCY_ALERT",
                "reply_speech": (
                    f"Dạ thưa Bác, cháu đã ghi nhận {desc}. Bác vui lòng ngồi nghỉ ngơi tại chỗ, uống nước ấm và giữ bình tĩnh nhé ạ, "
                    f"cháu đang báo ngay cho gia đình để liên hệ với Bác ạ!"
                )
            }

    # 3. Phân loại ý định xác nhận uống thuốc (CONFIRM_INTAKE)
    intake_keywords = [
        "uống rồi", "đã uống", "uống xong", "đã nghe", "nghe rồi", 
        "uống thuốc rồi", "nghe nhắc", "uống cữ", "uống hết", "uống thuốc cữ",
        "bác uống rồi", "tôi uống rồi", "xong cữ", "bác đã uống", "cháu ơi bác uống",
        "tao uống rồi", "uống rồi nhé", "vừa uống xong"
    ]
    is_intake = (
        any(k in text_clean for k in intake_keywords) or
        ("uống" in text_clean and any(r in text_clean for r in ["rồi", "xong", "hết", "cữ sáng", "cữ trưa", "cữ tối"]))
    )
    if is_intake:
        return {
            "is_safe": True,
            "intent": "CONFIRM_INTAKE",
            "pattern_matched": None,
            "warning_reason": None,
            "action": "RECORD_INTAKE",
            "reply_speech": (
                "Dạ thưa Bác, cháu đã ghi nhận Bác vừa uống thuốc xong rồi ạ! "
                "Cháu đã cập nhật nhật ký và gửi thông báo an tâm cho con cháu trong gia đình. "
                "Bác nhớ uống đủ nước ấm và nghỉ ngơi thật thoải mái nhé ạ!"
            )
        }

    # 4. Ý định hỏi về thuốc trong ngày & việc cần làm hôm nay (INQUIRE_MEDICATION)
    if any(k in text_clean for k in ["thuốc gì", "mấy viên", "uống thế nào", "cữ này", "lịch thuốc", "những thuốc gì", "mấy giờ uống", "khi nào uống", "làm gì", "cần làm gì", "phải làm gì", "việc hôm nay", "hôm nay có việc gì"]):
        return {
            "is_safe": True,
            "intent": "INQUIRE_MEDICATION",
            "pattern_matched": None,
            "warning_reason": None,
            "action": "READ_SCHEDULE",
            "reply_speech": (
                "Dạ thưa Bác, hôm nay việc quan trọng của Bác là uống một ly nước ấm, đo huyết áp và ăn sáng thanh đạm ạ. "
                "Cữ sáng nay Bác có thuốc huyết áp Amlodipine 5mg và thuốc bổ não Ginkgo Biloba 120mg, "
                "uống sau bữa ăn sáng cùng nước lọc ấm Bác nhé ạ!"
            )
        }

    # 5. Ý định chào hỏi & xưng hô thân mật (GREETING)
    if any(k in text_clean for k in ["chào cháu", "xin chào", "cháu ơi", "alo", "bác chào cháu", "chào em", "ơi cháu", "cháu có nghe không", "có ai không", "bác đây", "ông đây", "bà đây"]):
        return {
            "is_safe": True,
            "intent": "GREETING",
            "pattern_matched": None,
            "warning_reason": None,
            "action": "SAFE_GENERAL_REPLY",
            "reply_speech": "Dạ, cháu chào Bác ạ! Cháu là trợ lý nhắc thuốc MediGuard AI luôn túc trực bên Bác đây. Hôm nay Bác cảm thấy trong người thế nào ạ?"
        }

    # 6. Ý định hỏi danh tính & chức năng (IDENTITY)
    if any(k in text_clean for k in ["cháu là ai", "cháu tên gì", "tên là gì", "đây là app gì", "cháu làm được gì", "giúp bác cái gì"]):
        return {
            "is_safe": True,
            "intent": "IDENTITY",
            "pattern_matched": None,
            "warning_reason": None,
            "action": "SAFE_GENERAL_REPLY",
            "reply_speech": "Dạ, cháu là Trợ lý Y tế MediGuard AI dành riêng cho Bác ạ! Cháu có thể nhắc Bác uống thuốc đúng giờ, đọc đơn thuốc và báo con cháu khi Bác cần hỗ trợ ạ."
        }

    # 7. Ý định cảm ơn & tạm biệt (GRATITUDE)
    if any(k in text_clean for k in ["cảm ơn", "cám ơn", "ngoan quá", "tốt lắm", "tạm biệt", "chúc ngủ ngon"]):
        return {
            "is_safe": True,
            "intent": "GRATITUDE",
            "pattern_matched": None,
            "warning_reason": None,
            "action": "SAFE_GENERAL_REPLY",
            "reply_speech": "Dạ không có gì đâu ạ! Được trò chuyện và chăm sóc sức khỏe cho Bác là niềm vui của cháu. Bác cần gì cứ gọi cháu nhé, chúc Bác luôn vui khỏe ạ!"
        }

    # 8. Ý định chưa chắc chắn
    if any(k in text_clean for k in ["chưa chắc", "không chắc", "thuốc lạ", "nhìn lạ", "quên mất"]):
        return {
            "is_safe": True,
            "intent": "UNSURE",
            "pattern_matched": None,
            "warning_reason": None,
            "action": "PROMPT_CAREGIVER_CHECK",
            "reply_speech": (
                "Dạ Bác đừng lo lắng nhé ạ. Nếu chưa chắc chắn, Bác cứ để nguyên vỉ thuốc tại khay, "
                "cháu sẽ báo cho người nhà kiểm tra lại giúp Bác ngay ạ."
            )
        }

    # 9. Ý định cần giúp đỡ
    if any(k in text_clean for k in ["cần giúp", "giúp bác", "cứu", "gọi con", "gọi người nhà"]):
        return {
            "is_safe": True,
            "intent": "NEED_HELP",
            "pattern_matched": None,
            "warning_reason": None,
            "action": "TRIGGER_HELP_ALERT",
            "reply_speech": "Dạ thưa Bác, cháu đã gửi thông báo yêu cầu trợ giúp khẩn cấp đến gia đình và con cháu của Bác rồi ạ."
        }

    # Mặc định: Giao tiếp bình thường
    return {
        "is_safe": True,
        "intent": "GENERAL_TALK",
        "pattern_matched": None,
        "warning_reason": None,
        "action": "SAFE_GENERAL_REPLY",
        "reply_speech": "Dạ cháu nghe đây ạ! Bác có muốn cháu đọc lại lịch uống thuốc hôm nay hay cần cháu giúp gì thêm không ạ?"
    }
