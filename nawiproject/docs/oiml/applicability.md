# Applicability mapping

Applicability is calculated by `server/src/modules/testing/engine/testApplicability.ts` from the persisted instrument/report configuration. It exposes applicable, not-applicable, deferred, and configuration-required states to the report route and tester route. The frontend renders those states without guessing missing characteristics.
