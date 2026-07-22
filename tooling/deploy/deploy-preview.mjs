// tooling/deploy/deploy-preview.mjs
//
// "Deploy" the immutable artifact to the isolated preview environment and record it
// with its bound URL + environment identity. Fail-closed: the artifact directory
// must re-hash to the exact artifact id, proving identity before any promotion.
//
// Self-contained: operates on the local JSON deployment record only.

import { resolve } from "node:path";
import { statSyncSafe } from "./deploy-core.mjs";
import {
  computeArtifactId,
  makeDeploymentRecord,
  saveRecord,
  DeploymentError,
  isMain,
  parseArgs,
  PREVIEW_URL,
} from "./deploy-core.mjs";

/**
 * Validate + record a preview deployment. Returns the deployment record; the CLI
 * writes it to disk. Throws on any identity mismatch (fail-closed).
 */
export function deployPreview({ environment, artifactDir, artifactId }) {
  if (environment !== "preview") {
    throw new DeploymentError(
      `deploy-preview targets preview only, got "${environment}"`,
      "wrong_environment",
    );
  }
  const absDir = resolve(artifactDir);
  const st = statSyncSafe(absDir);
  if (st === null || !st.isDirectory()) {
    throw new DeploymentError(`artifact dir missing: ${absDir}`, "missing_artifact_dir");
  }
  const actual = computeArtifactId(absDir);
  if (actual !== artifactId) {
    throw new DeploymentError(
      `artifact identity mismatch: supplied ${artifactId} != computed ${actual}`,
      "artifact_identity_mismatch",
    );
  }
  return makeDeploymentRecord({
    artifactId: actual,
    artifactDir: absDir,
    environment: "preview",
    boundUrl: PREVIEW_URL,
  });
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["environment", "artifact-dir", "artifact-id", "record-file"],
  });
  if (!args["artifact-dir"] || !args["artifact-id"] || !args["record-file"] || !args.environment) {
    console.error(
      "usage: deploy-preview --environment preview --artifact-dir <dir> --artifact-id <id> --record-file <file>",
    );
    process.exit(2);
  }
  try {
    const record = deployPreview({
      environment: args.environment,
      artifactDir: args["artifact-dir"],
      artifactId: args["artifact-id"],
    });
    saveRecord(args["record-file"], record);
    console.log(
      `[deploy-preview] deployed ${record.artifactId} to ${record.environment} at ${record.boundUrl}`,
    );
    console.log(`[deploy-preview] record -> ${args["record-file"]}`);
  } catch (e) {
    console.error(`[deploy-preview] FAILED: ${e.message}`);
    process.exit(1);
  }
}
