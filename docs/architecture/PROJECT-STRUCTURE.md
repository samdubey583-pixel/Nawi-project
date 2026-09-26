# Project structure

This is the existing NAWI MERN-style application, organized by responsibility.

## Frontend

- client/src/main.tsx - React entry point, routing, authentication provider, shell and dashboard routes.
- client/src/features/test-reports/ - New Test Report workflow and feature-specific state/UI.
- client/src/assets/ - Shared visual assets.
- client/src/styles.css - Shared design tokens and styles.

## Backend

- server/src/index.ts - Express composition and route registration.
- server/src/config/database.ts - MongoDB/Mongoose connection setup.
- server/src/middleware/ - Authentication and role authorization.
- server/src/routes/ - HTTP API route modules.
- server/src/models/ - Mongoose persistence models.
- server/scripts/ - Explicit seed, reset, maintenance, and test utilities.
- client/scripts/testing/ - Client test runner.

## Database boundaries

- users stores authentication and user-role records.
- testReports stores Tester report applications.
- counters stores atomic sequential-number counters.

Keep future domain features under client/src/features/ and add matching backend models/routes under server/src/models/ and server/src/routes/.
