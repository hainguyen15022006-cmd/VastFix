import json
from copy import deepcopy
from math import isfinite
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("VASTFIX_EMBEDDING_DIR", raising=False)
    monkeypatch.delenv("VASTFIX_DUPLICATE_MIN_SCORE", raising=False)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def payload():
    return json.loads((Path(__file__).parents[1] / "demo" / "h2-03.json").read_text(encoding="utf-8"))


def suggestions(client, payload):
    response = client.post("/duplicates", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result.keys() == {"request_id", "suggestions", "model_version"}
    assert result["request_id"] == payload["request_id"]
    assert result["model_version"] == "baseline-v1"
    return result["suggestions"]


def test_health(client):
    assert client.get("/health").json() == {"status": "ok", "model_version": "baseline-v1"}


def test_seed_ranking_and_reproducibility(client, payload):
    result = suggestions(client, payload)
    assert [item["report_id"] for item in result] == [row["report_id"] for row in reversed(payload["candidates"])]
    assert result[0]["score"] > result[1]["score"]
    assert result[0]["reason_codes"] == ["SAME_AREA", "SIMILAR_DESCRIPTION", "SAME_CATEGORY", "RECENT_REPORT"]
    assert suggestions(client, payload) == result
    payload["candidates"].reverse()
    assert suggestions(client, payload) == result
    payload["query_time"] = "2026-12-20T02:00:00Z"
    older = suggestions(client, payload)[0]
    assert older["score"] < result[0]["score"]
    assert "RECENT_REPORT" not in older["reason_codes"]


@pytest.mark.parametrize(("limit", "expected"), [(0, 0), (2, 2), (5, 5), (50, 5)])
def test_limit_unique_ids_and_finite_scores(client, payload, limit, expected):
    source = payload["candidates"][1]
    payload["candidates"] = [dict(source, report_id=str(UUID(int=i))) for i in range(7, 0, -1)]
    duplicate = deepcopy(payload["candidates"][-1])
    duplicate["created_at"] = "2026-11-01T02:00:00Z"
    payload["candidates"].insert(0, duplicate)
    payload["limit"] = limit
    result = suggestions(client, payload)
    assert [item["report_id"] for item in result] == [str(UUID(int=i)) for i in range(1, expected + 1)]
    assert all(isfinite(item["score"]) and 0 <= item["score"] <= 1 for item in result)
    assert all(set(item) == {"report_id", "score", "reason_codes"} for item in result)


def test_empty_and_unrelated_candidates(client, payload):
    payload["candidates"][0]["description"] = "Tràn ống nước"
    payload["candidates"] = payload["candidates"][:1]
    assert suggestions(client, payload) == []
    payload["candidates"] = []
    assert suggestions(client, payload) == []


@pytest.mark.parametrize(("location", "reason"), [
    ({"area_id": str(UUID(int=1))}, "SAME_FLOOR"),
    ({"area_id": str(UUID(int=1)), "floor_id": str(UUID(int=2))}, "SAME_BUILDING"),
])
def test_location_reasons(client, payload, location, reason):
    candidate = payload["candidates"][1]
    candidate["location"].update(location)
    payload["candidates"] = [candidate]
    assert suggestions(client, payload)[0]["reason_codes"][0] == reason


def test_outdoor_and_vietnamese_accent_folding(client, payload):
    payload["query"] = {"description": "Đèn ở cổng không sáng", "location": {
        "kind": "OUTDOOR", "detail": "Cổng chính", "latitude": 21.041, "longitude": 105.8,
    }}
    candidate = payload["candidates"][1]
    candidate.update(description="den o cong khong sang", category_code=None, location={
        "kind": "OUTDOOR", "detail": "Gần cổng", "latitude": 21.0411, "longitude": 105.8,
    })
    payload["candidates"] = [candidate]
    (result,) = suggestions(client, payload)
    assert result["score"] > 0.8
    assert result["reason_codes"] == ["SIMILAR_DESCRIPTION", "RECENT_REPORT"]


@pytest.mark.parametrize("invalid_location", [
    {"kind": "INDOOR", "area_id": "invalid"},
    {"kind": "OUTDOOR", "detail": "Gate", "latitude": 21},
    {"kind": "OUTDOOR", "detail": "   "},
])
def test_invalid_location(client, payload, invalid_location):
    payload["query"]["location"] = invalid_location
    assert client.post("/duplicates", json=payload).status_code == 422


def test_invalid_payload_does_not_echo_input(client, payload):
    payload["query_time"] = "2026-11-20T02:00:00"
    payload["query"]["reporter_email"] = "example@demo.invalid"
    response = client.post("/duplicates", json=payload)
    assert response.status_code == 422
    assert "example@demo.invalid" not in response.text
