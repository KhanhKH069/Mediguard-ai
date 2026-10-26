"""
MediGuard AI - Clinical Drug-Drug Interaction Checker (Bộ kiểm tra tương tác thuốc)
Nhiệm vụ:
1. Phát hiện các cặp thuốc tương tác bất lợi trong đơn thuốc của người cao tuổi.
2. Phân loại mức độ nghiêm trọng: HIGH (Nguy hiểm tính mạng), MODERATE (Cần thận trọng), INFO (Theo dõi).
3. Đưa ra khuyến cáo y tế rõ ràng, phù hợp cho người chăm sóc và gia đình.
"""

import re
import difflib
from typing import List, Dict, Any, Optional

# ======================================================================
# CƠ SỞ DỮ LIỆU TƯƠNG TÁC THUỐC LÂM SÀNG (Lão khoa & Nội khoa phổ biến)
# ======================================================================
INTERACTION_RULES = [
    # 1. Thuốc chống đông/kháng tiểu cầu + Thảo dược/thực phẩm chức năng hoạt huyết
    {
        "drugs": ["ginkgo biloba", "aspirin"],
        "severity": "HIGH",
        "title": "Tăng vọt nguy cơ xuất huyết não và dạ dày",
        "mechanism": "Ginkgo Biloba ức chế yếu tố hoạt hóa tiểu cầu (PAF), khi dùng chung với Aspirin (thuốc chống ngưng tập tiểu cầu) làm tăng nguy cơ chảy máu kéo dài, xuất huyết dưới màng cứng hoặc loét dạ dày xuất huyết.",
        "advice": "Cần tham khảo ý kiến bác sĩ điều trị trước khi dùng. Nếu bắt buộc phải dùng, cần theo dõi sát các dấu hiệu chảy máu chân răng, bầm tím dưới da hoặc phân đen."
    },
    {
        "drugs": ["ginkgo biloba", "warfarin"],
        "severity": "HIGH",
        "title": "Nguy cơ chảy máu nội tạng nghiêm trọng",
        "mechanism": "Ginkgo Biloba làm thay đổi chỉ số đông máu INR và làm tăng tác dụng chống đông của Warfarin.",
        "advice": "Tuyệt đối không tự ý dùng chung khi chưa có chỉ định của bác sĩ tim mạch."
    },
    {
        "drugs": ["ginkgo biloba", "clopidogrel"],
        "severity": "HIGH",
        "title": "Tăng nguy cơ xuất huyết",
        "mechanism": "Cả hai đều có tác dụng ức chế kết tập tiểu cầu, hiệp đồng làm kéo dài thời gian chảy máu.",
        "advice": "Khuyến cáo không tự ý bổ sung Ginkgo Biloba cho bệnh nhân đang đặt stent mạch vành uống Clopidogrel."
    },

    # 2. Hai hoặc nhiều thuốc hạ huyết áp (Hạ áp quá mức / tụt huyết áp tư thế)
    {
        "drugs": ["amlodipine", "losartan"],
        "severity": "MODERATE",
        "title": "Nguy cơ tụt huyết áp tư thế đứng ở người cao tuổi",
        "mechanism": "Sự kết hợp giữa thuốc chẹn kênh Canxi (Amlodipine) và chẹn thụ thể ARB (Losartan) có thể gây hạ huyết áp quá mức.",
        "advice": "Người cao tuổi nên đứng dậy từ từ khi thức dậy để tránh choáng váng, chóng mặt dẫn đến té ngã. Cần đo huyết áp hàng ngày."
    },
    {
        "drugs": ["amlodipine", "captopril"],
        "severity": "MODERATE",
        "title": "Tương tác hạ áp tăng cường",
        "mechanism": "Phối hợp chẹn kênh canxi và ức chế men chuyển có thể gây hạ áp quá đà nếu không điều chỉnh liều.",
        "advice": "Đo huyết áp trước khi uống thuốc và ghi chép nhật ký huyết áp."
    },
    {
        "drugs": ["amlodipine", "atenolol"],
        "severity": "MODERATE",
        "title": "Nguy cơ nhịp tim chậm và hạ huyết áp",
        "mechanism": "Atenolol (chẹn beta) làm chậm nhịp tim kết hợp Amlodipine làm giãn mạch.",
        "advice": "Theo dõi nhịp tim của bác, nếu nhịp tim dưới 50 lần/phút hoặc thấy mệt hụt hơi cần báo bác sĩ."
    },

    # 3. Thuốc dạ dày (PPI) + Thuốc chống đông Clopidogrel
    {
        "drugs": ["omeprazole", "clopidogrel"],
        "severity": "HIGH",
        "title": "Omeprazole làm mất tác dụng chống đông của Clopidogrel",
        "mechanism": "Omeprazole ức chế mạnh men gan CYP2C19, ngăn cản Clopidogrel chuyển hóa thành dạng có hoạt tính, làm tăng nguy cơ tắc mạch hoặc tái phát nhồi máu cơ tim.",
        "advice": "Khuyến cáo chuyển sang thuốc dạ dày khác ít tương tác hơn như Pantoprazole hoặc Famotidine theo chỉ định của bác sĩ."
    },

    # 4. Thuốc giảm đau kháng viêm NSAID + Thuốc huyết áp / Thuốc chống đông
    {
        "drugs": ["ibuprofen", "amlodipine"],
        "severity": "MODERATE",
        "title": "Ibuprofen làm giảm tác dụng của thuốc hạ huyết áp",
        "mechanism": "Các thuốc giảm đau chống viêm không steroid (NSAID) ức chế tổng hợp prostaglandin ở thận, gây giữ muối và nước, làm huyết áp tăng trở lại.",
        "advice": "Người cao tuổi tăng huyết áp nên hạn chế tự ý mua thuốc giảm đau NSAID; ưu tiên dùng Paracetamol khi cần giảm đau thông thường."
    },
    {
        "drugs": ["ibuprofen", "aspirin"],
        "severity": "HIGH",
        "title": "Nguy cơ tổn thương niêm mạc dạ dày và triệt tiêu tác dụng tim mạch của Aspirin",
        "mechanism": "Ibuprofen cạnh tranh vị trí gắn kết trên enzyme COX-1, làm mất tác dụng ngừa huyết khối của Aspirin liều thấp, đồng thời tăng gấp đôi nguy cơ viêm loét xuất huyết dạ dày.",
        "advice": "Không nên uống Ibuprofen cùng thời điểm với Aspirin tim mạch."
    },

    # 5. Thuốc an thần / Thuốc huyết áp
    {
        "drugs": ["diazepam", "amlodipine"],
        "severity": "MODERATE",
        "title": "Tăng tác dụng an thần và nguy cơ té ngã ban đêm",
        "mechanism": "Thuốc ngủ/an thần kết hợp thuốc giãn mạch làm giảm phản xạ thăng bằng và trương lực cơ ở người già.",
        "advice": "Hạn chế đi lại trong bóng tối vào ban đêm, để đèn ngủ mờ và chuẩn bị chuông báo đầu giường."
    },

    # 6. Thuốc tiểu đường Metformin + Cồn
    {
        "drugs": ["metformin", "alcohol"],
        "severity": "HIGH",
        "title": "Nguy cơ nhiễm toan acid lactic nguy hiểm",
        "mechanism": "Rượu làm tăng tác dụng của Metformin lên chuyển hóa lactate, có thể dẫn đến nhiễm toan acid lactic đe dọa tính mạng.",
        "advice": "Người cao tuổi dùng Metformin tuyệt đối không uống rượu bia."
    }
]

