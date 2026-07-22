# Task 5 Review

- Spec compliance: ❌
- Documentation quality: Changes requested

## Critical

1. Snapshot/KV publication is unsafe: candidate-derived stable KV keys can expose pending data. Make every weather-derived read-model key snapshot-scoped; validate candidate first, write immutable undiscoverable keys, activate D1 pointer transactionally, then update a small KV manifest pointer. Old pointer is safe; pointer miss/new-key miss falls back to D1 active only.

## Important

2. Make score reproduction unique: define weather/destination/combined confidence formulas; season boundary precedence; exact time-window aggregation and volatility penalty; exact `Other` factor mappings for Beach/Photography/Night/Food/Shopping.
3. Make API contract-testable: add error-to-HTTP mapping; exact per-endpoint parameter enums/bounds/unknown-param rejection; exact per-endpoint Cache-Control, ETag/validator, and cache-key rules.

## Re-review findings

1. Add immutable `rankingVersion` identity. Weather keys remain snapshot-scoped; ranking/map keys include both snapshotId and rankingVersion. The manifest points to both. Maintenance may publish a new validated rankingVersion for the current active snapshot, then atomically update only the manifest if the snapshot is still active.
2. Define activation coverage exactly: denominator is enabled cities captured at run start; require valid 7-day coverage for >=95% overall and 100% of featured cities. Enforce singleton active pointer with `CHECK(pointer_key='weather')`, a unique partial index for one active snapshot, and a trigger/repository transaction that only points to status active.
3. Complete score inputs: exact raw-to-factor normalization; exact combined factor meaning; visibility storage/derivation; unambiguous Beach water/season source; exact Other mappings; remove every optional/ambiguous branch.
4. Define exact field-level success `data` schema for all 9 public endpoints, including types, required/nullable, arrays, cursor, snapshot/model/freshness and compact map fields.

## Final re-review findings

1. Add fencing token to publication lock and make D1 active publication identity authoritative on every uncached user read. KV manifest is only a hint and must match D1; stale-holder KV writes are ignored. D1 activation must condition on the captured fencing token.
2. Scope pointer invariant to post-bootstrap. Add immutable bootstrapped state and deletion protection; state 0 permits no pointer, state 1 requires the singleton. Clarify repository transaction is the only write path and schema guarantees at-most-one while protocol guarantees post-bootstrap exactly-one.
3. Persist score provenance: anchor/asOf, included dates, source row/time range, score/hazard model versions and alert snapshot. Add normalized weather alerts and exact hourly/daily hazard binding.
4. Make map bounds→region/tile selection deterministic and put canonical bounds/region identity in both payload and cache key.
5. Define stale solely from `now - dataUpdatedAt > WEATHER_DATA_MAX_AGE_MINUTES`; validate publication identity against D1. Fix request header as `X-Request-ID` with exact inbound validation/generation/response rules.

## Final two findings

1. Add full provenance to `activity_scores`: anchor/as_of, included dates, weather source row keys/UTC range, alert_snapshot_id, hazard_model_version, and acceptance criteria matching city_scores reproducibility.
2. Separate cached immutable CoreData from per-request API envelope. Cache only CoreData internally (KV/Cache API); on every request recompute stale from now/dataUpdatedAt, generate/propagate X-Request-ID, set generatedAt, and assemble body. ETag hashes only canonical CoreData+identity, never requestId/generatedAt/stale. Final envelope must not be shared; use `private, no-store`. 304 is computed after core resolution and returns current X-Request-ID. Document internal core TTL separately.

## Closure alignment findings

1. Architecture CDN direct-hit path must explicitly apply only to static assets and SSG/ISR HTML, never final `/api/v1` envelopes. API requests always execute per-request identity/core/envelope assembly.
2. User request path must never write KV. CoreData is worker-populated immutable KV; on miss API reads D1 active and does not backfill. Remove optional request-path KV/Cache API stores. Ephemeral Cache API is not used for final or CoreData API responses in this contract.
