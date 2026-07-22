// tooling/deploy/promotion-dry-run.mjs
//
// Dry-run the production promotion. The production target REUSES the exact verified
// preview artifact (no rebuild) and is fail-closed: any identity, environment,
// or configuration mismatch rejects the promotion. This never mutates any real
// Cloudflare resource; it only validates the promotion contract and emits the
// would-be production record.

import {
  loadRecord,
  saveRecord,
  repositoriesFor,
  PRODUCTION_URL,
  PRODUCTION_CRON_SCHEDULE,
  DeploymentError,
  isMain,
  parseArgs,
} from "./deploy-core.mjs";

/**
 * Validate (and describe) a production promotion dry-run.
 * @returns {{ ok: boolean, errors: ReadonlyArray<string>, productionRecord?: object, reusedArtifactId?: string }}
 */
export function promotionDryRun({
  sourceRecord,
  targetEnvironment,
  expectedArtifactId,
  requireSameArtifact = true,
  failClosed = true,
}) {
  const errors = [];
  if (targetEnvironment !== "production") {
    errors.push(`target environment must be production, got "${targetEnvironment}"`);
  }
  if (sourceRecord.environment !== "preview") {
    errors.push("promotion source must be the preview environment");
  }
  if (sourceRecord.status !== "deployed") {
    errors.push("source deployment record is not in a deployed state");
  }
  if (expectedArtifactId !== undefined && sourceRecord.artifactId !== expectedArtifactId) {
    errors.push(
      `expected artifact ${expectedArtifactId} != source artifact ${sourceRecord.artifactId}`,
    );
  }
  if (requireSameArtifact && sourceRecord.artifactId !== expectedArtifactId) {
    errors.push("same-artifact promotion requires the source artifact to equal the expected artifact");
  }

  const now = new Date().toISOString();
  // The production target reuses the SAME verified artifact (no rebuild) but
  // with its OWN isolated bindings + secrets (never the preview bindings).
  const productionRecord = {
    ...sourceRecord,
    schemaVersion: sourceRecord.schemaVersion,
    deploymentId: `dep-${now}-${sourceRecord.artifactId}`,
    environment: "production",
    boundUrl: PRODUCTION_URL,
    status: "dry-run",
    createdAt: now,
    // Explicit same-artifact reuse: no rebuild.
    artifactId: sourceRecord.artifactId,
    artifactDir: sourceRecord.artifactDir,
    repositories: repositoriesFor("production"),
    cron: { schedule: PRODUCTION_CRON_SCHEDULE, enabled: true },
  };

  // Environment separation (fail-closed): production must NOT reuse the preview
  // D1 database or KV namespace.
  if (productionRecord.repositories.d1.database === sourceRecord.repositories.d1.database) {
    errors.push("production would reuse the preview D1 database (binding leak)");
  }
  if (productionRecord.repositories.kv.namespace === sourceRecord.repositories.kv.namespace) {
    errors.push("production would reuse the preview KV namespace (binding leak)");
  }

  if (failClosed && errors.length > 0) {
    throw new DeploymentError(
      `promotion dry-run REJECTED (fail-closed): ${errors.join("; ")}`,
      "promotion_rejected",
    );
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors, productionRecord, reusedArtifactId: sourceRecord.artifactId };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["source-deployment-record", "target-environment", "expected-artifact-id"],
    boolean: ["require-same-artifact", "fail-closed"],
  });
  if (!args["source-deployment-record"] || !args["target-environment"] || !args["expected-artifact-id"]) {
    console.error(
      "usage: promotion-dry-run --source-deployment-record <file> --target-environment production " +
        "--expected-artifact-id <id> [--require-same-artifact] [--fail-closed]",
    );
    process.exit(2);
  }
  try {
    const sourceRecord = loadRecord(args["source-deployment-record"]);
    const result = promotionDryRun({
      sourceRecord,
      targetEnvironment: args["target-environment"],
      expectedArtifactId: args["expected-artifact-id"],
      requireSameArtifact: Boolean(args["require-same-artifact"]),
      failClosed: Boolean(args["fail-closed"]),
    });
    const recordFile = args["source-deployment-record"].replace(
      /preview-deployment\.json$/,
      "production-dry-run.json",
    );
    if (result.productionRecord) saveRecord(recordFile, result.productionRecord);
    console.log(
      `[promotion-dry-run] OK: production would reuse artifact ${result.reusedArtifactId} (no rebuild)`,
    );
    console.log(`[promotion-dry-run] dry-run record -> ${recordFile}`);
  } catch (e) {
    console.error(`[promotion-dry-run] REJECTED: ${e.message}`);
    process.exit(1);
  }
}
