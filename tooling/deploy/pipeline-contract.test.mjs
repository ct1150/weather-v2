// tooling/deploy/pipeline-contract.test.mjs
//
// Pipeline contract tests for the self-contained, fail-closed Cloudflare
// preview / migration / promotion pipeline (DEP-FREE-001, DEP-PAGES-001,
// DEP-CICD-001, DEP-CONFIG-001, VISION-COST-001).
//
// These exercise the SAME pure functions the CLI scripts use, proving the
// immutable-artifact identity, environment isolation, migration application,
// preview smoke, and same-artifact production promotion contract. Every
// fail-closed rejection is asserted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  computeArtifactId,
  makeDeploymentRecord,
  assertEnvironment,
  DeploymentError,
  PREVIEW_URL,
  PRODUCTION_URL,
} from "./deploy-core.mjs";
import { deployPreview } from "./deploy-preview.mjs";
import { migratePreview } from "./migrate-preview.mjs";
import { verifyPreviewRepositories } from "./verify-preview-repositories.mjs";
import { previewSmoke } from "./preview-smoke.mjs";
import { promotionDryRun } from "./promotion-dry-run.mjs";

function tempDir(label) {
  return mkdtempSync(join(tmpdir(), `wnr-${label}-`));
}

function makeArtifactDir(dir, files) {
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content, "utf8");
  }
}

test("production workflows keep product analytics deployed and embedded", () => {
  const deploy = readFileSync(
    new URL("../../.github/workflows/deploy.yml", import.meta.url),
    "utf8",
  );
  const refresh = readFileSync(
    new URL("../../.github/workflows/refresh-weather.yml", import.meta.url),
    "utf8",
  );
  const smoke = readFileSync(
    new URL("../../.github/workflows/production-smoke.yml", import.meta.url),
    "utf8",
  );
  assert.match(deploy, /Deploy product-analytics Worker/u);
  assert.match(deploy, /NEXT_PUBLIC_PRODUCT_ANALYTICS_URL/u);
  assert.match(refresh, /NEXT_PUBLIC_PRODUCT_ANALYTICS_URL/u);
  assert.match(smoke, /Product analytics health/u);
});

