import re
import unicodedata
from collections import Counter
from math import asin, cos, hypot, radians, sin, sqrt
from typing import Protocol

from .schemas import DuplicateRequest, IndoorLocation, Location, OutdoorLocation, ReasonCode, Suggestion

MAX_SUGGESTIONS = 5
DEFAULT_MIN_SCORE = 0.35
RECENT_DAYS = 7


class TextScorer(Protocol):
    version: str
    reason_threshold: float

    def similarities(self, query: str, candidates: list[str]) -> list[float]: ...


def normalize(text: str | None) -> str:
    folded = unicodedata.normalize("NFKD", (text or "").casefold().replace("đ", "d"))
    return "".join(letter for letter in folded if not unicodedata.combining(letter))


def tokens(text: str | None) -> list[str]:
    # Keep asset IDs such as H2-03 whole so nearby H2-04 is not a token match.
    return re.findall(r"[^\W_]+(?:[-/][^\W_]+)*", normalize(text))


class LexicalScorer:
    version = "baseline-v1"
    reason_threshold = 0.45

    def similarities(self, query: str, candidates: list[str]) -> list[float]:
        query_counts = Counter(tokens(query))
        query_norm = hypot(*query_counts.values())
        scores = []
        for description in candidates:
            counts = Counter(tokens(description))
            denominator = query_norm * hypot(*counts.values())
            dot_product = sum(count * counts[word] for word, count in query_counts.items())
            scores.append(clamp(dot_product / denominator) if denominator else 0.0)
        return scores


def clamp(score: float) -> float:
    return max(0.0, min(1.0, score))


def location_similarity(left: Location, right: Location) -> tuple[float, ReasonCode | None]:
    if isinstance(left, IndoorLocation) and isinstance(right, IndoorLocation):
        if left.building_id.lower() == right.building_id.lower():
            if left.floor_id.lower() == right.floor_id.lower():
                if left.area_id.lower() == right.area_id.lower():
                    return 1.0, "SAME_AREA"
                return 0.65, "SAME_FLOOR"
            return 0.25, "SAME_BUILDING"
    if isinstance(left, OutdoorLocation) and isinstance(right, OutdoorLocation):
        detail = tokens(left.detail)
        if detail and detail == tokens(right.detail):
            return 1.0, None
        if None not in (left.latitude, left.longitude, right.latitude, right.longitude):
            lat1, lon1, lat2, lon2 = map(
                radians, (left.latitude, left.longitude, right.latitude, right.longitude)
            )
            arc = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
            distance_m = 12_742_000 * asin(sqrt(clamp(arc)))
            return clamp(1 - distance_m / 150), None
    return 0.0, None


def rank(request: DuplicateRequest, scorer: TextScorer, min_score: float = DEFAULT_MIN_SCORE) -> list[Suggestion]:
    limit = min(request.limit, MAX_SUGGESTIONS)
    if not limit:
        return []
    return score_candidates(request, scorer, min_score)[:limit]


def score_candidates(request: DuplicateRequest, scorer: TextScorer, min_score: float) -> list[Suggestion]:
    if not request.candidates:
        return []
    query = request.query
    query_detail = tokens(query.location.detail)
    text_scores = scorer.similarities(query.description, [item.description for item in request.candidates])
    by_report: dict[str, Suggestion] = {}
    for candidate, text_score in zip(request.candidates, text_scores, strict=True):
        location_score, location_reason = location_similarity(query.location, candidate.location)
        same_detail = (
            location_reason == "SAME_AREA"
            and bool(query_detail)
            and query_detail == tokens(candidate.location.detail)
        )
        same_category = (
            query.proposed_category_code is not None
            and query.proposed_category_code == candidate.category_code
        )
        age_days = (request.query_time - candidate.created_at).total_seconds() / 86_400
        recency = 2 ** (-age_days / RECENT_DAYS) if age_days >= 0 else 0.0
        score = (
            0.60 * text_score
            + 0.20 * location_score
            + 0.10 * same_detail
            + 0.05 * same_category
            + 0.05 * recency
        )
        score = round(clamp(score), 6)
        if score < min_score:
            continue

        reasons: list[ReasonCode] = []
        if location_reason:
            reasons.append(location_reason)
        if text_score >= scorer.reason_threshold:
            reasons.append("SIMILAR_DESCRIPTION")
        if same_category:
            reasons.append("SAME_CATEGORY")
        if 0 <= age_days <= RECENT_DAYS:
            reasons.append("RECENT_REPORT")

        identifier = candidate.report_id.lower()
        previous = by_report.get(identifier)
        if previous is None or score > previous.score:
            by_report[identifier] = Suggestion(report_id=candidate.report_id, score=score, reason_codes=reasons)

    return sorted(by_report.values(), key=lambda item: (-item.score, item.report_id.lower()))
