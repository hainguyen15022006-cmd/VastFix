"""Apply the explicit AI decision log without changing the generated source fixture."""
import argparse
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def materialize(raw_source, review):
    assert review["schema_version"] == 1 and review["reviewer_type"] == "AI"
    assert sha256(raw_source).hexdigest() == review["source_sha256"], "Source fixture changed; review it again"
    data = deepcopy(json.loads(raw_source))
    reports = {row["report_id"]: row for row in data["reports"]}
    decisions = {row["case_id"]: row for row in review["cases"]}
    assert len(decisions) == len(review["cases"])
    assert set(decisions) == {case["case_id"] for case in data["cases"]}
    for case in data["cases"]:
        decision = decisions[case["case_id"]]
        assert decision["query_key"] == reports[case["query_id"]]["key"]
        pairs = {row["candidate_key"]: row for row in decision["pair_decisions"]}
        assert len(pairs) == len(decision["pair_decisions"])
        assert set(pairs) == {reports[key]["key"] for key in case["candidate_ids"]}
        assert decision["notes_vi"].strip()
        for pair in pairs.values():
            assert pair["label"] in {"DUPLICATE", "NOT_DUPLICATE", "UNCERTAIN"}
            assert pair["reason_vi"].strip()
        fields = {"DUPLICATE": "expected_relevant_ids", "NOT_DUPLICATE": "expected_negative_ids",
                  "UNCERTAIN": "expected_uncertain_ids"}
        for label, field in fields.items():
            case[field] = [key for key in case["candidate_ids"] if pairs[reports[key]["key"]]["label"] == label]
        uncertain = bool(case["expected_uncertain_ids"])
        case["review_status"] = "UNCERTAIN" if uncertain else "AI_REVIEWED"
        if uncertain:
            assert decision["needed_information_vi"] and decision["needed_information_vi"].strip()
        case["ai_review"] = {
            "reviewer_type": "AI", "reviewer": review["reviewer"], "reviewed_at": review["reviewed_at"],
            "decision": "DEFER" if uncertain else "ACCEPT", "notes_vi": decision["notes_vi"],
            "needed_information_vi": decision["needed_information_vi"],
            "decision_log": "label-review-2026-11-23.json", "case_id": case["case_id"],
        }
    data["label_review"] = {
        "reviewer_type": "AI", "reviewer": review["reviewer"], "reviewed_at": review["reviewed_at"],
        "source_file": review["source_file"], "source_sha256": review["source_sha256"],
        "decision_log": "label-review-2026-11-23.json", "rubric_refs": review["rubric_refs"],
        "scope": review["scope"],
    }
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=HERE / "dataset.json")
    parser.add_argument("--review", type=Path, default=HERE / "label-review-2026-11-23.json")
    parser.add_argument("--output", type=Path, default=HERE / "dataset.ai-reviewed.json")
    args = parser.parse_args()
    assert args.output.resolve() != args.source.resolve(), "Keep the generated source fixture intact"
    data = materialize(args.source.read_bytes(), json.loads(args.review.read_text(encoding="utf-8")))
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Written AI review copy: {len(data['reports'])} reports, {len(data['cases'])} cases")


if __name__ == "__main__":
    main()
