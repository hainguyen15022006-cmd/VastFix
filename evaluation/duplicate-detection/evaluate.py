"""Validate the synthetic fixture and evaluate explicit candidate lists."""

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from uuid import UUID

HERE = Path(__file__).resolve().parent
AI_SERVICE = HERE.parents[1] / "ai-service"
sys.path.insert(0, str(AI_SERVICE))

from app.ranking import LexicalScorer, location_similarity, score_candidates  # noqa: E402
from app.schemas import DuplicateRequest  # noqa: E402
from build_dataset import PLACES, uid  # noqa: E402


def checked_time(value):
    assert isinstance(value, str) and "T" in value
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0
    return parsed


def validate(data):
    assert data["schema_version"] == 1
    assert data["provenance"] == "SYNTHETIC_CODEX_2026-11-19"
    categories = {item["code"] for item in data["categories"]}
    assert len(categories) == len(data["categories"])
    assert "ELECTRICAL" in categories
    reports = data["reports"]
    by_id = {r["report_id"]: r for r in reports}
    assert len(by_id) == len(reports)
    assert len({r["issue_id"] for r in reports}) == len(reports)
    assert len({r["key"] for r in reports}) == len(reports)
    allowed_statuses = {"SUBMITTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "AWAITING_REVIEW", "CLOSED"}
    for r in reports:
        assert str(UUID(r["report_id"])) == uid("report", r["key"])
        assert str(UUID(r["issue_id"])) == uid("issue", r["key"])
        assert r["category_code"] in categories
        assert r["language"] in {"vi", "en"}
        assert r["description"].strip() and r["incident_key"]
        assert r["issue_status"] in allowed_statuses
        assert r["provenance"] == data["provenance"]
        created = checked_time(r["created_at"])
        if r["issue_status"] == "CLOSED":
            assert r["closed_at"] and checked_time(r["closed_at"]) > created
        else:
            assert r["closed_at"] is None
        loc = r["location"]
        if loc["kind"] == "INDOOR":
            assert set(loc) == {"kind", "building_id", "floor_id", "area_id", "detail"}
            assert any(loc["building_id"] == uid("building", b) and
                       loc["floor_id"] == uid("floor", b + "/" + f) and
                       loc["area_id"] == uid("area", b + "/" + f + "/" + a)
                       for b, f, a, kind in PLACES.values() if kind == "INDOOR")
            for field in ("building_id", "floor_id", "area_id"):
                UUID(loc[field])
        else:
            assert loc["kind"] == "OUTDOOR"
            assert set(loc) == {"kind", "detail", "latitude", "longitude"}
            assert loc["detail"].strip()
            assert (loc["latitude"] is None) == (loc["longitude"] is None)
    case_ids = set()
    for c in data["cases"]:
        assert c["case_id"] not in case_ids
        case_ids.add(c["case_id"])
        assert c["provenance"] == data["provenance"]
        assert c["review_status"] in {"PROVISIONAL", "UNCERTAIN", "HUMAN_REVIEWED"}
        assert c["review_status"] != "HUMAN_REVIEWED"  # No review evidence exists.
        assert c["query_id"] in by_id and c["scenario"] and c["rationale"]
        candidates = c["candidate_ids"]
        positive = set(c["expected_relevant_ids"])
        negative = set(c["expected_negative_ids"])
        assert len(candidates) == len(set(candidates))
        assert c["query_id"] not in candidates
        assert set(candidates) == positive | negative and not positive & negative
        assert all(x in by_id for x in candidates)
        query = by_id[c["query_id"]]
        assert all(checked_time(by_id[x]["created_at"]) < checked_time(query["created_at"]) for x in candidates), c["case_id"]
        if c["review_status"] != "UNCERTAIN":
            assert all(by_id[x]["incident_key"] == query["incident_key"] for x in positive)
            assert all(by_id[x]["incident_key"] != query["incident_key"] for x in negative)
        request(c, by_id)  # Pydantic checks the exact FastAPI wire shape.
    assert any(c["expected_relevant_ids"] for c in data["cases"])
    assert any(not c["expected_relevant_ids"] for c in data["cases"])
    assert any(not c["candidate_ids"] for c in data["cases"])
    assert any(by_id[x]["issue_status"] == "CLOSED" for c in data["cases"] for x in c["candidate_ids"])
    assert any(by_id[x]["merged_source"] for c in data["cases"] for x in c["candidate_ids"])
    return by_id


def candidate_eligible(query, row):
    if row["issue_status"] == "CLOSED" or row["merged_source"]:
        return False
    qloc, loc = query["location"], row["location"]
    if qloc["kind"] != loc["kind"]:
        return False
    if qloc["kind"] == "INDOOR":
        return qloc["building_id"] == loc["building_id"]
    # Chuc's current pilot broadens unpinned outdoor retrieval to all open outdoor Issues.
    return qloc["latitude"] is None or qloc["detail"].casefold() == loc["detail"].casefold()


def request(case, by_id, eligible_only=False):
    q = by_id[case["query_id"]]
    ids = [x for x in case["candidate_ids"] if not eligible_only or candidate_eligible(q, by_id[x])]
    payload = {
        "request_id": uid("request", case["case_id"]), "query_time": q["created_at"],
        "query": {"description": q["description"], "proposed_category_code": q["category_code"],
                  "location": q["location"]},
        "candidates": [{"report_id": by_id[x]["report_id"], "issue_id": by_id[x]["issue_id"],
                        "description": by_id[x]["description"], "category_code": by_id[x]["category_code"],
                        "location": by_id[x]["location"], "created_at": by_id[x]["created_at"]}
                       for x in ids], "limit": 5,
    }
    return DuplicateRequest.model_validate(payload)


def metric(order, relevant):
    assert relevant
    first = next((i for i, x in enumerate(order, 1) if x in relevant), None)
    return (len(set(order[:3]) & relevant) / len(relevant),
            len(set(order[:5]) & relevant) / len(relevant),
            1 / first if first else 0)


def evaluate(data, by_id, embedding=None, run_api=False):
    lexical = LexicalScorer()
    scorers = [lexical] + ([embedding] if embedding else [])
    all_metrics = defaultdict(list)
    group_metrics = defaultdict(list)
    top_errors = defaultdict(list)
    api_results = {"cases": 0, "positive_cases": 0, "hits": 0, "negative_only_cases": 0,
                   "negative_only_with_suggestions": 0, "contract_errors": []}
    client = None
    if run_api:
        # Match the repository's baseline contract test configuration.
        os.environ.pop("VASTFIX_EMBEDDING_DIR", None)
        os.environ.pop("VASTFIX_DUPLICATE_MIN_SCORE", None)
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        client.__enter__()
    try:
        for case in data["cases"]:
            if case["review_status"] == "UNCERTAIN":
                continue
            req = request(case, by_id, eligible_only=True)
            candidates = req.candidates
            relevant = set(case["expected_relevant_ids"]) & {x.report_id for x in candidates}
            ids = [x.report_id for x in candidates]
            if relevant:
                locations = [location_similarity(req.query.location, x.location)[0] for x in candidates]
                words = lexical.similarities(req.query.description, [x.description for x in candidates])
                orders = {}
                for name, scores in (("location-only", locations), ("keyword-only", words)):
                    orders[name] = [x for _, x in sorted(zip(scores, ids), key=lambda pair: (-pair[0], pair[1]))]
                for scorer in scorers:
                    orders[scorer.version] = [x.report_id for x in score_candidates(req, scorer, min_score=0)]
                query_lang = by_id[case["query_id"]]["language"]
                rel_langs = {by_id[x]["language"] for x in relevant}
                group = query_lang + "-" + next(iter(rel_langs)) if len(rel_langs) == 1 else "mixed"
                for name, order in orders.items():
                    score = metric(order, relevant)
                    all_metrics[name].append(score)
                    group_metrics[(name, group)].append(score)
                    if order and order[0] not in relevant:
                        top_errors[name].append({"case_id": case["case_id"], "ranked_first": order[0],
                                                 "expected": sorted(relevant)})
            if client:
                response = client.post("/duplicates", json=req.model_dump(mode="json"))
                api_results["cases"] += 1
                if response.status_code != 200:
                    api_results["contract_errors"].append(case["case_id"] + ": HTTP " + str(response.status_code))
                    continue
                body = response.json()
                suggestions = body.get("suggestions", [])
                actual = [x["report_id"] for x in suggestions]
                if (body.get("request_id") != str(req.request_id) or
                    len(actual) > 5 or len(set(actual)) != len(actual) or
                    not set(actual) <= set(ids) or
                    any(not 0 <= x["score"] <= 1 for x in suggestions) or
                    any(suggestions[i]["score"] < suggestions[i + 1]["score"] for i in range(len(suggestions) - 1))):
                    api_results["contract_errors"].append(case["case_id"] + ": response invariant")
                if relevant:
                    api_results["positive_cases"] += 1
                    api_results["hits"] += bool(set(actual) & relevant)
                else:
                    api_results["negative_only_cases"] += 1
                    api_results["negative_only_with_suggestions"] += bool(actual)
    finally:
        if client:
            client.__exit__(None, None, None)

    def summarize(scores):
        return {"cases": len(scores), "recall_at_3": round(mean(s[0] for s in scores), 3),
                "recall_at_5": round(mean(s[1] for s in scores), 3),
                "mrr": round(mean(s[2] for s in scores), 3)}

    return {
        "reports": len(data["reports"]), "cases": len(data["cases"]),
        "review_statuses": dict(Counter(c["review_status"] for c in data["cases"])),
        "languages": dict(Counter(r["language"] for r in data["reports"])),
        "positive_cases": sum(bool(c["expected_relevant_ids"]) for c in data["cases"] if c["review_status"] != "UNCERTAIN"),
        "negative_only_cases": sum(not c["expected_relevant_ids"] for c in data["cases"] if c["review_status"] != "UNCERTAIN"),
        "ranking_eligible_positive_cases": len(all_metrics["baseline-v1"]),
        "ranking": {k: summarize(v) for k, v in all_metrics.items()},
        "language_groups": {k + "/" + g: summarize(v) for (k, g), v in group_metrics.items()},
        "top_1_errors": dict(top_errors), "api": api_results if client else "not run",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=HERE / "dataset.json")
    parser.add_argument("--api", action="store_true", help="exercise the actual FastAPI /duplicates endpoint")
    parser.add_argument("--embedding-dir", type=Path, help="already installed local E5 ONNX model")
    args = parser.parse_args()
    data = json.loads(args.data.read_text(encoding="utf-8"))
    by_id = validate(data)
    embedding = None
    if args.embedding_dir:
        from app.embedding import E5Scorer
        embedding = E5Scorer(args.embedding_dir)
    print(json.dumps(evaluate(data, by_id, embedding, args.api), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
