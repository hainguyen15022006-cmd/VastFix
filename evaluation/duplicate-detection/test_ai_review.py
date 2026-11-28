import json
import subprocess
import sys
from copy import deepcopy

import pytest

from evaluate import HERE, evaluate, validate
from materialize_review import materialize


def source_and_review():
    return (HERE / "dataset.json").read_bytes(), json.loads((HERE / "label-review-2026-11-23.json").read_text(encoding="utf-8"))


def test_review_is_reproducible_and_preserves_all_original_reports():
    raw, review = source_and_review()
    reviewed = materialize(raw, review)
    assert reviewed == json.loads((HERE / "dataset.ai-reviewed.json").read_text(encoding="utf-8"))
    assert reviewed["reports"] == json.loads(raw)["reports"]
    assert len(review["cases"]) == 22
    assert sum(len(case["pair_decisions"]) for case in review["cases"]) == 61
    validate(reviewed)


def test_uncertain_relations_are_never_silently_labeled_negative():
    raw, review = source_and_review()
    reviewed = materialize(raw, review)
    by_id = validate(reviewed)
    uncertain_cases = {"C01", "C06", "C07", "C09", "C13", "C14", "C16", "C20"}
    assert {case["case_id"] for case in reviewed["cases"] if case["review_status"] == "UNCERTAIN"} == uncertain_cases
    for case in reviewed["cases"]:
        unknown = set(case["expected_uncertain_ids"])
        assert not unknown & set(case["expected_negative_ids"])
        assert not unknown & set(case["expected_relevant_ids"])
    ambiguous = next(case for case in reviewed["cases"] if case["case_id"] == "C16")
    assert not ambiguous["expected_relevant_ids"] and not ambiguous["expected_negative_ids"]
    assert len(ambiguous["expected_uncertain_ids"]) == 2
    result = evaluate(reviewed, by_id, run_api=True)
    assert result["api"]["cases"] == 14
    assert result["api"]["positive_cases"] == 9
    assert not result["api"]["contract_errors"]


def test_ai_review_cannot_masquerade_as_human_review_or_change_its_source():
    raw, review = source_and_review()
    with pytest.raises(AssertionError):
        materialize(raw + b"\n", review)
    changed = deepcopy(review)
    changed["reviewer_type"] = "HUMAN"
    with pytest.raises(AssertionError):
        materialize(raw, changed)
    reviewed = materialize(raw, review)
    next(case for case in reviewed["cases"] if case["review_status"] == "AI_REVIEWED")["review_status"] = "HUMAN_REVIEWED"
    with pytest.raises(AssertionError):
        validate(reviewed)


def test_human_only_cli_excludes_ai_decisions():
    response = subprocess.run([sys.executable, str(HERE / "evaluate.py"), "--data", str(HERE / "dataset.ai-reviewed.json"), "--reviewed-only"], capture_output=True, text=True, check=True)
    result = json.loads(response.stdout)
    assert result["cases"] == 0
    assert result["ranking"]["baseline-v1"]["mrr"] is None
