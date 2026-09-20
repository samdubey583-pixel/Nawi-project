# NAWI Test & Report System

Authentication foundation for the SIH 2026 OIML R-76 application.

## Setup

1. Install Node.js 20+ and MongoDB Community (or use a MongoDB Atlas URI).
2. From the project root run `npm install`, `npm install --prefix server`, and `npm install --prefix client`.
3. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` and a long random `JWT_SECRET`. Optionally create `client/.env` with `VITE_API_URL=http://localhost:4000/api`.
4. Start MongoDB, then run `npm run dev` from the root. Frontend: http://localhost:5173; API: http://localhost:4000. Leave `VITE_API_URL` unset for the normal Vite same-origin `/api` proxy; do not point it at `localhost` for phone capture.

For phone evidence capture during local development, connect the phone and computer to the same Wi-Fi network. The Vite server binds to the LAN and proxies `/api` to the local API. The backend derives a private LAN address for QR codes when possible; for a fixed/reachable address, set `MOBILE_CAPTURE_BASE_URL=http://<PC-LAN-IP>:5173` in `server/.env` (do not commit a personal IP). QR generation refuses loopback-only URLs instead of producing a phone link to `localhost`.

Public registration always creates `TESTER`; the backend ignores any role sent by the client. Set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and optional name fields in `server/.env`, then run `npm run seed:admin --prefix server` to create or ensure the initial ADMIN account. Never commit that `.env` file.

Admins use `GET /api/admin/users` and `PATCH /api/admin/users/:id` with `{ "role": "TESTER|REVIEWER|ADMIN" }` or `{ "isActive": true|false }`. These endpoints require an authenticated ADMIN. The final active ADMIN cannot be demoted or deactivated.

To verify MongoDB persistence: `mongosh`, then `use nawi-test-report`, then `db.users.find({}, {passwordHash:0}).pretty()`. Password hashes are excluded from normal queries and never returned by API responses.

## Structure

`client/src/main.tsx` contains routing, auth context, auth pages, reusable form primitives, and placeholder dashboards. `server/src` contains the Express app, User model, auth routes, and reusable auth/role middleware.

## Complete now

Email/password registration and login, bcrypt hashing, normalized unique emails, HTTP-only JWT cookie sessions, logout, `/me`, protected routing, role-aware placeholder destinations, responsive accessible UI, validation/error/loading states, and reset flow placeholders.

## Intentionally deferred

Email delivery/token persistence for password reset, admin user management, instruments, test sessions, calculations, verified OIML rules, reports, approvals, audit trails, and social login.
