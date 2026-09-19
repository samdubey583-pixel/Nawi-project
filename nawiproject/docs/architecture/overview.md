# NAWI architecture overview

NAWI is a React/Vite tester workspace backed by an Express/Mongoose API. The repository is organized around product features on the client and domain modules on the server.

- `client/src/app` bootstraps the browser, routing, and authentication provider.
- `client/src/features` contains login, dashboard, instruments, and report-lifecycle UI.
- `client/src/testing` contains tester-facing OIML clause workspaces.
- `server/src/modules` contains auth, dashboard, instruments, reports, and testing domains.
- `server/src/config` and `server/src/middleware` remain application infrastructure.
- `docs` contains project documentation; generated artifacts belong in `outputs`.
