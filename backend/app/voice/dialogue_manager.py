"""
MediGuard AI - Dialogue Manager (Kịch bản câu thoại chuẩn hóa)
Ngôn ngữ tôn kính, ấm áp, rõ ràng, phù hợp tuyệt đối với tâm lý người cao tuổi Việt Nam.
"""
import re

# ----------------------------------------------------------------------
# Xưng hô
# ----------------------------------------------------------------------
HONORIFICS = {
    "bác": "Bác", "ông": "Ông", "bà": "Bà", "cô": "Cô", "chú": "Chú",
    "dì": "Dì", "cụ": "Cụ", "cậu": "Cậu", "thím": "Thím", "mợ": "Mợ",
}
DEFAULT_HONORIFIC = "Bác"


def format_elder_address(elder_name: str) -> str:
    """
    Chuyển tên đầy đủ trong DB thành cách gọi tự nhiên khi nói.
      "Bác Nguyễn Văn Ba (72 tuổi)" -> "Bác Ba"
      "Nguyễn Văn Ba"               -> "Bác Ba"   (mặc định "Bác")
      "Bà Lan"                      -> "Bà Lan"
      "" / None                     -> "Bác"
    Hàm này idempotent: truyền "Bác Ba" vào vẫn ra "Bác Ba", nên dù nơi gọi
    truyền full_name hay tên rút gọn thì câu thoại (và file audio cache) vẫn giống nhau.
    Lưu ý: hệ thống chưa có trường giới tính/xưng hô, nên nếu tên không có
    sẵn "Bà/Ông/Cô/Chú..." thì sẽ gọi là "Bác".
    """
    name = re.sub(r"\([^)]*\)", " ", elder_name or "")
    tokens = [t.strip(",.;:") for t in name.split()]
    tokens = [t for t in tokens if t]

    honorific = DEFAULT_HONORIFIC
    if tokens and tokens[0].lower() in HONORIFICS:
        honorific = HONORIFICS[tokens[0].lower()]
        tokens = tokens[1:]

    if not tokens:
        return honorific
    return f"{honorific} {tokens[-1]}"


# ----------------------------------------------------------------------
# Chuẩn hóa văn bản trước khi đọc (chỉ dùng cho TTS, không đổi chữ hiển thị)
# ----------------------------------------------------------------------
_NUM = r"(\d+(?:[.,]\d+)?)"
_UNIT_RULES = [
    (re.compile(_NUM + r"\s*mcg\b", re.IGNORECASE), "mi crô gam"),
    (re.compile(_NUM + r"\s*mg\b", re.IGNORECASE), "mi li gam"),
    (re.compile(_NUM + r"\s*ml\b", re.IGNORECASE), "mi li lít"),
    (re.compile(_NUM + r"\s*g\b", re.IGNORECASE), "gam"),
]

# Chỗ để thêm cách đọc riêng cho tên thuốc nếu giọng đọc phát âm sai.
# Ví dụ: {"Ginkgo Biloba": "Ginh cô Bi lô ba"}  (hãy nghe thử rồi tự chỉnh)
SPEECH_REPLACEMENTS: dict[str, str] = {}


def normalize_for_speech(text: str) -> str:
    """
    Đọc rõ liều lượng: "5mg" -> "5 mi li gam", "0.5mg" -> "0,5 mi li gam".
    Tránh việc giọng đọc đọc "5mg" thành "năm m g" hoặc nuốt mất đơn vị.
    """
    def _fix(unit_words: str):
        def repl(m: re.Match) -> str:
            return f"{m.group(1).replace('.', ',')} {unit_words}"
        return repl

    for pattern, words in _UNIT_RULES:
        text = pattern.sub(_fix(words), text)

    for src, dst in SPEECH_REPLACEMENTS.items():
        text = text.replace(src, dst)
    return text


# ----------------------------------------------------------------------
# Câu thoại
# ----------------------------------------------------------------------
def _period(time_period: str) -> str:
    return (time_period or "").strip().lower()


def get_reminder_dialogue(elder_name: str, time_period: str, medication_names: list[str]) -> str:
    """
    Lời nhắc uống thuốc theo lịch đã được gia đình xác nhận.
    """
    name = format_elder_address(elder_name)
    p = _period(time_period)
    period_text = f" buổi {p}" if p else ""

    # AN TOÀN: không bảo bác uống thuốc chung chung khi không có thuốc nào được xác minh
    if not medication_names:
        return (
            f"Kính chào {name}! Đã đến giờ nhắc thuốc{period_text} rồi ạ. "
            f"Nhưng hiện chưa có thuốc nào được gia đình xác minh cho cữ này. "
            f"Bác đừng tự uống thuốc, bác vui lòng hỏi người nhà trước nhé!"
        )

    meds_text = ", ".join(medication_names)
    return (
        f"Kính chào {name}! Đã đến giờ dùng thuốc{period_text} rồi ạ. "
        f"Theo lịch đã được gia đình xác minh, cữ này của bác gồm có: {meds_text}. "
        f"Bác vui lòng lấy đúng ngăn thuốc đã chuẩn bị và uống kèm nước ấm nhé!"
    )


def get_intake_confirmed_dialogue(elder_name: str, time_period: str, medication_names: list[str]) -> str:
    """
    Câu xác nhận sau khi uống thuốc: ĐỌC ĐÚNG TÊN CÁC LOẠI THUỐC ĐÃ UỐNG.
    """
    name = format_elder_address(elder_name)
    p = _period(time_period)
    cu_text = f"cữ {p}" if p else "cữ này"

    if not medication_names:
        meds_text = "thuốc của cữ này"
    elif len(medication_names) == 1:
        meds_text = f"thuốc {medication_names[0]}"
    else:
        meds_text = "các loại thuốc: " + ", ".join(medication_names[:-1]) + " và " + medication_names[-1]

    return (
        f"Cháu đã ghi nhận! {name} vừa uống xong {meds_text} "
        f"của {cu_text} rồi ạ. "
        f"Cháu đã lưu lại lịch và gửi thông báo cho gia đình rồi. Bác nhớ uống đủ nước và yên tâm nghỉ ngơi nhé!"
    )


def get_unsure_dialogue(elder_name: str) -> str:
    name = format_elder_address(elder_name)
    return (
        f"Dạ {name} yên tâm nhé. Bác đừng tự đoán thuốc ạ. "
        f"Cháu đã gửi hình ảnh và thông báo cho người nhà kiểm tra lại ngay giúp bác rồi ạ!"
    )


def get_help_dialogue(elder_name: str) -> str:
    name = format_elder_address(elder_name)
    return (
        f"Dạ cháu đã tiếp nhận yêu cầu hỗ trợ của {name}. "
        f"Cháu đang gửi tin nhắn khẩn cấp cho gia đình để gọi điện ngay cho bác đây ạ!"
    )