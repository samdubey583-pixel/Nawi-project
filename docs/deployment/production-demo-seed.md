# Curated production demo seed

The production demo seed creates one isolated NAWI demo workspace: Demo Tester, Demo Reviewer, the ATOM A-121 demo instrument, one submitted completed showcase report reconstructed from the synthetic TR-2026-000052 scenario, one fresh testing report, eleven persisted completed A.4/A.5/A.6 records, and one portable synthetic evidence illustration. The showcase and evidence are explicitly marked synthetic; the image is not manufacturer evidence or a physical measurement claim.

The seed does not run on application startup and does not copy the local database. It never drops or deletes records. It refuses to proceed if the connection target is ambiguous or the target database contains non-seed users, instruments, reports, tests, evidence, or support-workflow records.

To run it intentionally against a newly initialized production demo database, provide the normal production `MONGODB_URI` through the deployment environment and set:

```text
NODE_ENV=production
NAWI_PRODUCTION_DEMO_SEED=true
NAWI_PRODUCTION_DEMO_DB_NAME=nawi-production-demo
```

The MongoDB URI must name exactly `nawi-production-demo`; local/private MongoDB hosts are refused. Run the normal server build first so the fixture is copied alongside the compiled seed utility, then run `npm run seed:production-demo --prefix server`. No credential or production secret is embedded in source. Demo access uses the application's existing role-specific demo-login flow.

The deterministic report identifiers are `DEMO-TR-2026-0001` (awaiting reviewer) and `DEMO-TR-2026-0002` (fresh testing). The fixed document IDs make repeated runs idempotent; existing matching records are preserved rather than overwritten.

For local verification, `npm run test:production-demo-seed --prefix server` builds the server, seeds a dedicated `nawi-seed-test-<pid>` database on a local MongoDB instance, checks counts and reviewer visibility, runs the seed a second time, and drops only that disposable test database. It never targets the configured application database name.
