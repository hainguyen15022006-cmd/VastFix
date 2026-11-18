import argparse
import csv
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean
from time import perf_counter
from uuid import NAMESPACE_URL, uuid5

from app.ranking import LexicalScorer, location_similarity, score_candidates
from app.schemas import DuplicateRequest


def identifier(value):
    return str(uuid5(NAMESPACE_URL, "vastfix-spike/" + value))


def location(row):
    building, floor, _ = row["location"].split("/")
    return {
        "kind": "INDOOR",
        "building_id": identifier(building),
        "floor_id": identifier(f"{building}/{floor}"),
        "area_id": identifier(row["location"]),
        "detail": row["detail"] or None,
    }


def make_request(query, candidates):
    return DuplicateRequest.model_validate({
        "request_id": identifier("query/" + query["id"]),
        "query_time": query["created_at"],
        "query": {
            "description": query["description"],
            "proposed_category_code": query["category"],
            "location": location(query),
        },
        "candidates": [
            {
                "report_id": identifier(row["id"]),
                "issue_id": identifier("issue/" + row["incident"]),
                "description": row["description"],
                "category_code": row["category"],
                "location": location(row),
                "created_at": row["created_at"],
            }
            for row in candidates
        ],
        "limit": 5,
    })


def eligible(query, row):
    if not row["incident"] or row["location"].split("/")[0] != query["location"].split("/")[0]:
        return False
    when = datetime.fromisoformat(query["created_at"])
    return (
        datetime.fromisoformat(row["created_at"]) < when
        and (not row["closed_at"] or when < datetime.fromisoformat(row["closed_at"]))
    )


def metrics(order, relevant):
    first = next(index for index, identifier in enumerate(order, 1) if identifier in relevant)
    return [
        len(relevant.intersection(order[:3])) / len(relevant),
        len(relevant.intersection(order[:5])) / len(relevant),
        1 / first,
    ]


def evaluate(rows, embedding=None):
    methods = ["location-only", "lexical-only", "baseline-v1"]
    if embedding:
        methods.append(embedding.version)
    measurements = defaultdict(list)
    elapsed = defaultdict(list)
    misses = defaultdict(list)
    lexical = LexicalScorer()
    for query in rows:
        if not query["incident"]:
            continue
        earlier = [row for row in rows if eligible(query, row)]
        if not any(row["incident"] == query["incident"] for row in earlier):
            continue
        request = make_request(query, earlier)
        public_ids = {identifier(row["id"]): row for row in earlier}
        ids = [candidate.report_id for candidate in request.candidates]
        locations = [
            location_similarity(request.query.location, candidate.location)[0]
            for candidate in request.candidates
        ]
        words = lexical.similarities(query["description"], [row["description"] for row in earlier])
        orders = {}
        for method, scores in zip(methods[:2], [locations, words], strict=True):
            orders[method] = [
                item for _, item in sorted(zip(scores, ids, strict=True), key=lambda pair: (-pair[0], pair[1]))
            ]
        for scorer in [lexical, embedding] if embedding else [lexical]:
            start = perf_counter()
            orders[scorer.version] = [
                match.report_id for match in score_candidates(request, scorer, min_score=0)
            ]
            elapsed[scorer.version].append((perf_counter() - start) * 1000)

        for method, order in orders.items():
            subsets = {
                "all": order,
                query["language"] + "-" + query["language"]: [
                    item for item in order if public_ids[item]["language"] == query["language"]
                ],
                "vi-en": [item for item in order if public_ids[item]["language"] != query["language"]],
            }
            for split, entries in subsets.items():
                relevant = {item for item in entries if public_ids[item]["incident"] == query["incident"]}
                if not relevant:
                    continue
                measurements[(method, split)].append(metrics(entries, relevant))
                if split == "all" and entries[0] not in relevant:
                    misses[method].append({
                        "query": query["id"],
                        "ranked_first": public_ids[entries[0]]["id"],
                        "first_duplicate": next(public_ids[item]["id"] for item in entries if item in relevant),
                    })

    return {
        "reports": len(rows),
        "metrics": [
            dict(
                method=method, split=split, queries=len(scores),
                recall_at_3=round(mean(score[0] for score in scores), 3),
                recall_at_5=round(mean(score[1] for score in scores), 3),
                mrr=round(mean(score[2] for score in scores), 3),
            )
            for method in methods
            for split in ("all", "vi-vi", "en-en", "vi-en")
            if (scores := measurements[(method, split)])
        ],
        "mean_rank_ms": {method: round(mean(timings), 2) for method, timings in elapsed.items()},
        "top_1_errors": dict(misses),
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate duplicate retrieval on the checkpoint spike")
    parser.add_argument("--data", type=Path, default=Path(__file__).with_name("fixtures.csv"))
    parser.add_argument("--embedding-dir", type=Path, help="Directory containing the local E5 ONNX model")
    args = parser.parse_args()
    with args.data.open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))

    embedding = None
    if args.embedding_dir:
        from app.embedding import E5Scorer

        embedding = E5Scorer(args.embedding_dir)
    print(json.dumps(evaluate(rows, embedding), indent=2))


if __name__ == "__main__":
    main()