test("artifact identity is deterministic and content-sensitive", () => {
  const dir = tempDir("art");
  try {
    makeArtifactDir(dir, { "a.txt": "alpha", "b.txt": "beta" });
    const id1 = computeArtifactId(dir);
    const id2 = computeArtifactId(dir);
    assert.equal(id1, id2, "same content -> same id");
    assert.match(id1, /^wnr-[a-f0-9]{32}$/, "non-empty, stable id shape");

    makeArtifactDir(dir, { "a.txt": "ALPHA-CHANGED", "b.txt": "beta" });
    const id3 = computeArtifactId(dir);
    assert.notEqual(id1, id3, "changed content -> different id");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("makeDeploymentRecord isolates preview vs production bindings + cron", () => {
  const preview = makeDeploymentRecord({
    artifactId: "wnr-abc",
    artifactDir: "/tmp/preview",
    environment: "preview",
    boundUrl: PREVIEW_URL,
  });
  assert.equal(preview.environment, "preview");
  assert.equal(preview.cron.enabled, false, "preview has no scheduled bindings");
  assert.equal(preview.repositories.d1.environment, "preview");

  const prod = makeDeploymentRecord({
    artifactId: "wnr-abc",
    artifactDir: "/tmp/prod",
    environment: "production",
    boundUrl: PRODUCTION_URL,
  });
  assert.equal(prod.cron.enabled, true, "production carries the approved cron");
  assert.equal(prod.repositories.d1.environment, "production");
  assert.notEqual(prod.repositories.d1.database, preview.repositories.d1.database);
});

test("makeDeploymentRecord rejects an unknown environment", () => {
  assert.throws(() => assertEnvironment("staging"), DeploymentError);
});

test("deployPreview records preview identity and fails closed on mismatch", () => {
  const dir = tempDir("deploy");
  try {
    makeArtifactDir(dir, { "src/index.ts": "export const x = 1;" });
    const id = computeArtifactId(dir);
    const record = deployPreview({ environment: "preview", artifactDir: dir, artifactId: id });
    assert.equal(record.artifactId, id);
    assert.equal(record.boundUrl, PREVIEW_URL);
    assert.equal(record.migrations.status, "pending");

    // Wrong supplied id must be rejected (identity mismatch).
    assert.throws(
      () => deployPreview({ environment: "preview", artifactDir: dir, artifactId: "wnr-wrong" }),
      /artifact identity mismatch/u,
    );
    // Only preview may be deployed through this step.
    assert.throws(
      () => deployPreview({ environment: "production", artifactDir: dir, artifactId: id }),
      /preview only/u,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("migratePreview applies the ordered migration set", () => {
  const dir = tempDir("mig");
  try {
    makeArtifactDir(dir, { "src/index.ts": "x" });
    const id = computeArtifactId(dir);
    const deployed = deployPreview({ environment: "preview", artifactDir: dir, artifactId: id });
    const migrated = migratePreview(deployed);
    assert.equal(migrated.migrations.status, "applied");
    assert.ok(migrated.migrations.applied.length >= 1, "at least one migration applied");
    assert.match(
      String(migrated.migrations.version),
      /^\d+_/,
      "version derived from latest migration",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyPreviewRepositories passes for a valid preview and rejects leaks", () => {
  const dir = tempDir("verify");
  try {
    makeArtifactDir(dir, { "src/index.ts": "x" });
    const id = computeArtifactId(dir);
    const deployed = deployPreview({ environment: "preview", artifactDir: dir, artifactId: id });
    const migrated = migratePreview(deployed);

    const ok = verifyPreviewRepositories(migrated);
    assert.equal(ok.ok, true, "valid preview passes");

    const leaked = {
      ...migrated,
      repositories: {
        d1: { binding: "WNR_DB", database: "wnr-production", environment: "preview" },
        kv: { binding: "WNR_KV", namespace: "wnr-preview-kv", environment: "preview" },
      },
    };
    const bad = verifyPreviewRepositories(leaked);
    assert.equal(bad.ok, false, "production database leaked into preview must fail");
    assert.ok(bad.errors.some((e) => /production binding leaked/u.test(e)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("previewSmoke fails closed on artifact mismatch and missing bound URL", () => {
  const dir = tempDir("smoke");
  try {
    makeArtifactDir(dir, { "src/index.ts": "x" });
    const id = computeArtifactId(dir);
    const deployed = deployPreview({ environment: "preview", artifactDir: dir, artifactId: id });
    const migrated = migratePreview(deployed);

    const ok = previewSmoke({ record: migrated, expectedArtifactId: id, requireBoundUrl: true });
    assert.equal(ok.ok, true, "matching id + bound URL passes");

    const mismatch = previewSmoke({ record: migrated, expectedArtifactId: "wnr-other" });
    assert.equal(mismatch.ok, false, "expected id mismatch must fail");

    const noUrl = previewSmoke({
      record: { ...migrated, boundUrl: "" },
      expectedArtifactId: id,
      requireBoundUrl: true,
    });
    assert.equal(noUrl.ok, false, "require-bound-url must fail when URL missing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("promotionDryRun reuses the same artifact and fails closed on mismatch", () => {
  const dir = tempDir("promo");
  try {
    makeArtifactDir(dir, { "src/index.ts": "x" });
    const id = computeArtifactId(dir);
    const deployed = deployPreview({ environment: "preview", artifactDir: dir, artifactId: id });
    const migrated = migratePreview(deployed);
    const smoke = previewSmoke({ record: migrated, expectedArtifactId: id, requireBoundUrl: true });
    assert.equal(smoke.ok, true);

    const good = promotionDryRun({
      sourceRecord: migrated,
      targetEnvironment: "production",
      expectedArtifactId: id,
      requireSameArtifact: true,
      failClosed: true,
    });
    assert.equal(good.ok, true);
    assert.equal(good.reusedArtifactId, id, "production reuses the verified artifact");
    assert.equal(good.productionRecord.environment, "production");
    assert.equal(good.productionRecord.artifactId, id, "no rebuild: same artifact id");

    // Artifact mismatch must be rejected (fail-closed).
    assert.throws(
      () =>
        promotionDryRun({
          sourceRecord: migrated,
          targetEnvironment: "production",
          expectedArtifactId: "wnr-different",
          requireSameArtifact: true,
          failClosed: true,
        }),
      /REJECTED/u,
    );

    // Wrong target environment must be rejected.
    assert.throws(
      () =>
        promotionDryRun({
          sourceRecord: migrated,
          targetEnvironment: "staging",
          expectedArtifactId: id,
          requireSameArtifact: true,
          failClosed: true,
        }),
      /REJECTED/u,
    );

    // Source must be preview.
    const prodSource = { ...migrated, environment: "production" };
    assert.throws(
      () =>
        promotionDryRun({
          sourceRecord: prodSource,
          targetEnvironment: "production",
          expectedArtifactId: id,
          requireSameArtifact: true,
          failClosed: true,
        }),
      /REJECTED/u,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("end-to-end pure chain: build -> deploy -> migrate -> verify -> smoke -> promote", () => {
  const dir = tempDir("e2e");
  try {
    makeArtifactDir(dir, {
      "src/index.ts": "export const app = 1;",
      "package.json": '{"name":"@wnr/web"}',
      "wrangler.toml": 'name = "where-not-rain"',
    });
    const id = computeArtifactId(dir);
    const deployed = deployPreview({ environment: "preview", artifactDir: dir, artifactId: id });
    const migrated = migratePreview(deployed);

    const verify = verifyPreviewRepositories(migrated);
    assert.equal(verify.ok, true);

    const smoke = previewSmoke({ record: migrated, expectedArtifactId: id, requireBoundUrl: true });
    assert.equal(smoke.ok, true);

    const promote = promotionDryRun({
      sourceRecord: migrated,
      targetEnvironment: "production",
      expectedArtifactId: id,
      requireSameArtifact: true,
      failClosed: true,
    });
    assert.equal(promote.ok, true);
    assert.equal(promote.reusedArtifactId, id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
