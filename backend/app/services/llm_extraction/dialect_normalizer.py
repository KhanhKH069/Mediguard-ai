# ==============================================================================
# MEDIGUARD CARE - DIALECT & COLLOQUIAL NORMALIZER
# Maps Vietnamese regional dialects and everyday colloquial words to medical terms
# ==============================================================================

import json
import os
import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

def _resolve_lexicon_path() -> str:
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../clinical_protocols/vietnamese_medical_lexicon.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../clinical_protocols/vietnamese_medical_lexicon.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../clinical_protocols/vietnamese_medical_lexicon.json")),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    return possible_paths[0]

LEXICON_PATH = _resolve_lexicon_path()


class DialectNormalizer:
    """
    Chuẩn hóa các cách diễn đạt dân dã (ví dụ: 'hâm hấp sốt', 'rỉ nước vàng', 'êm ru')
    thành các thực thể triệu chứng lâm sàng chuẩn mực.
    """

    def __init__(self):
        self.mappings: Dict[str, Any] = {}
        self._load_lexicon()

    def _load_lexicon(self):
        try:
            if os.path.exists(LEXICON_PATH):
                with open(LEXICON_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.mappings = data.get("mappings", {})
                logger.info(f"[LEXICON] Đã tải thành công từ điển y khoa dân dã ({len(self.mappings)} nhóm thực thể)")
            else:
                logger.warning(f"[LEXICON] Không tìm thấy file từ điển tại {LEXICON_PATH}")
        except Exception as e:
            logger.error(f"[LEXICON] Lỗi khi nạp từ điển: {e}")

    def normalize_phrase(self, text: str) -> Dict[str, Any]:
        """
        Quét và trích xuất các thực thể triệu chứng được chuẩn hóa từ câu nói đời thường
        """
        lower_text = text.lower().strip()
        detected_entities = {}

        for category, cat_data in self.mappings.items():
            colloquial_dict = cat_data.get("colloquial_variations", {})
            for phrase, standard_code in colloquial_dict.items():
                if phrase in lower_text:
                    detected_entities[category] = {
                        "matched_colloquial": phrase,
                        "standard_code": standard_code,
                        "context_quote": text
                    }
                    break

        return detected_entities


dialect_normalizer = DialectNormalizer()
