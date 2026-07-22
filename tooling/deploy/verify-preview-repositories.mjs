// tooling/deploy/verify-preview-repositories.mjs
//
// Verify the preview deployment's repositories (D1 / KV) are correctly isolated
// and that migrations have been applied, with no production binding leak and no
// scheduled binding running in preview. Fail-closed: returns {ok:false,errors}
// on any violation (the CLI exits non-zero).

import { loadRecord, isMain, parseArgs } from "./deploy-core.mjs";

/**
 * Validate preview repository isolation + migration state.
 * @returns {{ ok: boolean, errors: ReadonlyArray<string> }}
 */
export function verifyPreviewRepositories(record) {
  const errors = [];
  if (record.environment !== "preview") {
    errors.push(`environment must be preview, got "${record.environment}"`);
  }
  if (record.migrations.status !== "applied") {
    errors.push("migrations have not been applied to preview");
  }
  const { d1, kv } = record.repositories;
  if (d1.environment !== "preview") {
    errors.push(`d1 binding environment is "${d1.environment}", expected preview`);
  }
  if (kv.environment !== "preview") {
    errors.push(`kv binding environment is "${kv.environment}", expected preview`);
  }
  if (/production/i.test(d1.database) || /production/i.test(kv.namespace)) {
    errors.push("production binding leaked into the preview environment");
  }
  if (record.cron.enabled) {
    errors.push("scheduled bindings must not run in preview");
  }
  return { ok: errors.length === 0, errors };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { string: ["deployment-record"] });
  if (!args["deployment-record"]) {
    console.error("usage: verify-preview-repositories --deployment-record <file>");
    process.exit(2);
  }
  try {
    const record = loadRecord(args["deployment-record"]);
    const result = verifyPreviewRepositories(record);
    if (!result.ok) {
      for (const e of result.errors) console.error(`[verify-preview-repositories] ${e}`);
      console.error("[verify-preview-repositories] FAILED");
      process.exit(1);
    }
    console.log(
      "[verify-preview-repositories] preview repositories verified (isolated, migrations applied)",
    );
  } catch (e) {
    console.error(`[verify-preview-repositories] FAILED: ${e.message}`);
    process.exit(1);
  }
}
