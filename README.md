# VastFix

VastFix is a proposed web application for reporting and resolving campus infrastructure issues. It is the final-year group project of seven Information and Communication Technology students at the University of Science and Technology of Hanoi (USTH) for the 2026–2027 academic year.

**Project status:** Checkpoint 1 reporter and manager interfaces are integrated with the reporting APIs, authentication foundation and FastAPI duplicate-ranking service. The target submission date is **12 January 2027**.

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
- [Checkpoint 1 FastAPI service and duplicate-ranking spike](ai-service/README.md)

The FastAPI service runs separately from the database starter. It consumes candidate reports selected by the Next.js backend.

## Local web foundation

The Next.js application runs from the repository root. Follow the [step-by-step web setup](docs/Web_Foundation_Step_by_Step.md) to install dependencies, start PostgreSQL and open the development-only database check page.

The existing schema, migrations and seed in `database-starter/` remain the database source of truth. Root package scripts expose these commands for the web application. `database-starter/` can still be run independently with its original instructions and lockfile.

The app includes reporting/manager APIs, duplicate suggestions, and an authentication foundation. Email verification is tested locally with Mailpit; actual external email delivery still needs SMTP configuration. Follow the [authentication walkthrough](docs/Auth_Implementation_Step_by_Step.md) and [verification record](docs/Auth_Verification_2026-11-19.md). Full workflow UI and merge/unmerge operations remain in development.

## Reporter frontend and shared interface

Dương's reporting form is available at `/vi/reports/new` and `/en/reports/new`. It uses Sơn's shared shell and translations, Chúc's report/suggestion APIs, and Hải Anh's authentication foundation. The manager queue is available at `/vi/manager/issues`.

- [Dương: setup, scope and integration handoff](docs/Duong_Frontend_Handoff.md)
- [Dương: verification results](docs/Duong_Frontend_Verification.md)
- [Supplemental report-options catalog API](docs/Report_Options_API_v1.md)
- [Sơn: shared components and original frontend handoff](docs/Son_Frontend_Handoff.md)

Build with `npm run build`; run browser checks with `npm run test:ui` and the isolated PostgreSQL integration with `npm run test:reporter-flow`. See the handoff for prerequisites. The integration harness uses fixture AI responses and does not assess ranking quality. Existing v1 report payloads, schema and seed are unchanged by the reporter feature.

## Shared stack (Docker Compose)

`npm run stack:up` builds and starts PostgreSQL, migrations and seed, Mailpit, the FastAPI service and the web app; `npm run check:integration` runs the end-to-end checks. See [Hoang_Anh_Checkpoint1.md](docs/Hoang_Anh_Checkpoint1.md).


## Integrated checkpoint fixes 22 November 2026

The shared branch includes every member's implementation and the independent evaluation dataset. See [the integration verification record](docs/Checkpoint1_Integration_Verification_2026-11-22.txt) for the integration checks. The AI label review and remaining uncertain cases are recorded below.

From the repository root with Node 24 and Docker Desktop running:

```sh
npm ci
npm run demo:env
npm run stack:up
npm run check:integration -- --fallback --auth
npm run check:stack-browser
```

The browser check requires Chrome (or `PLAYWRIGHT_CHANNEL=chromium` with Playwright Chromium installed). It creates a verified synthetic reporter and marked test reports, including more than 25 reports to check pagination, on the local stack. It verifies the actual Docker UI with FastAPI and PostgreSQL; the manager uses the explicit local demo session. Use a dedicated local test stack when keeping demo data clean matters. `STACK_DATABASE_URL`, `WEB_URL`, `MAIL_URL`, and the `VASTFIX_*_PORT` variables support separate test ports.

The Docker development server uses Webpack and explicitly permits the loopback dev origin. Demo authentication retains the development-only and loopback checks. Auth fields remain disabled until the client is ready, and native fallback uses POST. The checkpoint queue shows SUBMITTED issues, supports loading subsequent pages, and localizes system location labels with optional `locale=vi|en`; report descriptions stay unchanged.

The repeatable seed now includes H2-03, the difficult H2-04 negative, and a different-floor plumbing negative TAP-1. A1 and these locations/categories are fictional demo catalogs, not an approved campus inventory.

[Independent evaluation data and instructions](evaluation/duplicate-detection/README.md) include reproducible baseline/E5 outputs and a pinned model manifest. The generated source remains provisional/uncertain. A separate AI label review dated 23 November records 14 AI_REVIEWED cases and eight UNCERTAIN cases; no human approval is inferred. See [the complete label review](evaluation/duplicate-detection/AI_Label_Review_2026-11-23.txt).
