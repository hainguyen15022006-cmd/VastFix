# VastFix

VastFix is a proposed web application for reporting and resolving campus infrastructure issues. It is the final-year group project of seven Information and Communication Technology students at the University of Science and Technology of Hanoi (USTH) for the 2026–2027 academic year.

**Project status:** Initial database foundation implemented and verified locally; web/API/AI integration is next. The target submission date is **12 January 2027**.

## Problem

The same broken light, water leak, or damaged facility may be reported several times in different words. Staff can end up reviewing duplicate reports, while reporters cannot easily see whether an issue is already being handled. Indoor locations also need more detail than GPS alone can provide.

## Planned solution

VastFix will support the full workflow from an initial report to a verified resolution:

1. A reporter describes an issue, selects a building, floor, and area, and may attach a photo.
2. Before submission, the system suggests up to five potentially related open reports. The reporter can follow an existing issue or submit a new report.
3. A manager reviews reports, confirms the category, sets a priority, merges or separates reports when needed, and assigns a staff member.
4. The assigned staff member updates progress and submits completion notes and evidence.
5. The manager closes the issue, and the reporter can confirm the outcome or report that it is unsatisfactory.

AI will assist with duplicate suggestions and, if time permits, category suggestions. It will **not** automatically merge reports, set priorities, assign staff, or close issues. Merge actions must be reversible and recorded in an activity log.

## Initial scope

- Three roles: reporter, field staff, and manager.
- A pilot covering approximately 3–5 campus buildings and 4–6 issue categories.
- Indoor location hierarchy: building → floor → area; optional map pins for outdoor issues.
- Vietnamese and English interfaces. User-written descriptions remain in their original language.
- Role-based access to reports, photos, assignments, and management actions.
- In-app notifications and a basic overview of open and overdue issues.

## Proposed technology

- **Web application and API:** Next.js with TypeScript.
- **AI service:** Python and FastAPI, using multilingual text embeddings alongside location and time signals.
- **Data:** PostgreSQL and object storage for photos.
- **Deployment:** Docker Compose for the pilot environment.

These choices follow the current detailed project proposal and may be refined with the supervisor before implementation.

## Evaluation plan

The team plans to build a small, reviewed campus issue dataset with difficult non-duplicate examples and Vietnamese–English pairs. Duplicate retrieval will be measured with Recall@3, Recall@5, and mean reciprocal rank, then compared with location-only and lexical baselines. Any reported results will distinguish Vietnamese–Vietnamese, English–English, and cross-language cases. Demo data will be kept separate from evaluation data.

## Milestones

| Target date | Intended outcome |
| --- | --- |
| 5 November 2026 | Confirm scope, duplicate definition, location model, data model, and API contract. |
| 9 November 2026 | Complete an initial AI feasibility test and connect the web/API/AI skeleton. |
| 30 November 2026 | Demonstrate the reporting-to-resolution workflow without AI. |
| 14 December 2026 | Integrate duplicate suggestions and produce initial evaluation results. |
| 11 January 2027 | Finish testing, documentation, report, and demo preparation. |
| 12 January 2027 | Submit the project. |

## Repository status

The Checkpoint 1 database foundation is in [`database-starter/`](database-starter/README.md): Prisma schema, initial migration, repeatable demo seed, and local PostgreSQL Compose configuration.

- [Team handoff for Chúc and Thành Lê](database-starter/TEAM_HANDOFF.md)
- [Local verification results](database-starter/VERIFICATION.md)
- [Approved API contract v1](docs/VastFix_API_Contract_v1_Da_chot_2026-11-16.md)
- [Report-Issue design](docs/VastFix_Report_Issue_ERD_Draft_2026-11-11.md)

The web API, authentication, runtime authorization, AI service, and merge/unmerge operations are not implemented in this database starter.
