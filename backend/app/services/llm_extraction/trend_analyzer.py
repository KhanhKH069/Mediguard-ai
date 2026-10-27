# ==============================================================================
# MEDIGUARD CARE - CLINICAL TREND ANALYZER
# Compares current day clinical metrics with previous days (Day N vs Day N-1)
# ==============================================================================

import logging
from typing import Dict, Any, Optional
from ...schemas.extraction_schema import EvolutionTrend

logger = logging.getLogger(__name__)


class TrendAnalyzer:
    """
    So sánh diễn biến triệu chứng của bệnh nhân qua các mốc thời gian D+1, D+3, D+7
    """

    @staticmethod
    def compare_pain(current_vas: Optional[int], previous_vas: Optional[int], stated_trend: Optional[str] = None) -> EvolutionTrend:
        """
        Xác định xu hướng tiến triển của cơn đau (VAS)
        """
        if current_vas is not None and previous_vas is not None:
            if current_vas > previous_vas + 1:
                return EvolutionTrend.WORSENING
            elif current_vas < previous_vas - 1:
                return EvolutionTrend.IMPROVING
            else:
                return EvolutionTrend.STABLE

        if stated_trend:
            lower = stated_trend.lower()
            if any(w in lower for w in ["tăng", "nhiều hơn", "tợn hơn", "dội lên"]):
                return EvolutionTrend.WORSENING
            elif any(w in lower for w in ["giảm", "bớt", "đỡ", "êm"]):
                return EvolutionTrend.IMPROVING
            elif any(w in lower for w in ["như cũ", "không đổi", "y nguyên"]):
                return EvolutionTrend.STABLE

        return EvolutionTrend.UNCLEAR

    @staticmethod
    def evaluate_fever_trajectory(current_temp: Optional[float], previous_temp: Optional[float]) -> str:
        """
        Đánh giá diễn biến thân nhiệt
        """
        if current_temp is None:
            return "UNKNOWN_TEMP"

        if current_temp >= 38.5:
            return "HIGH_FEVER_CRITICAL"
        elif current_temp >= 37.5:
            if previous_temp and previous_temp < 37.5:
                return "NEW_ONSET_LOW_FEVER"
            return "PERSISTENT_LOW_FEVER"
        else:
            return "AFEBRILE_NORMAL"


trend_analyzer = TrendAnalyzer()
