# NAWI Test & Report System

NAWI is a full-stack application for instrument registration, OIML R 76 test execution, evidence capture, report review, and report generation.

## Application layout

- `client/` — React, TypeScript, and Vite application.
- `server/` — Express, TypeScript, and MongoDB/Mongoose API.
- `scripts/dev.mjs` — starts the active client and server development processes.
- `server/scripts/` and `client/scripts/` — explicit seed, maintenance, reset, and test utilities.
- `docs/` — deployment, architecture, testing, and historical QA notes.

The active application is the root `client/` and `server/` pair. No nested duplicate application is used.

## Local development

Requirements: Node.js 20+ and a MongoDB instance.

```sh
npm run install:all
```

Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` and a strong `JWT_SECRET`. Then start MongoDB and run:

```sh
npm run dev
```

The Vite client is served at `http://localhost:5173` and the API at `http://localhost:4000`. The Vite proxy handles `/api` in development. See [deployment preparation](docs/deployment/PREPARATION.md) for phone capture and environment details.

## Build and tests

```sh
npm run build
npm test
```

`npm run build` type-checks/builds the server and client. `npm test` runs both test suites. Start the built API with `npm start` after building and configuring the server environment.

## Account setup and data safety

Public registration creates tester accounts; role changes require an authenticated administrator. Configure initial admin credentials through `server/.env` and run `npm run seed:admin` only when intentionally provisioning that account. Seed/reset/maintenance scripts are explicit operations and are not run on application startup. In particular, `server/scripts/reset/` contains destructive test-data utilities: inspect the script and target database before running it. Never commit `.env` files or production secrets.

## Documentation

- [Architecture and source map](docs/architecture/PROJECT-STRUCTURE.md)
- [Deployment preparation](docs/deployment/PREPARATION.md)
- [QA checkpoints](docs/testing/checkpoints/)
