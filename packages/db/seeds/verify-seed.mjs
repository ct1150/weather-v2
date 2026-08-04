// verify-seed.mjs — QA gate for the tourist-cities seed (DATA-GEOGRAPHY-001).
//
// Purpose
//   Prove that packages/db/seeds/0001_cities_jp_kr_sea.sql is correct against the
//   authoritative DDL (packages/db/migrations/0001_weather.sql). It is a reusable,
//   committable guard: any future edit to the seed that breaks an invariant will fail
//   this test. It does NOT modify the seed file.
//
// How it works
//   - Resets the LOCAL D1 instance (--local only; production is out of scope) so the
//     baseline is deterministic, then applies the migration, then the seed.
//   - Runs aggregate SQL through `wrangler d1 execute ... --json` (wrangler parses the
//     full SQL natively, including triggers/comments — we never hand-parse the files).
//   - Asserts every expected invariant, then re-runs the seed to prove INSERT OR IGNORE
//     idempotency (counts must be unchanged).
//
// Run it
//   node --test packages/db/seeds/verify-seed.mjs
//   (Node 22; wrangler resolved via `pnpm exec` from workers/weather-sync.)
//
// Notes
//   - The local D1 state under workers/weather-sync/.wrangler/state/v3/d1 is wiped on
//     each run to guarantee a clean baseline. Set WNR_SEED_TEST_NO_RESET=1 to keep any
//     existing local D1 state (only useful if you have already seeded a known-good DB).
//   - D1's local SQLite rejects compound SELECTs with more than a handful of UNION ALL
//     terms ("too many terms in compound SELECT"), so queries are split into <=5 terms.

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve repo root from this file: packages/db/seeds -> up 3 levels.
const ROOT = path.resolve(__dirname, "..", "..", "..");
const MIGRATION_FILE = path.join(ROOT, "packages/db/migrations/0001_weather.sql");
const SEED_FILE = path.join(__dirname, "0001_cities_jp_kr_sea.sql");
const WORKER_DIR = path.join(ROOT, "workers/weather-sync");
const D1_LOCAL_DIR = path.join(WORKER_DIR, ".wrangler", "state", "v3", "d1");

// --- Expected invariants (the source of truth for this QA gate) ---
const EXPECTED = {
  countries: 9, // JP, KR, TH, VN, SG, MY, ID, PH, KH
  country_translations: 18, // 9 countries x (en, zh)
  cities: 44, // 36 active phase-one cities + 8 soft-disabled phase-two identities
  city_translations: 88, // 44 cities x (en, zh)
  featured: 13, // curated cross-region homepage set
  active_cities: 36, // bounded phase-one sync scope
  featured_not_active: 0, // every featured city must be active
  orphan_cities: 0, // cities with a missing country_id
  orphan_city_tr: 0, // city_translations with a missing city_id
  orphan_country_tr: 0, // country_translations with a missing country_id
};

// Split into two <=5-term compound SELECTs (D1 local SQLite limit).
// NOTE: must be single-line — newlines break shell quoting of --command.
const Q_COUNTS =
  "SELECT 'countries' t, COUNT(*) c FROM countries " +
  "UNION ALL SELECT 'country_translations', COUNT(*) FROM country_translations " +
  "UNION ALL SELECT 'cities', COUNT(*) FROM cities " +
  "UNION ALL SELECT 'city_translations', COUNT(*) FROM city_translations " +
  "UNION ALL SELECT 'featured', COUNT(*) FROM cities WHERE is_featured = 1";
const Q_INTEGRITY =
  "SELECT 'active_cities' t, COUNT(*) c FROM cities WHERE status = 'active' " +
  "UNION ALL SELECT 'featured_not_active', COUNT(*) FROM cities WHERE is_featured = 1 AND status <> 'active' " +
  "UNION ALL SELECT 'orphan_cities', COUNT(*) FROM cities c LEFT JOIN countries co ON co.id = c.country_id WHERE co.id IS NULL " +
  "UNION ALL SELECT 'orphan_city_tr', COUNT(*) FROM city_translations ct LEFT JOIN cities c ON c.id = ct.city_id WHERE c.id IS NULL " +
  "UNION ALL SELECT 'orphan_country_tr', COUNT(*) FROM country_translations t LEFT JOIN countries co ON co.id = t.country_id WHERE co.id IS NULL";

