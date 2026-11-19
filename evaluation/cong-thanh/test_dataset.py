import json
import subprocess
import sys
from copy import deepcopy
from pathlib import Path

import pytest

from evaluate import HERE, candidate_eligible, evaluate, request, validate


@pytest.fixture
def data():
    return json.loads((HERE / "dataset.json").read_text(encoding="utf-8"))


def test_fixture_rebuild_is_exact(data):
    before = (HERE / "dataset.json").read_bytes()
    subprocess.run([sys.executable, str(HERE / "build_dataset.py")], check=True)
    assert (HERE / "dataset.json").read_bytes() == before
    assert len(data["reports"]) >= 30


def test_references_and_wire_schema(data):
    by_id = validate(data)
    assert len(by_id) == len(data["reports"])
    assert all(request(case, by_id).limit == 5 for case in data["cases"])


def test_rejects_bad_location_and_label(data):
    changed = deepcopy(data)
    changed["reports"][0]["location"]["floor_id"] = changed["reports"][0]["location"]["building_id"]
    with pytest.raises(AssertionError):
        validate(changed)
    changed = deepcopy(data)
    changed["cases"][0]["expected_relevant_ids"] = []
    with pytest.raises(AssertionError):
        validate(changed)


def test_closed_and_merged_sources_are_ineligible(data):
    by_id = validate(data)
    case = next(c for c in data["cases"] if c["case_id"] == "C03")
    query = by_id[case["query_id"]]
    eligible = {c.report_id for c in request(case, by_id, eligible_only=True).candidates}
    assert any(by_id[x]["issue_status"] == "CLOSED" and x not in eligible for x in case["candidate_ids"])
    assert any(by_id[x]["merged_source"] and x not in eligible for x in case["candidate_ids"])
    assert all(candidate_eligible(query, by_id[x]) for x in eligible)


def test_ranking_is_deterministic_and_empty_case(data):
    by_id = validate(data)
    one = evaluate(data, by_id)
    two = evaluate(data, by_id)
    assert one == two
    empty = next(c for c in data["cases"] if c["case_id"] == "C15")
    assert request(empty, by_id, eligible_only=True).candidates == []


def test_api_contract_on_labeled_cases(data):
    result = evaluate(data, validate(data), run_api=True)
    assert result["api"]["cases"] == sum(c["review_status"] == "PROVISIONAL" for c in data["cases"])
    assert result["api"]["contract_errors"] == []
