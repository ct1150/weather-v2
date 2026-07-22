#!/usr/bin/env node
// tooling/deploy/qa-deploy-check.mjs
//
// Second-layer QA (independent verification) of `.github/workflows/deploy.yml` for the
// Cloudflare 全家桶 increment. The sandbox cannot reach Cloudflare, so we do NOT run
// wrangler — we assert the pipeline STRUCTURE matches the increment contract
// (docs/15 §4B / §7, PRD-INC-003):
//   - jobs.deploy exists
//   - preview path: `wrangler d1 migrations apply` targets 0001 ONLY (no 0002)
//   - PR uses `wrangler deploy --env preview` (no cron); main uses `--env production`
//   - WEATHER_PRIMARY_PROVIDER=open-meteo + analytics vars are injected
//   - the file documents "only 0001, no 0002"
//
// The `yaml` parser is resolved from an ISOLATED local install (.artifacts/qa-deps) so the
// project itself is never modified. One-time setup:
//   npm install --prefix .artifacts/qa-deps yaml

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const workflowPath = resolve(repoRoot, ".github/workflows/deploy.yml");

// --- resolve the isolated `yaml` parser ------------------------------------
const anchor = resolve(repoRoot, ".artifacts/qa-deps/node_modules/anchor.js");
const require = createRequire(anchor);
let parse;
try {
  ({ parse } = require("yaml"));
} catch {
  console.error(
    "QA-DEPLOY-CHECK: missing isolated yaml parser.\n" +
      "  Run once: npm install --prefix .artifacts/qa-deps yaml",
  );
  process.exit(2);
}

const text = readFileSync(workflowPath, "utf8");
const doc = parse(text);

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
};

// 1. jobs.deploy exists.
check(doc?.jobs?.deploy != null, "jobs.deploy is missing");

const steps = Array.isArray(doc?.jobs?.deploy?.steps) ? doc.jobs.deploy.steps : [];
const runOf = (s) => (typeof s?.run === "string" ? s.run : "");

// 2. Preview D1 migrations apply: present, targets 0001, never 0002.
//    Comments legitimately say "no 0002" — strip that phrasing before scanning so we
//    only fail on a command that would actually APPLY a 0002 migration.
const stripNo0002 = (s) => s.replace(/no\s*0002/gi, "");
const previewD1 = steps.find(
  (s) => /d1 migrations apply/.test(runOf(s)) && /--env preview/.test(runOf(s)),
);
check(previewD1 != null, "no preview 'wrangler d1 migrations apply ... --env preview' step");
check(
  previewD1 == null || /0001/.test(runOf(previewD1)),
  "preview d1 step should reference migration 0001",
);
check(
  previewD1 == null || !/0002/.test(stripNo0002(runOf(previewD1))),
  "preview d1 step must NOT reference migration 0002",
);

// 3. PR path uses `wrangler deploy --env preview` (no cron).
const previewDeploy = steps.find((s) => /wrangler deploy --env preview/.test(runOf(s)));
check(previewDeploy != null, "no 'wrangler deploy --env preview' step");
check(
  previewDeploy == null || /--env preview/.test(runOf(previewDeploy)),
  "preview deploy must use --env preview",
);
check(
  previewDeploy == null || previewDeploy.if == null || !/refs\/heads\/main/.test(previewDeploy.if),
  "preview deploy must NOT be gated by push-to-main (no cron in preview)",
);

// 4. Production promotion uses `wrangler deploy --env production` (cron registered).
const prodDeploy = steps.find((s) => /wrangler deploy --env production/.test(runOf(s)));
check(prodDeploy != null, "no 'wrangler deploy --env production' step");
check(
  prodDeploy == null ||
    (prodDeploy.if &&
      /github\.event_name == 'push'/.test(prodDeploy.if) &&
      /refs\/heads\/main/.test(prodDeploy.if)),
  "production deploy must be gated to `push` on `refs/heads/main` (cron registration)",
);

// 5. WEATHER_PRIMARY_PROVIDER=open-meteo injected.
check(
  /WEATHER_PRIMARY_PROVIDER[:=][\s"']*open-meteo/i.test(text),
  "WEATHER_PRIMARY_PROVIDER=open-meteo not injected into the worker deploy",
);

// 6. Analytics variables are wired into the web build step.
check(
  /NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED/.test(text),
  "analytics ENABLED variable not wired into the web build",
);
check(
  /NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN/.test(text),
  "analytics TOKEN variable not wired into the web build",
);

// 7. The file documents the "only 0001, no 0002" migration contract.
check(
  /only 0001|no 0002|0001 ONLY/i.test(text),
  "deploy.yml should document the 'only 0001, no 0002' migration contract",
);

if (failures.length) {
  console.error("QA-DEPLOY-CHECK: FAILED");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("QA-DEPLOY-CHECK: OK — deploy.yml structure matches the increment contract");
process.exit(0);
