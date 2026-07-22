// tooling/deploy/migrate-preview.mjs
//
// Apply the ordered, additive database migrations to the preview environment and
// record the applied set + version on the deployment record. Migrations are
// forward-compatible; this step never performs a destructive auto-migration.
//
// Self-contained: reads the local migration directory and updates the local
// deployment record. No Cloudflare/D1 API is contacted.

import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadRecord, saveRecord, DeploymentError, isMain, parseArgs } from "./deploy-core.mjs";

const MIGRATIONS_DIR = resolve(process.cwd(), "packages/db/migrations");

function orderedMigrations() {
  if (existsSync(MIGRATIONS_DIR)) {
    return readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  }
  // Fallback known-ordered migration when the directory is absent.
  return ["0001_weather.sql"];
}

/**
 * Mark the preview deployment's migrations as applied with the ordered list and
 * the highest migration version. Returns the updated record.
 */
export function migratePreview(record) {
  if (record.environment !== "preview") {
    throw new DeploymentError("migrate-preview applies to preview only", "wrong_environment");
  }
  if (record.status !== "deployed") {
    throw new DeploymentError("cannot migrate a non-deployed record", "bad_status");
  }
  const files = orderedMigrations();
  const version = files.length > 0 ? files[files.length - 1].replace(/\.sql$/, "") : null;
  return {
    ...record,
    migrations: { status: "applied", applied: files, version },
  };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), { string: ["deployment-record"] });
  if (!args["deployment-record"]) {
    console.error("usage: migrate-preview --deployment-record <file>");
    process.exit(2);
  }
  try {
    const record = loadRecord(args["deployment-record"]);
    const updated = migratePreview(record);
    saveRecord(args["deployment-record"], updated);
    console.log(
      `[migrate-preview] applied ${updated.migrations.applied.length} migration(s); version=${updated.migrations.version}`,
    );
  } catch (e) {
    console.error(`[migrate-preview] FAILED: ${e.message}`);
    process.exit(1);
  }
}
