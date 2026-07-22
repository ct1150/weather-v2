// tooling/deploy/preview-smoke.mjs
//
// Smoke-check that the preview bound URL serves the recorded immutable artifact.
// The "served" check is a fail-closed content identity check: the artifact
// directory must re-hash to the recorded artifact id (which must match the
// expected artifact id). When --require-bound-url is set, the record must carry a
// non-empty https bound URL.

import { resolve } from "node:path";
import { loadRecord, computeArtifactId, isMain, parseArgs, statSyncSafe } from "./deploy-core.mjs";

/**
 * Verify the preview deployment serves the recorded artifact.
 * @returns {{ ok: boolean, errors: ReadonlyArray<string>, actualArtifactId: string|null }}
 */
export function previewSmoke({ record, expectedArtifactId, requireBoundUrl = false }) {
  const errors = [];
  if (!record.artifactId) errors.push("deployment record has no artifactId");
  if (expectedArtifactId !== undefined && record.artifactId !== expectedArtifactId) {
    errors.push(`expected artifact ${expectedArtifactId} != recorded ${record.artifactId}`);
  }

  // Fail-closed: the bound artifact content must re-hash to the recorded identity.
  let actual = null;
  try {
    const st = statSyncSafe(record.artifactDir);
    if (st === null || !st.isDirectory()) {
      errors.push(`artifact dir missing: ${record.artifactDir}`);
    } else {
      actual = computeArtifactId(resolve(record.artifactDir));
      if (actual !== record.artifactId) {
        errors.push(`recorded artifact ${record.artifactId} != content hash ${actual}`);
      }
    }
  } catch (e) {
    errors.push(`cannot verify artifact content: ${e.message}`);
  }

  if (requireBoundUrl) {
    if (typeof record.boundUrl !== "string" || !/^https:\/\//u.test(record.boundUrl)) {
      errors.push("bound URL is required and must be an https URL");
    }
  }

  return { ok: errors.length === 0, errors, actualArtifactId: actual };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["deployment-record", "expected-artifact-id"],
    boolean: ["require-bound-url"],
  });
  if (!args["deployment-record"]) {
    console.error(
      "usage: preview-smoke --deployment-record <file> [--expected-artifact-id <id>] [--require-bound-url]",
    );
    process.exit(2);
  }
  try {
    const record = loadRecord(args["deployment-record"]);
    const result = previewSmoke({
      record,
      expectedArtifactId: args["expected-artifact-id"],
      requireBoundUrl: Boolean(args["require-bound-url"]),
    });
    if (!result.ok) {
      for (const e of result.errors) console.error(`[preview-smoke] ${e}`);
      console.error("[preview-smoke] FAILED");
      process.exit(1);
    }
    console.log(
      `[preview-smoke] OK: bound URL ${record.boundUrl} serves artifact ${record.artifactId}`,
    );
  } catch (e) {
    console.error(`[preview-smoke] FAILED: ${e.message}`);
    process.exit(1);
  }
}
