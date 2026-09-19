# API endpoints

The current API is registered in `server/src/index.ts`:

- `GET /api/health`
- `/api/auth` — login, registration, session, and password-recovery routes
- `/api/admin` — existing administrative routes
- `/api/dashboard` — tester dashboard data
- `/api/instruments` — instrument repository and registration
- `/api/test-reports` — report lifecycle, testing, review, and persistence routes

The exact method-level handlers remain in each module's route file.
