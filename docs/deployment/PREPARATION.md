# NAWI deployment preparation

This repository's active application is the root `server/` and `client/` trees. No provider-specific deployment configuration is selected here.

## Local production builds

From the repository root:

```sh
npm run install:all
npm run build
npm test
```

The API starts from the server package directory so `server/.env` is loaded:

```sh
npm start
```

The root development database remains `nawi-test-report`; production startup now requires an explicit `MONGODB_URI` and never falls back to that local URI. Starting the API does not seed or reset any collection. `/api/health` reports database readiness rather than merely process liveness.

## Environment

Backend variables:

- `NODE_ENV=production`
- `PORT` (provided by the host when applicable)
- `MONGODB_URI` (production-only MongoDB database URI; never put it in source control)
- `JWT_SECRET` (unique random secret, at least 32 characters)
- `CLIENT_URL` (comma-separated allowed HTTPS frontend origins)
- `VITE_PUBLIC_APP_URL` (canonical public HTTPS app origin for production QR sessions; Vercel URL variables are also recognized by the QR resolver; startup fails closed without a valid target)
- `MOBILE_CAPTURE_BASE_URL` (development/LAN only; do not set it in production)
- `EVIDENCE_SESSION_TTL_SECONDS` (optional; defaults to 900)

Frontend build variables:

- `VITE_API_URL` (optional public API base ending in `/api`; omit when `/api` is reverse-proxied on the app origin)
- `VITE_PUBLIC_APP_URL` (public app origin if the client needs to construct public links)

Do not use local HTTP or LAN values for production origins. Because auth uses an HTTP-only `SameSite=Lax` cookie, prefer same-origin `/api` proxying or frontend and API hostnames under the same registrable site. A cross-site API deployment would require a separate CSRF/cookie architecture decision before deployment; do not weaken cookie policy to work around it.

## QR and evidence

The API creates an opaque random upload token and stores only its SHA-256 hash in MongoDB with report/test ownership and expiry. QR links use `VITE_PUBLIC_APP_URL` or the deployment URL in production and reject loopback/private origins. Mobile image uploads are restricted to JPEG/PNG/WebP and 3 MiB; evidence bytes and association metadata are stored in MongoDB, not an instance filesystem. The normal file endpoint requires authentication and report/workspace authorization. Production QR behavior still needs a real HTTPS/phone test after deployment.

The deployed host must route `/mobile/evidence/:token` to the client SPA and `/api/*` to the API. The root repository has no provider-specific rewrite yet because the deployment provider and topology have not been selected.

## Database initialization and demo seed status

There is intentionally no automatic database wipe or seed on application startup. The current `seedDemoAccounts` helper is no longer called by runtime startup. A production seed/reset must be a separate command with an exact target database-name confirmation and must populate a reviewed, curated fixture. No production seed command is enabled yet: the source-pattern showcase exists only in the developer's MongoDB, and this preparation pass has not exported/copied that database (which the supplied brief forbids). The prepared seed will need two demo credentials and the reviewed report/instrument/evidence fixture before it is safe to initialize a clean production database. Do not treat `seed:admin` as the production demo initializer.

Do not run `reset:test-data` against production. Do not run any seed/reset command until the production database URI and exact database name have been reviewed.

## Production prerequisites still needing a deployment decision

1. Select the frontend/API hosting topology and deployment domain.
2. Create a dedicated production MongoDB database and provide its URI privately at deployment time.
3. Generate a unique `JWT_SECRET` and set the exact allowed `CLIENT_URL` origin(s).
4. Approve/provide the two demo login passwords through deployment secrets (or explicitly allow generated one-time credentials).
5. Review a curated demo fixture and explicit, guarded seed command before initializing the clean production database.
6. After deployment, verify HTTPS login, QR upload from a physical phone, reviewer access, draft/final PDFs, and SPA/API rewrites.

No deployment or production database operation has been performed.
