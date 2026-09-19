# Project structure

The project is organized by feature on the frontend and domain module on the backend.

## Frontend

- `client/src/app/` — browser bootstrap, routes, and authentication provider.
- `client/src/features/login/` — login, signup, recovery, branding, and login composition.
- `client/src/features/dashboard/` — dashboard UI.
- `client/src/features/instruments/` — instrument repository and registration UI.
- `client/src/features/test-reports/` — report setup, review, and final-report lifecycle UI.
- `client/src/testing/` — tester-facing OIML clause workspaces and guidance.
- `client/src/shared/` — genuinely shared components and utilities.
- `client/src/styles/` — global palette, reset, typography, and global primitives.

## Backend

- `server/src/index.ts` — Express composition and route registration.
- `server/src/modules/auth/` — authentication route and user model.
- `server/src/modules/dashboard/` — dashboard aggregation and route.
- `server/src/modules/instruments/` — instrument persistence and route.
- `server/src/modules/reports/` — report persistence, lifecycle, access, and route.
- `server/src/modules/testing/` — applicability, calculations, clause services, tests, and test models.
- `server/src/config/` and `server/src/middleware/` — application infrastructure.
- `server/src/routes/admin.ts` — retained small administrative route entrypoint.

See `docs/architecture/` and `docs/interviewer/feature-map.md` for the concise ownership map.
