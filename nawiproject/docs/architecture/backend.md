# Backend structure

Express bootstrap remains in `server/src/index.ts`. Domain routes and services are grouped under `server/src/modules`: auth, dashboard, instruments, reports, and testing. Administrative routes now live alongside the auth domain in `server/src/modules/auth/admin.routes.ts`.

Testing is split into shared `engine` and `calculations`, then clause modules. Models live with the domain that owns their persistence rather than in a global model bucket.
