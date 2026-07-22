// tooling/deploy/deploy-core.mjs
//
// Shared, dependency-free primitives for the self-contained, fail-closed Cloudflare
// preview / migration / promotion pipeline (DEP-FREE-001, DEP-PAGES-001,
// DEP-CICD-001, DEP-CONFIG-001, VISION-COST-001).
//
// No real Cloudflare API is ever contacted. Every step operates on local
// filesystem artifacts and a JSON deployment record with strict identity / artifact
// checks. The production promotion reuses the EXACT verified preview artifact
// rather than rebuilding different code.

import { createHash } from "node:crypto";
import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** Environments the pipeline understands. Preview and production are isolated. */
export const DEPLOY_ENVIRONMENTS = Object.freeze(["preview", "production"]);
export const SCHEMA_VERSION = 1;

/** Stable, free-plan-safe bound URLs used by the (local) deployment record. */
export const PREVIEW_URL = "https://preview.where-not-rain.pages.dev";
export const PRODUCTION_URL = "https://where-not-rain.pages.dev";

/** Cloudflare Cron schedule for production (hourly weather sync + maintenance). */
export const PRODUCTION_CRON_SCHEDULE = "0 * * * *";

/** True only when `url` is the module invoked directly on the CLI. */
export function isMain(url) {
  return url === pathToFileURL(process.argv[1]).href;
}

/** Thrown by any pipeline step that must stop promotion (fail-closed). */
export class DeploymentError extends Error {
  constructor(message, code = "deployment_error") {
    super(message);
    this.name = "DeploymentError";
    this.code = code;
  }
}

/** `statSync` that returns null instead of throwing on a missing path. */
export function statSyncSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

/** Reject an environment that is not preview/production (fail-closed). */
export function assertEnvironment(env) {
  if (!DEPLOY_ENVIRONMENTS.includes(env)) {
    throw new DeploymentError(`unknown environment "${env}"`, "invalid_environment");
  }
}

function collectFiles(root, current, out) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(current, entry.name);
    if (entry.isDirectory()) {
      collectFiles(root, full, out);
    } else if (entry.isFile()) {
      out.push(relative(root, full).split(sep).join("/"));
    }
  }
}

/**
 * Deterministic, order-independent SHA-256 over every file in a directory.
 * Two directories with identical file paths + contents hash to the same value;
 * any content difference changes the identity. Never traverses node_modules.
 */
export function hashArtifactDir(dir) {
  const st = statSyncSafe(dir);
  if (st === null || !st.isDirectory()) {
    throw new DeploymentError(`artifact dir not found: ${dir}`, "missing_artifact_dir");
  }
  const paths = [];
  collectFiles(dir, dir, paths);
  paths.sort();
  const hash = createHash("sha256");
  for (const p of paths) {
    hash.update(p);
    hash.update("\u0000");
    hash.update(readFileSync(join(dir, p)));
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

/** A stable, non-empty artifact identity derived from the artifact contents. */
export function computeArtifactId(dir) {
  return `wnr-${hashArtifactDir(dir).slice(0, 32)}`;
}

/** Environment-isolated D1 / KV binding inventory (no production leak). */
export function repositoriesFor(env) {
  if (env === "preview") {
    return {
      d1: { binding: "WNR_DB", database: "wnr-preview", environment: "preview" },
      kv: { binding: "WNR_KV", namespace: "wnr-preview-kv", environment: "preview" },
    };
  }
  return {
    d1: { binding: "WNR_DB", database: "wnr-production", environment: "production" },
    kv: { binding: "WNR_KV", namespace: "wnr-production-kv", environment: "production" },
  };
}

/**
 * Build the canonical deployment record for a freshly (locally) deployed artifact.
 * Preview has NO scheduled bindings (they run only in production); production
 * carries the approved Cron schedule.
 */
export function makeDeploymentRecord({ artifactId, artifactDir, environment, boundUrl }) {
  assertEnvironment(environment);
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    deploymentId: `dep-${now}-${artifactId}`,
    artifactId,
    artifactDir,
    environment,
    boundUrl,
    status: "deployed",
    createdAt: now,
    migrations: { status: "pending", applied: [], version: null },
    repositories: repositoriesFor(environment),
    cron:
      environment === "production"
        ? { schedule: PRODUCTION_CRON_SCHEDULE, enabled: true }
        : { schedule: "", enabled: false },
  };
}

/** Read + parse a JSON deployment record from disk. */
export function loadRecord(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new DeploymentError(`cannot read deployment record ${file}: ${e.message}`, "record_read_error");
  }
}

/** Serialize + write a JSON deployment record (creating parent dirs). */
export function saveRecord(file, obj) {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  writeFileSync(resolve(file), `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

/**
 * Minimal `--key value` / `--key=value` / `--flag` argument parser.
 * `spec.string` lists keys expecting a value; `spec.boolean` lists flag keys.
 */
export function parseArgs(argv, spec = {}) {
  const strings = new Set(spec.string ?? []);
  const bools = new Set(spec.boolean ?? []);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (typeof tok !== "string" || !tok.startsWith("--")) continue;
    const body = tok.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      out[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    if (bools.has(body)) {
      out[body] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && typeof next === "string" && !next.startsWith("--")) {
      out[body] = next;
      i++;
    } else {
      out[body] = true;
    }
  }
  return out;
}
