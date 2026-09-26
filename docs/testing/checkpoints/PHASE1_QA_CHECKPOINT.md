# Phase 1 QA checkpoint — 2026-09-21

Project: SIH26035 — NAWI OIML R76 Test & Report System

## Runtime checkpoint

- Repository root: `C:/Users/radax/Documents/Codex/2026-09-09/files-mentioned-by-the-user-screenshot`
- Branch: `main`
- Application health: backend `GET /api/health` returned HTTP 200; frontend `GET /` returned HTTP 200.
- Database reset/drop: not performed.
- Protected reports TR-2026-000019, TR-2026-000020 and TR-2026-000021: not modified by the QA run.
- The historical separate project copy was outside this QA run's scope.

## Five-instrument synthetic QA manifest

| Report | Instrument | Unit / Max | A.4.2/A.4.3 | A.4.4 | A.4.7 | A.4.8 | A.4.10 | A.5 | Workflow |
|---|---|---|---|---|---|---|---|---|---|
| TR-2026-000022 | OVN-QA-TEST | g / 30000 | PASS | PASS | PASS | PASS | PASS | PASS | AWAITING_REVIEW |
| TR-2026-000023 | OVN-QA-01 | g / 30000 | PASS | PASS | PASS | PASS | PASS | PASS | AWAITING_REVIEW |
| TR-2026-000024 | OVN-QA-02 | kg / 30 | PASS | PASS | PASS | PASS | PASS | PASS | AWAITING_REVIEW |
| TR-2026-000025 | OVN-QA-03 | g / 50000 | PASS | PASS | PASS | PASS | PASS | PASS | AWAITING_REVIEW |
| TR-2026-000026 | OVN-QA-04 | kg / 40 | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | AWAITING_REVIEW |

The failing record uses intentionally invalid synthetic observations so the
application's failure paths were exercised without altering protected records.

All five records are Class I configurations for which A.6 is not applicable;
no endurance data was fabricated. A.6 coverage on a Class III record remains a
separate follow-up limitation.

## Verification performed

- Verification, A.4.2, A.4.3, A.4.4, A.4.7, A.4.8, A.4.10 and A.5 workflows were exercised through the application APIs.
- All five reports were submitted through the existing review endpoint; no direct database writes were used.
- Server build and test suite: 113 tests passed.
- Client TypeScript build: passed.
- `git diff --check`: passed.
- Browser dashboard verification: the Awaiting Review card now renders `5` instead of `NaN`, matching the backend workflow summary.

## Targeted stabilization change

`client/src/features/dashboard/TesterDashboardWorkspace.tsx` now reads the
Awaiting Review card from the backend's scalar `workflowSummary.awaitingReview`
aggregate instead of coercing the `awaitingReview` report list to a number.
