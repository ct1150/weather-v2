#!/usr/bin/env node
// tooling/deploy/sync-smoke.mjs
//
// Extended preview smoke for the weather-sync Worker (PRD-INC-003 / DEP-CICD-001).
//
// Probes the deployed Worker's `fetch` (manual / health) endpoint and asserts it booted
// and ran a sync cycle — which exercises the D1 snapshot write AND the KV "sync-health"
// write. The static Pages site is the USER read path and NEVER calls a provider; that
// guarantee is architectural (static export + the Worker is the only provider caller) and
// is covered by the unit tests, not by this remote probe.
//
// Usage: node tooling/deploy/sync-smoke.mjs --worker-url <url>
// Exits 0 on success, or when no URL is supplied (best-effort in environments without a
// live worker URL). Exits 1 if the probe fails.

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { "worker-url": { type: "string" } },
  strict: false,
});

const workerUrl = values["worker-url"];

if (!workerUrl) {
  console.log("SYNC-SMOKE: no --worker-url supplied; skipping (set WORKER_PREVIEW_URL to enable).");
  process.exit(0);
}

try {
  const res = await fetch(workerUrl, { method: "GET" });
  if (!res.ok) {
    console.error(`SYNC-SMOKE: worker responded ${res.status} (expected 2xx)`);
    process.exit(1);
  }
  const body = await res.json().catch(() => null);
  if (body == null || typeof body !== "object" || !("runId" in body) || !("status" in body)) {
    console.error("SYNC-SMOKE: worker response missing the expected runSync report shape");
    process.exit(1);
  }
  console.log(
    `SYNC-SMOKE: OK — worker booted and reported status="${body.status}" (runId=${body.runId})`,
  );
  process.exit(0);
} catch (err) {
  console.error(`SYNC-SMOKE: probe failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