function runWrangler(args) {
  // `pnpm exec wrangler` is resolved from WORKER_DIR where the `wnr-weather` binding lives.
  return execSync(`pnpm exec wrangler ${args}`, { cwd: WORKER_DIR, encoding: "utf8" });
}

function applyFile(file) {
  runWrangler(`d1 execute wnr-weather --local --file ${JSON.stringify(file)}`);
}

function queryCounts(sql) {
  const out = runWrangler(`d1 execute wnr-weather --local --json --command ${JSON.stringify(sql)}`);
  const match = out.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`Could not parse wrangler JSON output:\n${out}`);
  }
  const payload = JSON.parse(match[0]);
  const map = {};
  for (const row of payload[0].results) {
    map[row.t] = Number(row.c);
  }
  return map;
}

let countsAfterFirstSeed = null;

before(() => {
  if (!process.env.WNR_SEED_TEST_NO_RESET) {
    console.log(`[setup] Resetting local D1 state: ${D1_LOCAL_DIR}`);
    fs.rmSync(D1_LOCAL_DIR, { recursive: true, force: true });
  } else {
    console.log("[setup] WNR_SEED_TEST_NO_RESET=1 — keeping existing local D1 state");
  }

  console.log(`[setup] Applying migration: ${MIGRATION_FILE}`);
  applyFile(MIGRATION_FILE);

  console.log(`[setup] Applying seed (1st pass): ${SEED_FILE}`);
  applyFile(SEED_FILE);

  countsAfterFirstSeed = { ...queryCounts(Q_COUNTS), ...queryCounts(Q_INTEGRITY) };
  console.log("[setup] Counts after 1st seed:", JSON.stringify(countsAfterFirstSeed));
});

describe("seed integrity: 0001_cities_jp_kr_sea.sql", () => {
  it("row counts match expected invariants (countries/cities/translations/featured)", () => {
    assert.equal(countsAfterFirstSeed.countries, EXPECTED.countries, "countries");
    assert.equal(
      countsAfterFirstSeed.country_translations,
      EXPECTED.country_translations,
      "country_translations",
    );
    assert.equal(countsAfterFirstSeed.cities, EXPECTED.cities, "cities");
    assert.equal(
      countsAfterFirstSeed.city_translations,
      EXPECTED.city_translations,
      "city_translations",
    );
    assert.equal(countsAfterFirstSeed.featured, EXPECTED.featured, "featured");
  });

  it("keeps exactly 36 phase-one cities active for the sync gate", () => {
    assert.equal(countsAfterFirstSeed.active_cities, EXPECTED.active_cities);
  });

  it("every featured city is active (hard activation gate)", () => {
    assert.equal(countsAfterFirstSeed.featured_not_active, EXPECTED.featured_not_active);
  });

  it("zero foreign-key orphans", () => {
    assert.equal(countsAfterFirstSeed.orphan_cities, EXPECTED.orphan_cities);
    assert.equal(countsAfterFirstSeed.orphan_city_tr, EXPECTED.orphan_city_tr);
    assert.equal(countsAfterFirstSeed.orphan_country_tr, EXPECTED.orphan_country_tr);
  });

  it("idempotency: re-running the seed leaves every count unchanged", () => {
    console.log("[idempotency] Applying seed (2nd pass)");
    applyFile(SEED_FILE);
    const after = { ...queryCounts(Q_COUNTS), ...queryCounts(Q_INTEGRITY) };
    console.log("[idempotency] Counts after 2nd seed:", JSON.stringify(after));

    for (const key of Object.keys(EXPECTED)) {
      assert.equal(
        after[key],
        countsAfterFirstSeed[key],
        `idempotency mismatch for ${key} (expected ${countsAfterFirstSeed[key]}, got ${after[key]})`,
      );
    }
  });
});
