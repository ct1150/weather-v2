// Boundary regression test (Task 1).
//
// Enforces the acyclic package boundaries from design.md / ARCH-LAYERS-001 and the
// "browser/read code must not import provider adapters" rule. The eslint-config/index.js
// layers eslint-plugin-boundaries with element types:
//   - provider-adapter : packages/weather/src/provider.ts   (sync worker import only)
//   - app              : apps/**/src/**
//   - worker           : workers/**/src/**
//   - package          : packages/**/src/**
// and `default: "disallow"` with allow lists.
//
// This test exercises the REAL flat config (tooling/eslint-config/index.js) end-to-end via
// the ESLint engine, linting on-disk fixtures whose relative imports resolve exactly as they
// would in the repository. It asserts both the configuration shape (policy) and the actual
// import-resolution behavior on real files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";
import eslintConfig from "./index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();

// --- Extract the boundaries/element-types policy from the real config -------------------
const boundaryConfig = eslintConfig.find(
  (c) => c.rules && c.rules["boundaries/element-types"]
);
const elementTypesRule = boundaryConfig.rules["boundaries/element-types"];
const policy = elementTypesRule[1];
const allowFor = (t) => policy.rules.find((r) => r.from === t)?.allow ?? [];
const elements = boundaryConfig.settings["boundaries/elements"];

test("boundary policy matches the documented element types and allow lists", () => {
  assert.equal(policy.default, "disallow");
  assert.deepEqual(allowFor("app").sort(), ["app", "package"]);
  assert.ok(allowFor("app").includes("package"));
  assert.ok(!allowFor("app").includes("provider-adapter"), "app must NOT import provider-adapter");
  assert.ok(allowFor("worker").includes("provider-adapter"), "worker MAY import provider-adapter");
  assert.ok(allowFor("package").includes("package"));
  assert.ok(elements.some((e) => e.type === "provider-adapter"));
});

test("provider adapter is isolated to a single file and is classified first", () => {
  const pa = elements.find((e) => e.type === "provider-adapter");
  assert.equal(pa.mode, "file", "provider-adapter must use mode:file to match a single file");
  assert.equal(pa.pattern, "**/packages/weather/src/provider.ts");
  // It must appear before "package" so the first-match-wins classification gives provider.ts
  // the provider-adapter type instead of package.
  assert.ok(
    elements.indexOf(pa) < elements.findIndex((e) => e.type === "package"),
    "provider-adapter must precede package in the elements array"
  );
});

// --- Real import-resolution enforcement on disk fixtures --------------------------------
test("import resolution enforces boundaries on real fixtures", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wnr-boundaries-"));
  const write = (rel, content) => {
    const fp = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, content);
    return fp;
  };
  // provider.ts imports domain (a package) — allowed.
  write("packages/weather/src/provider.ts", 'import x from "../../db/src/index.ts";\n');
  write("packages/db/src/index.ts", "export {};\n");
  // app importing provider-adapter — FORBIDDEN.
  const badFile = write("apps/web/src/bad.ts", 'import x from "../../../packages/weather/src/provider.ts";\n');
  // app importing a normal package (db) — allowed.
  const goodFile = write("apps/web/src/good.ts", 'import x from "../../../packages/db/src/index.ts";\n');
  // worker importing provider-adapter — allowed (the ONLY permitted path).
  const syncFile = write("workers/weather-sync/src/sync.ts", 'import x from "../../../packages/weather/src/provider.ts";\n');

  const eslint = new ESLint({
    overrideConfigFile: path.join(ROOT, "tooling/eslint-config/index.js"),
    cwd: tmp,
  });
  const lint = async (fp) => {
    const rel = path.relative(tmp, fp);
    const results = await eslint.lintFiles([rel]);
    return results[0].messages
      .filter((m) => m.ruleId === "boundaries/element-types")
      .map((m) => m.message);
  };

  const bad = await lint(badFile);
  const good = await lint(goodFile);
  const sync = await lint(syncFile);

  assert.ok(
    bad.some((m) => /provider-adapter/.test(m)),
    `app importing provider-adapter must be rejected, got: ${JSON.stringify(bad)}`
  );
  assert.equal(good.length, 0, `app importing db must be allowed, got: ${JSON.stringify(good)}`);
  assert.equal(sync.length, 0, `worker importing provider must be allowed, got: ${JSON.stringify(sync)}`);

  fs.rmSync(tmp, { recursive: true, force: true });
});
