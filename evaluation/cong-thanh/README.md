# Công Thành — independent duplicate evaluation

This directory contains the Checkpoint 1 evaluation data assigned to Công Thành in Section 5 of the approved VastFix API Contract V1. It is separate from Thành Lê's 38-description spike fixture in `ai-service/evaluation/fixtures.csv`. No AI, backend, database, or contract source file was changed for this dataset.

## Files and provenance

- `build_dataset.py` is the deterministic source of 41 reports and 22 cases.
- `dataset.json` is the generated, reviewable fixture. All text, locations, incidents, UUIDs, and labels are **synthetic Codex examples created on 19 November 2026**. They are not campus observations, real reports, or human approvals. No personal details are included.
- `evaluate.py` validates references and FastAPI wire schemas, filters candidates using the current backend rules, and computes exploratory ranking and `/duplicates` endpoint results.
- `test_dataset.py` tests generation, validation, closed and merged eligibility, determinism, and the endpoint response contract.
- `evaluation-report.md` records the executed results and limitations.

The category catalog is a synthetic evaluation catalog. Only `ELECTRICAL` appears in the current database seed; the other codes are valid within this fixture but need team approval or database entries before the reports can be loaded into an application database. Indoor building, floor, and area UUIDs are deterministically derived from the place catalog. Outdoor cases use the contract's required detail and optional null coordinates. These are API-shaped fixtures, not database seed records.

## Label meaning

Two reports are labeled duplicate only when they describe the **same affected object and the same occurrence**. Similar words, category, or area alone do not establish a duplicate. A repaired October light outage is separate from a November recurrence. An Issue merged as a source can still describe the same incident but is not an eligible suggestion candidate. `expected_relevant_ids` and `expected_negative_ids` partition each explicit candidate list. `incident_key` is a synthetic consistency aid, never an AI input.

All 21 decided case labels are `PROVISIONAL`. Case C16 is `UNCERTAIN`, because “Đèn hỏng” does not identify the lamp. The evaluator excludes C16 from metrics. There are **zero human-reviewed labels**, so all reported metrics are exploratory and are not validated ground truth. Công Thành and another reviewer should inspect the descriptions, incident identity, hard negatives, and category catalog before any official result is claimed.

## Reproduce

From the repository root, with Python 3.11+:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r ai-service\requirements-dev.txt
.venv\Scripts\python.exe evaluation\cong-thanh\build_dataset.py
.venv\Scripts\python.exe -m pytest -q evaluation\cong-thanh\test_dataset.py
.venv\Scripts\python.exe evaluation\cong-thanh\evaluate.py --api
```

Run Thành Lê's existing contract tests from `ai-service`:

```powershell
cd ai-service
..\.venv\Scripts\python.exe -m pytest -q tests\test_contract.py
```

For an **already installed** local E5 ONNX model, add `--embedding-dir PATH` to `evaluate.py`. No model is downloaded automatically.

## How to use the fixture

Thành Lê can compare `baseline-v1` with the optional embedding scorer on the explicit candidate lists. Chúc can use each case's report and candidate IDs to check candidate filtering, closed and merged exclusion, and the Next.js response mapping. `evaluate.py --api` exercises the FastAPI endpoint in process; it does not run PostgreSQL or the Next.js API. Hoàng Anh can later use the same cases for integrated checks after the category and location catalogs are seeded.

Ranking metrics use only candidates eligible under the inspected `fix/chuc-checkpoint1-api` filtering rules. The location-only and keyword-only baselines rank those same candidates; ties use report UUID order. `/duplicates` results apply the actual score threshold and maximum of five suggestions. A semantically similar negative may still be suggested because the endpoint returns candidates, not a merge decision.

The old `ai-service/evaluation/run.py --data` path was inspected but is not compatible with explicit candidate lists, outdoor locations, UUIDs, and closed or merged Issue labels: it infers candidates from a flat indoor CSV. Adapting to it would discard the distinctions this dataset tests. This local evaluator imports the existing AI ranking and request schema directly.

## Coverage and limits

The cases cover duplicate and negative relationships, same area with different equipment or faults, paraphrases, Vietnamese and English pairs, mixed languages, short and unaccented text, recurrence, closed and merged Issues, empty candidates, indoor building and floor differences, outdoor locations, and similar hard negatives. The 22 cases are hand selected and small. They do not represent the real campus incident distribution or prove performance on unseen reports. Outdoor pins are not covered. All dates and locations are fictional.
