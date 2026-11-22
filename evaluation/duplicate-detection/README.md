# Công Thành — independent duplicate evaluation

This directory contains the Checkpoint 1 evaluation data assigned to Công Thành in Section 5 of the approved VastFix API Contract V1. It is separate from Thành Lê's 38-description spike fixture in `ai-service/evaluation/fixtures.csv`. No AI, backend, database, or contract source file was changed for this dataset.

## Files and provenance

- `build_dataset.py` is the deterministic source of 41 reports and 22 cases.
- `dataset.json` is the generated, reviewable fixture. All text, locations, incidents, UUIDs, and labels are **synthetic Codex examples created on 19 November 2026**. They are not campus observations, real reports, or human approvals. No personal details are included.
- `evaluate.py` validates references and FastAPI wire schemas, filters candidates using the current backend rules, and computes exploratory ranking and `/duplicates` endpoint results.
- `test_dataset.py` tests generation, validation, closed and merged eligibility, determinism, and the endpoint response contract.
- `evaluation-report.md` records the executed results and limitations.

The category catalog is a synthetic evaluation catalog. The current demo seed includes `ELECTRICAL` and `PLUMBING`; the other codes are valid within this fixture but need matching database entries before the reports can be loaded into an application database. Indoor building, floor, and area UUIDs are deterministically derived from the place catalog. Outdoor cases use the contract's required detail and optional null coordinates. These are API-shaped fixtures, not database seed records.

## Label meaning

Two reports are labeled duplicate only when they describe the **same affected object and the same occurrence**. Similar words, category, or area alone do not establish a duplicate. A repaired October light outage is separate from a November recurrence. An Issue merged as a source can still describe the same incident but is not an eligible suggestion candidate. `expected_relevant_ids` and `expected_negative_ids` partition each explicit candidate list. `incident_key` is a synthetic consistency aid, never an AI input.

The generated source `dataset.json` retains 21 PROVISIONAL cases and one UNCERTAIN case. The separate AI-reviewed copy dated 23 November has 14 AI_REVIEWED cases and eight UNCERTAIN cases after a review of all 61 pairs. Both copies have zero human-reviewed labels. See the AI review section below for the current decisions; metrics remain exploratory synthetic-data results.

## Reproduce

From the repository root, with Python 3.11+:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r ai-service\requirements-dev.txt
.venv\Scripts\python.exe evaluation\duplicate-detection\build_dataset.py
.venv\Scripts\python.exe -m pytest -q evaluation\duplicate-detection\test_dataset.py
.venv\Scripts\python.exe evaluation\duplicate-detection\evaluate.py --api
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


## Reproduced embedding comparison on 22 November 2026

`results-2026-11-22.json` contains the full exploratory baseline/E5 results. `model-manifest-2026-11-22.json` records the immutable Hugging Face revision and SHA-256 checksums of the tokenizer and quantized ONNX weights; weights remain local and are excluded from Git and the web Docker image. Follow `ai-service/README.md` to obtain that pinned model, install `ai-service/requirements-embedding.txt`, then run from the root:

```sh
python evaluation/duplicate-detection/evaluate.py --api --embedding-dir .venv/e5-small
```

On the 16 eligible positive cases, baseline MRR was 0.844 and E5 MRR was 0.875; both Recall@3/5 were 1.000 on these small candidate lists. This is exploratory evidence using provisional synthetic labels, not proof of campus accuracy. The API subsection in this output exercises the baseline endpoint; the embedding comparison is a direct call to the unchanged E5 ranker.

## Record real label review

The source fixture stays unchanged. An AI decision is recorded as AI_REVIEWED, never HUMAN_REVIEWED. To record a later human review, use actual reviewer identities and the required `review` metadata (at least two distinct reviewers, UTC reviewed_at and explanatory notes). Preserve reviewed copies separately from the deterministic synthetic generator output.

The validator now accepts documented human reviews and rejects missing or duplicate reviewer records. `python evaluate.py --data reviewed-dataset.json --reviewed-only` evaluates only recorded reviews; zero reviewed positives produces null metrics rather than a fabricated score. Outdoor pinned-candidate eligibility also has a bounding-box regression test matching the backend; the original case fixture still uses unpinned locations.


## AI label review 23 November 2026

Hải Anh requested an AI review of the remaining labels. All 41 reports and 61 candidate pairs were inspected against object/occurrence identity and the approved O10 causal-uncertainty rule. [The Vietnamese review report](AI_Label_Review_2026-11-23.txt) explains every pair and the information missing from each deferred case.

- `label-review-2026-11-23.json`: explicit AI decision log with source checksum, reviewer type, UTC time, reasons and needed information.
- `dataset.ai-reviewed.json`: a separate copy with 14 AI_REVIEWED cases and eight UNCERTAIN cases (C01, C06, C07, C09, C13, C14, C16, C20). The 41 original reports are unchanged.
- `materialize_review.py`: deterministically applies that log; refuses changed source data, incomplete pair coverage or overwriting the generator output.
- `results-ai-reviewed-2026-11-23.json`: new exploratory evaluation on nine eligible positive cases; baseline and E5 both have MRR 0.889, Recall@3/5 1.000. This subset differs from the 16 positives used on 22 November, so the scores are not a before/after improvement comparison.

Each reviewed case partitions candidates into relevant, negative and uncertain IDs. Any case with an uncertain pair remains UNCERTAIN and is excluded as a whole from metrics; an unknown relation is never treated as a negative. The decision log still retains the known pairs in those cases. AI review is not human, independent, blind or field validation.

```sh
python evaluation/duplicate-detection/materialize_review.py
python -m pytest -q evaluation/duplicate-detection
python evaluation/duplicate-detection/evaluate.py --data evaluation/duplicate-detection/dataset.ai-reviewed.json --api --embedding-dir .venv/e5-small
```

`--reviewed-only` deliberately selects only HUMAN_REVIEWED cases and returns no scored cases for this AI copy. Without that flag, the command above scores the 14 decided cases, including nine positive ranking cases. The API subsection still uses the baseline endpoint; E5 is compared through the pinned direct ranker.