# Danh mục ánh xạ tên thương mại / tên thông dụng sang hoạt chất chuẩn
DRUG_SYNONYMS = {
    "amlodipine": ["amlodipine", "amlor", "amlopress", "norvasc", "huyết áp amlodipine"],
    "aspirin": ["aspirin", "aspirin 81", "aspirin 100", "aspilets", "cardiprin"],
    "clopidogrel": ["clopidogrel", "plavix", "clopidox"],
    "warfarin": ["warfarin", "coumadin", "sintrom"],
    "ginkgo biloba": ["ginkgo biloba", "ginkgo", "tanakan", "bổ não", "hoạt huyết", "gingko"],
    "omeprazole": ["omeprazole", "losec", "lomac", "dạ dày omeprazole"],
    "pantoprazole": ["pantoprazole", "pantiloc", "controloc"],
    "ibuprofen": ["ibuprofen", "advil", "motrin", "alaxan"],
    "losartan": ["losartan", "cozaar"],
    "captopril": ["captopril", "capoten"],
    "atenolol": ["atenolol", "tenormin"],
    "diazepam": ["diazepam", "valium", "seduxen"],
    "metformin": ["metformin", "glucophage", "tiểu đường metformin"]
}

def normalize_to_active_ingredient(med_name: str) -> str:
    """
    Chuẩn hóa tên thuốc hoặc biệt dược về tên hoạt chất chính.
    Ví dụ: 'Amlodipine 5mg' -> 'amlodipine', 'Hoạt Huyết Ginkgo Biloba' -> 'ginkgo biloba'.
    """
    clean_name = re.sub(r"[^\w\s]", " ", (med_name or "").lower()).strip()

    # 1. Tìm khớp trực tiếp trong từ điển đồng nghĩa
    for active_ing, synonyms in DRUG_SYNONYMS.items():
        for syn in synonyms:
            if syn in clean_name:
                return active_ing

    # 2. Fuzzy search nếu tên hoạt chất gần đúng
    words = clean_name.split()
    for word in words:
        if len(word) >= 4:
            for active_ing in DRUG_SYNONYMS.keys():
                if difflib.SequenceMatcher(None, word, active_ing).ratio() >= 0.85:
                    return active_ing

    return clean_name


