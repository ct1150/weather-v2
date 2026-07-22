// tooling/performance/performance-gates.test.mjs
//
// Dual-layer performance release gate (ENG-PERF-001, DEP-CICD-001).
//
//  Layer 1 — Lighthouse CI against a production build. Every representative
//  page runs exactly 3 times; the gate uses each page's MEDIAN. Every page
//  must independently meet Performance >= 95, SEO = 100, Accessibility = 100,
//  Best Practices = 100; one page below one threshold blocks release.
//
//  Layer 2 — production RUM 28-day p75 per route class (LCP < 2.0s,
//  CLS < 0.05, INP < 200ms). Hard at >= 100 samples; fewer are
//  reported but do NOT block. Two consecutive failing daily windows -> incident.
//
// The RUM functions are imported from the shared evaluator so the test and the
// production `evaluate-rum-gate.mjs` CLI exercise identical gate logic.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeP75,
  evaluateRouteClass,
  evaluateDailyWindows,
  RUM_THRESHOLDS,
} from "./evaluate-rum-gate.mjs";

// ---------------------------------------------------------------------------
// Layer 1 — Lighthouse median gate
// ---------------------------------------------------------------------------

/** Median of the 3 Lighthouse runs for a metric. */
function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return (s[mid - 1] + s[mid]) / 2;
}

/**
 * Evaluate the Lighthouse layer. `pages` is an array of
 * { url, runs: [{ performance, seo, accessibility, bestPractices } x3] }.
 * Returns { passed, failures }.
 */
function lighthouseGate(pages) {
  const failures = [];
  for (const page of pages) {
    const perf = median(page.runs.map((r) => r.performance));
    const seo = median(page.runs.map((r) => r.seo));
    const ax = median(page.runs.map((r) => r.accessibility));
    const bp = median(page.runs.map((r) => r.bestPractices));
    if (perf < 95) failures.push(`${page.url}:performance:${perf}`);
    if (seo !== 100) failures.push(`${page.url}:seo:${seo}`);
    if (ax !== 100) failures.push(`${page.url}:accessibility:${ax}`);
    if (bp !== 100) failures.push(`${page.url}:bestPractices:${bp}`);
  }
  return { passed: failures.length === 0, failures };
}

const ALL_HUNDRED = { seo: 100, accessibility: 100, bestPractices: 100 };
function page(url, runValues) {
  return {
    url,
    runs: runValues.map((p) => ({ performance: p, ...ALL_HUNDRED })),
  };
}

test("Lighthouse gate passes when every representative page meets 95/100/100/100 median", () => {
  const pages = [
    page("home", [96, 97, 100]),
    page("country", [98, 99, 100]),
    page("city", [95, 100, 100]),
    page("ranking", [97, 100, 100]),
    page("search", [96, 100, 100]),
  ];
  const r = lighthouseGate(pages);
  assert.equal(r.passed, true, `expected pass, got failures: ${r.failures.join(", ")}`);
});

test("Lighthouse gate blocks a page below performance 95", () => {
  const pages = [page("home", [90, 91, 92]), page("city", [100, 100, 100])];
  const r = lighthouseGate(pages);
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.startsWith("home:performance")));
});

test("Lighthouse gate blocks any SEO/AX/BP below 100", () => {
  const okPerf = page("home", [100, 100, 100]);
  const badSeo = {
    url: "country",
    runs: [{ performance: 100, seo: 99, accessibility: 100, bestPractices: 100 }],
  };
  const r = lighthouseGate([okPerf, badSeo]);
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.startsWith("country:seo")));
});

test("Lighthouse performance boundary: 95.0 passes, 94.99 blocks", () => {
  const ok = page("ok", [95, 95, 96]);
  const bad = page("bad", [94.99, 94.99, 95]);
  const r = lighthouseGate([ok, bad]);
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.startsWith("bad:performance")));
  assert.ok(!r.failures.some((f) => f.startsWith("ok:performance")));
});

// ---------------------------------------------------------------------------
// Layer 2 — production RUM p75 gate
// ---------------------------------------------------------------------------

test("computeP75 is deterministic and correct for known inputs", () => {
  // Linear-interpolation (R7) p75.
  assert.equal(computeP75([1, 2, 3, 4, 5]), 4); // rank 3 -> index 3
  assert.equal(computeP75([10, 20, 30]), 25); // rank 1.5 -> 20 + 0.5*10
  assert.ok(Math.abs(computeP75([1, 2, 3, 4]) - 3.25) < 1e-9); // rank 2.25 -> 3 + 0.25*1
  assert.equal(computeP75([42]), 42);
});

test("RUM route class passes within limits with >= 100 samples", () => {
  const samples = [];
  for (let i = 0; i < 140; i++) {
    samples.push({ lcpMs: 1100 + (i % 300), cls: 0.01 + (i % 20) / 1000, inpMs: 100 + (i % 50) });
  }
  const r = evaluateRouteClass(samples);
  assert.equal(r.count, 140);
  assert.equal(r.reportOnly, false);
  assert.equal(r.blocked, false, `expected pass, failures=${r.failures.join(",")}`);
  assert.ok(r.lcpP75 < RUM_THRESHOLDS.lcpMs);
  assert.ok(r.clsP75 < RUM_THRESHOLDS.cls);
  assert.ok(r.inpP75 < RUM_THRESHOLDS.inpMs);
});

test("RUM route class blocks when LCP p75 >= 2.0s", () => {
  const samples = [];
  for (let i = 0; i < 140; i++) {
    samples.push({ lcpMs: 2100 + i, cls: 0.01, inpMs: 100 });
  }
  const r = evaluateRouteClass(samples);
  assert.equal(r.blocked, true);
  assert.ok(r.failures.includes("lcp"));
});

test("RUM boundary: LCP=2.0s, CLS=0.05, INP=200ms all block (strict <)", () => {
  const samples = [];
  for (let i = 0; i < 140; i++) {
    samples.push({ lcpMs: 2000, cls: 0.05, inpMs: 200 });
  }
  const r = evaluateRouteClass(samples);
  assert.equal(r.blocked, true);
  assert.deepEqual(r.failures.sort(), ["cls", "inp", "lcp"]);
});

test("RUM < 100 samples is reportOnly and NOT blocking even if high", () => {
  const samples = [];
  for (let i = 0; i < 40; i++) {
    samples.push({ lcpMs: 5000, cls: 0.9, inpMs: 999 });
  }
  const r = evaluateRouteClass(samples);
  assert.equal(r.reportOnly, true);
  assert.equal(r.blocked, false, "insufficient samples must not block");
});

test("RUM two consecutive failing daily windows raise an incident", () => {
  const windows = [
    { date: "2026-07-01", blocked: false },
    { date: "2026-07-02", blocked: true },
    { date: "2026-07-03", blocked: true },
    { date: "2026-07-04", blocked: false },
  ];
  const r = evaluateDailyWindows(windows);
  assert.equal(r.incident, true);
});

test("RUM no incident when failing windows are not consecutive", () => {
  const windows = [
    { date: "2026-07-01", blocked: true },
    { date: "2026-07-02", blocked: false },
    { date: "2026-07-03", blocked: true },
  ];
  const r = evaluateDailyWindows(windows);
  assert.equal(r.incident, false);
  assert.equal(r.consecutive, 1);
});
