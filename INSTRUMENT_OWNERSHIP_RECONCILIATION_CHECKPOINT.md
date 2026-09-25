# Instrument ownership reconciliation checkpoint — 2026-09-21

Project: SIH26035 — NAWI OIML R76 Test & Report System

## Current tester

- Account: `samarthtest@gmail.com`
- User id: `6aa1b70117168b4c36cf5944`
- Repository count after reconciliation: 7

## Exact targeted database changes

Only the five named QA instruments were changed:

| Instrument | Instrument id | Previous `registeredBy` | New `registeredBy` | Linked report |
|---|---|---|---|---|
| OVN-QA-TEST | `6ab04bde40bd550db667412e` | QA Runner `6ab04b9940bd550db6674127` | current tester | TR-2026-000022 |
| OVN-QA-01 | `6ab04c2940bd550db6674139` | QA Runner `6ab04b9940bd550db6674127` | current tester | TR-2026-000023 |
| OVN-QA-02 | `6ab04c2940bd550db6674141` | QA Runner `6ab04b9940bd550db6674127` | current tester | TR-2026-000024 |
| OVN-QA-03 | `6ab04c2940bd550db6674149` | QA Runner `6ab04b9940bd550db6674127` | current tester | TR-2026-000025 |
| OVN-QA-04 | `6ab04c2940bd550db6674151` | QA Runner `6ab04b9940bd550db6674127` | current tester | TR-2026-000026 |

For the same five exact reports, only the tester access fields were changed:

- `submittedBy`
- `testerId`

No report status, stage, instrument reference, observations, calculations, evidence, timestamps, reviewer decisions, or audit-history entries were changed. The original QA identity remains visible in `testerNameSnapshot` and in existing test/audit records.

## Preserved report state

- TR-2026-000022: COMPLETED / FINAL_REPORT, PASS.
- TR-2026-000023: AWAITING_REVIEW / REVIEW, PASS.
- TR-2026-000024: AWAITING_REVIEW / REVIEW, PASS.
- TR-2026-000025: AWAITING_REVIEW / REVIEW, PASS.
- TR-2026-000026: REJECTED / REVIEW, FAIL.

Created and updated timestamps and audit-history counts were unchanged for all five reports. Each report remains linked to its original instrument id. No duplicate QA serial numbers exist.

## Verification

- Direct database query returns exactly seven instruments for the current tester: NTW-80C, PWB-500N, and the five QA instruments.
- The five QA reports are now accessible through the current tester ownership filter.
- Reviewer dashboard still returns 3 awaiting review, 1 approved/completed, 1 rejected, and 0 retest-required QA records.
- Reviewer browser view of TR-2026-000026 still shows the intentional FAIL and rejected decision.
- Server tests: 116 passed.
- Client TypeScript check: passed.
- Client production build: passed.
- `git diff --check`: passed.

## Safety

- No database reset, collection drop, deletion, replacement, or broad reassignment was performed.
- No new instrument or report was created.
- The global instrument collection remains intact; six pre-existing instruments remain alongside the five reconciled QA instruments.
- A.4, A.5, A.6 calculations and test observations were not modified.