def check_drug_interactions(medication_names: List[str]) -> Dict[str, Any]:
    """
    Kiểm tra tương tác thuốc cho một danh sách các loại thuốc.
    Trả về cấu trúc chi tiết:
    - has_interaction: bool
    - severity_level: 'SAFE' | 'MODERATE' | 'HIGH'
    - detected_interactions: list of interaction objects
    - summary_message: str
    """
    if not medication_names or len(medication_names) < 2:
        return {
            "has_interaction": False,
            "severity_level": "SAFE",
            "detected_interactions": [],
            "summary_message": "Không phát hiện tương tác (danh mục chỉ có 1 thuốc hoặc chưa có thuốc nào)."
        }

    # Bóc tách danh sách hoạt chất
    med_map = []
    for raw_name in medication_names:
        active = normalize_to_active_ingredient(raw_name)
        med_map.append({"raw_name": raw_name, "active": active})

    detected = []
    max_severity = "SAFE"

    # Duyệt qua từng cặp thuốc (A, B)
    n = len(med_map)
    for i in range(n):
        for j in range(i + 1, n):
            act_a = med_map[i]["active"]
            act_b = med_map[j]["active"]
            raw_a = med_map[i]["raw_name"]
            raw_b = med_map[j]["raw_name"]

            for rule in INTERACTION_RULES:
                rule_drugs = rule["drugs"]
                # Kiểm tra cả 2 chiều: (A trong rule và B trong rule)
                match_ab = (rule_drugs[0] in act_a and rule_drugs[1] in act_b) or \
                           (rule_drugs[0] in act_b and rule_drugs[1] in act_a)

                if match_ab:
                    severity = rule["severity"]
                    if severity == "HIGH":
                        max_severity = "HIGH"
                    elif severity == "MODERATE" and max_severity != "HIGH":
                        max_severity = "MODERATE"

                    detected.append({
                        "drug_a": raw_a,
                        "drug_b": raw_b,
                        "active_a": act_a,
                        "active_b": act_b,
                        "severity": severity,
                        "title": rule["title"],
                        "mechanism": rule["mechanism"],
                        "clinical_advice": rule["advice"]
                    })

    has_interact = len(detected) > 0
    if not has_interact:
        summary_msg = "✓ An toàn: Không phát hiện tương tác bất lợi nghiêm trọng nào giữa các thuốc trong danh mục."
    elif max_severity == "HIGH":
        summary_msg = f"⚠️ CẢNH BÁO NGUY HIỂM: Phát hiện {len(detected)} tương tác thuốc có nguy cơ cao trong đơn thuốc của bác!"
    else:
        summary_msg = f"ℹ️ LƯU Ý THEO DÕI: Phát hiện {len(detected)} tương tác thuốc mức độ trung bình cần theo dõi huyết áp / tác dụng phụ."

    return {
        "has_interaction": has_interact,
        "severity_level": max_severity,
        "total_interactions": len(detected),
        "detected_interactions": detected,
        "summary_message": summary_msg
    }
