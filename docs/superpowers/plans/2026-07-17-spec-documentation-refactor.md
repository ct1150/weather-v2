# SPEC Documentation Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `SPEC.md` with an authoritative indexed documentation system, close all audited requirement gaps, synchronize Kiro-derived specifications, and enforce the contracts with a deterministic dependency-free validator.

**Architecture:** Domain Markdown files own non-overlapping contracts; `SPEC.md` becomes the governance/index entry point and `docs/11-Roadmap.md` exclusively owns release assignment. Machine-readable requirement, release, trace, and derived-manifest comments let a Node.js validator prove uniqueness, coverage, link integrity, release consistency, source traceability, and Kiro freshness before the logical cutover.

**Tech Stack:** Markdown, Node.js >=22 built-ins (`node:fs`, `node:path`, `node:crypto`, `node:test`), pnpm >=10, existing Prettier; no new dependency.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-17-spec-optimization-design.md` exactly.
- Do not modify product code under `apps/`, `workers/`, or `packages/`.
- Keep `weather.txt` unchanged; its locked baseline is 1,476 lines with SHA-256 `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`.
- New domain documents remain `Draft / Non-authoritative` until the cutover task.
- During migration, the existing `SPEC.md` remains authoritative and the worktree must not be used to start product implementation.
- `docs/11-Roadmap.md` is the only file that stores `first_release` and `lifecycle`; domain requirements store only `roadmap_ref`.
- Every Active Hard Requirement has acceptance criteria and exactly one release record.
- MVP provides typed static config/kill switches; dynamic segmentation and experimentation Feature Flags begin in V1.
- Lighthouse 100 remains the product target; CI and production thresholds use the approved dual gate.
- No actual affiliate, advertising, analytics, Cloudflare, database, or deployment integration occurs in this documentation change.
- Do not mark existing Kiro implementation tasks complete unless their exact `Verify:` command passes and evidence is recorded.
- The directory is not a Git repository. Do not add commit steps or claim commits; end each task with a validation checkpoint.

## File Map

**Create**

- `docs/README.md` — reading order, authority map, metadata syntax, change protocol.
- `docs/00-Founder-Vision.md` — vision, markets, success metrics, commercial evolution.
- `docs/01-Product-PRD.md` — feature requirements and acceptance criteria.
- `docs/02-UX-Bible.md` — information architecture, flows, design system, states, accessibility, locale UX.
- `docs/03-SEO-Bible.md` — indexability, structured data, content strategy, quality gates.
- `docs/04-AI-Coding-Bible.md` — Agent protocol, boundaries, DoD, decision logs.
- `docs/05-System-Architecture.md` — layers, provider-only ingestion, cache/recovery, rendering matrix, static flags.
- `docs/06-Database.md` — D1 schema, score contracts, mixed activity score, migration rules.
- `docs/07-API-Spec.md` — `/api/v1` contracts, envelopes, validation, caching, internal authentication.
- `docs/08-Cloudflare-Deployment.md` — free-plan boundary, Pages-first decision, config, CI/CD, rollback.
- `docs/09-Engineering-Handbook.md` — TypeScript, tests, performance, security/Bot, observability, privacy.
- `docs/10-Growth-Bible.md` — event/report contracts, affiliates, ads, experiments, provider registry.
- `docs/11-Roadmap.md` — sole release/lifecycle records and phase gates.
- `docs/13-Requirements-Traceability.md` — immutable-source trace records and rendered matrix.
- `tooling/docs/requirement-format.mjs` — requirement/release/trace/derived parsers and digest functions.
- `tooling/docs/requirement-format.test.mjs` — parser and canonicalization tests.
- `tooling/docs/validate-docs.mjs` — repository validator and CLI.
- `tooling/docs/validate-docs.test.mjs` — fixture-based repository validation tests.

**Modify**

- `SPEC.md` — replace body with active governance summary and domain index at cutover.
- `README.md` — point contributors and Agents to `SPEC.md` and `docs/README.md`; remove stale section-number references.
- `package.json` — add standalone `docs:test` and `docs:check` scripts without adding dependencies or changing the existing `test` script.
- `prettier.config.js` — import the existing local shared preset by relative path so root format commands resolve without a new dependency.
- `docs/12-ADR/README.md` — active ADR policy and phase decision-log rule.
- `.kiro/specs/where-not-rain/requirements.md` — MVP-only derived EARS requirements.
- `.kiro/specs/where-not-rain/design.md` — MVP implementation design linked to authoritative IDs.
- `.kiro/specs/where-not-rain/tasks.md` — MVP-only tasks with requirement and verification evidence fields.

---

### Task 1: Implement deterministic requirement and manifest parsing

**Files:**

- Create: `tooling/docs/requirement-format.mjs`
- Create: `tooling/docs/requirement-format.test.mjs`

**Interfaces:**

- Produces: `normalizeBlock(text): string`
- Produces: `sha256(text): string`
- Produces: `parseRequirementBlocks(markdown, filePath): RequirementBlock[]`
- Produces: `parseReleaseRecords(markdown, filePath): ReleaseRecord[]`
- Produces: `parseTraceRecords(markdown, filePath): TraceRecord[]`
- Produces: `parseDerivedManifest(markdown, filePath): DerivedManifest | null`
- Produces: `digestRequirementSelection(blocks, ids): string`

- [ ] **Step 1: Write parser tests**

Create tests with Node's built-in runner covering line-ending normalization, trailing-space removal, metadata extraction, duplicate keys, canonical ID ordering, stable SHA-256, malformed JSON, release records, trace records, and derived manifests:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  digestRequirementSelection,
  normalizeBlock,
  parseDerivedManifest,
  parseReleaseRecords,
  parseRequirementBlocks,
  parseTraceRecords,
} from "./requirement-format.mjs";

const requirement = `<!-- requirement\nid: ENG-PERF-001\nstatus: Active\nkind: Hard\nroadmap_ref: REL-MVP-ENG_PERF_001\nowner: Engineering\nverification: pnpm docs:check\n-->\n### ENG-PERF-001 — Performance gate\nText.  \n#### Acceptance Criteria\n- Gate passes.\n`;

test("normalizes blocks deterministically", () => {
  assert.equal(normalizeBlock("\r\nA  \r\n\r\n"), "A\n");
});

test("parses requirement metadata and acceptance criteria", () => {
  const [block] = parseRequirementBlocks(requirement, "docs/09-Engineering-Handbook.md");
  assert.equal(block.id, "ENG-PERF-001");
  assert.equal(block.roadmapRef, "REL-MVP-ENG_PERF_001");
  assert.equal(block.hasAcceptanceCriteria, true);
});

test("digests selected blocks in sorted ID order", () => {
  const blocks = parseRequirementBlocks(requirement, "x.md");
  assert.match(digestRequirementSelection(blocks, ["ENG-PERF-001"]), /^sha256:[a-f0-9]{64}$/);
});

test("parses release, trace, and derived JSON comments", () => {
  const release =
    '<!-- release: {"first_release":"MVP","id":"REL-MVP-ENG_PERF_001","lifecycle":"Continuous","requirement_id":"ENG-PERF-001"} -->';
  const trace =
    '<!-- trace: {"classification":"Hard","coverage":"Covered","line_end":691,"line_start":675,"rationale":"Direct","requirement_id":"ENG-PERF-001","source_excerpt":"# PERFORMANCE","source_sha256":"70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d"} -->';
  const derived =
    '<!-- derived: {"generated_at":"2026-07-17","schema":1,"sources":[{"digest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","ids":["ENG-PERF-001"],"path":"docs/09-Engineering-Handbook.md"}]} -->';
  assert.equal(parseReleaseRecords(release, "r.md")[0].requirementId, "ENG-PERF-001");
  assert.equal(parseTraceRecords(trace, "t.md")[0].classification, "Hard");
  assert.equal(parseDerivedManifest(derived, "d.md").schema, 1);
});
```

- [ ] **Step 2: Run the tests and confirm the intended red state**

Run: `node --test tooling/docs/requirement-format.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `requirement-format.mjs`.

- [ ] **Step 3: Implement the parser module**

Implement strict metadata parsing and canonicalization. Use these exact allowed values:

```js
export const ALLOWED_STATUS = new Set(["Active", "Deprecated", "Superseded"]);
export const ALLOWED_KIND = new Set(["Hard", "Guidance"]);
export const ALLOWED_RELEASE = new Set(["MVP", "Beta", "V1", "V2"]);
export const ALLOWED_LIFECYCLE = new Set(["Launch", "Continuous"]);
export const ALLOWED_TRACE_CLASS = new Set(["Hard", "Suggestion", "Example"]);
export const ALLOWED_COVERAGE = new Set(["Covered", "Changed", "Rejected", "Needs Decision"]);

export function normalizeBlock(text) {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines.at(-1).trim() === "") lines.pop();
  return `${lines.map((line) => line.replace(/[ \t]+$/u, "")).join("\n")}\n`;
}
```

`parseRequirementBlocks` must reject duplicate metadata keys, missing `id/status/kind/roadmap_ref/owner/verification`, ID/heading mismatch, and a Hard block without `#### Acceptance Criteria`. `digestRequirementSelection` must sort/deduplicate IDs, join normalized blocks with `\n---\n`, and return `sha256:` followed by exactly 64 lowercase hexadecimal characters. JSON comment parsers must reject comments that are not single-line valid JSON or whose arrays are not canonically sorted.

- [ ] **Step 4: Run focused tests**

Run: `node --test tooling/docs/requirement-format.test.mjs`

Expected: all parser tests PASS, exit code 0.

- [ ] **Step 5: Run formatting**

Run: `pnpm exec prettier --write tooling/docs/requirement-format.mjs tooling/docs/requirement-format.test.mjs`

Expected: exit code 0 and no syntax changes on a second `--check` run.

### Task 2: Implement repository-level documentation validation

**Files:**

- Create: `tooling/docs/validate-docs.mjs`
- Create: `tooling/docs/validate-docs.test.mjs`
- Modify: `package.json`
- Modify: `prettier.config.js`

**Interfaces:**

- Consumes: Task 1 parser/digest exports.
- Produces: `validateRepository(root, { mode }): Promise<ValidationResult>` where mode is `staging|active`.
- Produces CLI: `node tooling/docs/validate-docs.mjs --mode staging|active`
- Produces scripts: `pnpm docs:test`, `pnpm docs:check`.

- [ ] **Step 1: Write fixture-based failing tests**

Use `mkdtemp`, write minimal documents under the temporary root, and assert error codes for duplicate IDs, missing release records, stale digest, invalid links, `Needs Decision`, Kiro omissions, and Active/Draft mode mismatch. Include one fully valid fixture whose requirement links to one release and appears in all three Kiro derived files.

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateRepository } from "./validate-docs.mjs";

test("rejects an Active hard requirement without exactly one release", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "wnr-docs-"));
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(
    path.join(root, "docs", "09-Engineering-Handbook.md"),
    "---\nstatus: Active\n---\n<!-- requirement\nid: ENG-PERF-001\nstatus: Active\nkind: Hard\nroadmap_ref: REL-MVP-ENG_PERF_001\nowner: Engineering\nverification: pnpm docs:check\n-->\n### ENG-PERF-001 — Gate\n#### Acceptance Criteria\n- Pass.\n",
  );
  const result = await validateRepository(root, { mode: "active" });
  assert(result.errors.some((error) => error.code === "MISSING_RELEASE"));
});
```

- [ ] **Step 2: Verify the repository validator tests fail**

Run: `node --test tooling/docs/validate-docs.test.mjs`

Expected: FAIL with missing `validate-docs.mjs`.

- [ ] **Step 3: Implement `validateRepository` and the CLI**

The result shape is fixed:

```js
/** @typedef {{code:string,file:string,message:string}} ValidationIssue */
/** @typedef {{errors:ValidationIssue[],warnings:ValidationIssue[],stats:{requirements:number,releases:number,traces:number}}} ValidationResult */
```

Implement these checks as named functions called by `validateRepository`: `checkDocumentSet`, `checkRequirementSchema`, `checkReleaseUniqueness`, `checkMarkdownLinks`, `checkTraceCoverage`, `checkDerivedFreshness`, `checkKiroBidirectionalCoverage`, `checkTaskEvidence`, `checkCriticalClauses`, and `checkCutoverState`. Sort issues by `file`, then `code`, then `message` before output. CLI exit codes are 0 for no errors, 1 for contract errors, and 2 for parser/config/internal failures. `--mode active` must reject Draft authority documents and any `Needs Decision`; `--mode staging` permits Draft authority documents but still runs all structural checks.

Critical-clause checks must identify requirement IDs, not merely search prose:

```js
export const REQUIRED_CONTRACT_IDS = [
  "ARCH-RENDER-001",
  "ARCH-FLAG-001",
  "DATA-ACTIVITY-001",
  "ENG-PERF-001",
  "ENG-BOT-001",
  "GROW-AFF-001",
  "GROW-ADS-001",
  "GROW-ANALYTICS-001",
  "GROW-REPORT-001",
];
```

- [ ] **Step 4: Add root commands and repair root Prettier resolution**

Replace `prettier.config.js` with the exact local import:

```js
export { default } from "./tooling/prettier-config/index.js";
```

Add these scripts without changing dependency versions:

```json
"docs:test": "node --test tooling/docs/*.test.mjs",
"docs:check": "node tooling/docs/validate-docs.mjs --mode active"
```

Keep the existing `test` script unchanged; the final validation runs both `pnpm docs:test` and `pnpm test` separately.

- [ ] **Step 5: Run validator tests and formatting**

Run: `pnpm docs:test && pnpm exec prettier --check tooling/docs package.json`

Expected: all docs tests PASS and Prettier exits 0.

### Task 3: Create governance, authority, and release documents in Draft state

**Files:**

- Create: `docs/README.md`
- Create: `docs/00-Founder-Vision.md`
- Create: `docs/11-Roadmap.md`
- Modify: `docs/12-ADR/README.md`

**Interfaces:**

- Produces the authority map used by every later document.
- Produces one `REL-*` record for every requirement ID listed in Tasks 3–6.

- [ ] **Step 1: Write Draft front matter and governance rules**

Every new authority document uses `status: Draft` and `last_updated: 2026-07-17`. Use these exact title/authority pairs in front matter:

| File                                   | title                     | authority      |
| -------------------------------------- | ------------------------- | -------------- |
| `docs/README.md`                       | Documentation Governance  | Governance     |
| `docs/00-Founder-Vision.md`            | Founder Vision            | Vision         |
| `docs/01-Product-PRD.md`               | Product PRD               | Product        |
| `docs/02-UX-Bible.md`                  | UX Bible                  | UX             |
| `docs/03-SEO-Bible.md`                 | SEO Bible                 | SEO            |
| `docs/04-AI-Coding-Bible.md`           | AI Coding Bible           | Agent Delivery |
| `docs/05-System-Architecture.md`       | System Architecture       | Architecture   |
| `docs/06-Database.md`                  | Database and Scoring      | Data           |
| `docs/07-API-Spec.md`                  | API Specification         | API            |
| `docs/08-Cloudflare-Deployment.md`     | Cloudflare Deployment     | Deployment     |
| `docs/09-Engineering-Handbook.md`      | Engineering Handbook      | Engineering    |
| `docs/10-Growth-Bible.md`              | Growth Bible              | Growth         |
| `docs/11-Roadmap.md`                   | Roadmap                   | Release        |
| `docs/13-Requirements-Traceability.md` | Requirements Traceability | Traceability   |

`docs/README.md` must state the reading order, unique owner table, Requirement metadata format, release-record JSON format, trace JSON format, Draft/cutover protocol, conflict resolution, and the rule that `weather.txt` is historical input after cutover.

- [ ] **Step 2: Write Founder Vision without release assignments**

Create these IDs with Hard acceptance criteria where applicable: `VISION-POSITION-001`, `VISION-MARKET-001`, `VISION-VALUE-001`, `VISION-METRICS-001`, `VISION-BUSINESS-001`, `VISION-COST-001`. Preserve Where Not Rain, “Find Sunshine. Plan Better.”, the target countries, Travel Decision Engine positioning, SEO/conversion/retention/revenue/performance priorities, and commercial evolution. Define commercial phases as revenue-model narrative only; do not store MVP/Beta/V1/V2 values here.

- [ ] **Step 3: Write the sole Roadmap release table**

`docs/11-Roadmap.md` stores one single-line release JSON comment per Active Hard requirement and renders the same records in a human table. Use this mapping policy:

- MVP: all requirements except the explicit Beta/V1/V2 IDs below.
- Beta: `PRD-FR-007`, `PRD-FR-008`, `PRD-FR-010`, `PRD-FR-012`, `PRD-FR-013`, `UX-I18N-002`, `GROW-REPORT-001`.
- V1: `PRD-FR-009`, `PRD-FR-014`, `ARCH-FLAG-002`, `DATA-ACTIVITY-001`, `GROW-EXPERIMENT-001`, `GROW-PROVIDER-001`.
- V2: `PRD-FR-015`, `PRD-FR-016`.
- Lifecycle Continuous: all `ARCH-*`, `DEP-*`, `ENG-*`, `SEO-*`, `AGENT-*`, analytics/privacy requirements, and data migration requirements; other feature requirements use Launch unless their acceptance criteria explicitly describe ongoing operation.

Release IDs use `REL-${release}-${requirementId.replaceAll("-", "_")}`; for example `ENG-PERF-001` in MVP maps to `REL-MVP-ENG_PERF_001`. Domain metadata must reference that exact ID.

- [ ] **Step 4: Update ADR policy**

Require a phase decision log every phase. Require an ADR only for a new or changed architecture decision. The exact no-ADR output is `ADR: none — no new architectural decision`. State that Accepted ADRs may supersede a contract only when they name the superseded Requirement ID and the authority document is updated in the same cutover.

- [ ] **Step 5: Validate staging structure**

Run: `node tooling/docs/validate-docs.mjs --mode staging`

Expected: no parser errors; missing-document/coverage errors are expected until Tasks 4–7, but there must be no malformed requirement or release record.

### Task 4: Create Product, UX, and SEO authority documents

**Files:**

- Create: `docs/01-Product-PRD.md`
- Create: `docs/02-UX-Bible.md`
- Create: `docs/03-SEO-Bible.md`

**Interfaces:**

- Consumes Roadmap IDs from Task 3.
- Produces product and experience contracts consumed by Kiro requirements/design.

- [ ] **Step 1: Migrate product requirements with fixed IDs**

Create Hard requirement blocks for:

- `PRD-FR-001` Travel Radar
- `PRD-FR-002` Weather Explorer
- `PRD-FR-003` City Page
- `PRD-FR-004` Country Page
- `PRD-FR-005` Fuzzy Search
- `PRD-FR-006` Destination Rankings
- `PRD-FR-007` Compare Cities (Beta)
- `PRD-FR-008` Weekend Planner (Beta)
- `PRD-FR-009` Seasonal Travel (V1)
- `PRD-FR-010` Growth-loop recommendations (Beta)
- `PRD-FR-011` Commercial surfaces and disclosure
- `PRD-FR-012` Protected read-only Admin (Beta)
- `PRD-FR-013` Articles and RSS (Beta)
- `PRD-FR-014` Travel News editorial workflow (V1)
- `PRD-FR-015` AI Travel Match (V2)
- `PRD-FR-016` 30-Day Outlook (V2)

Copy the current valid acceptance criteria, remove Compare from MVP, rename 30-Day Forecast to Outlook, and make every delayed feature's roadmap reference resolve to its approved version.

- [ ] **Step 2: Create UX contracts**

Create `UX-IA-001`, `UX-HOME-001`, `UX-DESIGN-001`, `UX-STATE-001`, `UX-A11Y-001`, `UX-I18N-001` (five MVP locales), and `UX-I18N-002` (Thai/Vietnamese Beta). Preserve mobile-first order, progressive map loading, tokens, dark mode, 44×44 targets, WCAG 2.2 AA, keyboard access, reduced motion, and all async states.

- [ ] **Step 3: Create SEO contracts**

Create `SEO-PAGE-001`, `SEO-STRUCTURED-001`, `SEO-QUALITY-001`, `SEO-SITEMAP-001`, `SEO-CONTENT-001`, and `SEO-INDEXABILITY-001`. Put only indexability/quality columns in the SEO route table; link `ARCH-RENDER-001` for rendering mode and cache behavior. Preserve unique metadata, canonical, hreflang, visible-content JSON-LD, noindex rules, sitemap behavior, editorial review, and safety-source requirements.

- [ ] **Step 4: Format and run focused staging validation**

Run: `pnpm exec prettier --write docs/01-Product-PRD.md docs/02-UX-Bible.md docs/03-SEO-Bible.md && node tooling/docs/validate-docs.mjs --mode staging`

Expected: all three files parse with unique IDs and valid roadmap references; only not-yet-created document/trace/Kiro errors remain.

### Task 5: Create Architecture, Database, API, and Deployment authorities

**Files:**

- Create: `docs/05-System-Architecture.md`
- Create: `docs/06-Database.md`
- Create: `docs/07-API-Spec.md`
- Create: `docs/08-Cloudflare-Deployment.md`

**Interfaces:**

- Produces contracts used by Kiro design and tasks.
- Owns the only rendering matrix and the only data/API definitions.

- [ ] **Step 1: Write architecture requirements**

Create `ARCH-LAYERS-001`, `ARCH-DATAFLOW-001`, `ARCH-PROVIDER-001`, `ARCH-CACHE-001`, `ARCH-RECOVERY-001`, `ARCH-RENDER-001`, `ARCH-FLAG-001` (MVP static config/kill switch), and `ARCH-FLAG-002` (V1 dynamic flags). Include the approved route matrix verbatim, provider-only Cron flow, D1/KV fallback, snapshot activation, versioned cache keys, lock semantics, stale behavior, and R2 optionality.

- [ ] **Step 2: Write database and scoring requirements**

Create `DATA-GEOGRAPHY-001`, `DATA-WEATHER-001`, `DATA-SCORE-001`, `DATA-ACTIVITY-001`, `DATA-RELATIONSHIP-001`, `DATA-OPERATIONS-001`, and `DATA-MIGRATION-001`. Preserve all current tables and deterministic score formula. Add the approved Theme Park/Mountain formulas, exact factor weights, availability/season mappings, hazard maximum rule, two-hour/90-day/24-hour freshness limits, confidence 0.8 threshold, hidden-score behavior, and model-version/ADR rule.

- [ ] **Step 3: Write API requirements**

Create `API-READ-001`, `API-ENVELOPE-001`, `API-VALIDATION-001`, `API-INTERNAL-001`, and `API-CACHE-001`. Keep `/api/v1`, request IDs, ISO dates, stable errors, parameter validation, parameterized D1 queries, compact map payload, cache-cardinality controls, and strong internal authentication. Compare remains a Beta capability even if its endpoint shape is documented now.

- [ ] **Step 4: Write deployment requirements**

Create `DEP-FREE-001`, `DEP-PAGES-001`, `DEP-CONFIG-001`, `DEP-CICD-001`, and `DEP-ROLLBACK-001`. State that core infrastructure is Cloudflare-only and free-plan compatible; GA4/Plausible are removable disabled adapters. Pages is preferred; switching to official Workers deployment requires compatibility evidence, ADR, and product approval. Preserve exact config names, secret handling, preview/production smoke checks, migrations, Cron, rollback, and current-quota revalidation.

- [ ] **Step 5: Validate staging documents**

Run: `pnpm exec prettier --write docs/05-System-Architecture.md docs/06-Database.md docs/07-API-Spec.md docs/08-Cloudflare-Deployment.md && node tooling/docs/validate-docs.mjs --mode staging`

Expected: no duplicate owner for rendering, data, API, or release assignment; only remaining missing documents/trace/Kiro errors are allowed.

### Task 6: Create Engineering, Growth, and Agent authorities

**Files:**

- Create: `docs/04-AI-Coding-Bible.md`
- Create: `docs/09-Engineering-Handbook.md`
- Create: `docs/10-Growth-Bible.md`

**Interfaces:**

- Completes the authoritative requirement set.
- Supplies validator-critical IDs listed in Task 2.

- [ ] **Step 1: Write Agent and Definition-of-Done contracts**

Create `AGENT-PROTOCOL-001`, `AGENT-BOUNDARY-001`, `AGENT-DOD-001`, and `AGENT-DOCS-001`. Require authority-first reading, one release phase at a time, no pseudocode/unused dependencies/unverified completion, validation evidence, change summaries, known limitations, decision log, and conflict escalation. State that Kiro files are derived and cannot override authority documents.

- [ ] **Step 2: Write engineering quality contracts**

Create `ENG-TYPESCRIPT-001`, `ENG-TEST-001`, `ENG-PERF-001`, `ENG-SECURITY-001`, `ENG-BOT-001`, `ENG-PRIVACY-001`, `ENG-OBSERVABILITY-001`, and `ENG-RELIABILITY-001`. Include:

- CI Lighthouse device/network/sample settings and 95/100/100/100 blocking thresholds.
- Production 28-day p75, 100-sample minimum, LCP <2s, CLS <0.05, INP <200ms, two-window incident rule, optional-script shutdown, attributable rollback.
- L1/L2/L3/L4 Bot limits and actions exactly as approved.
- XSS, SQL injection, CSP, SSRF, open redirect, replay, poisoning, secrets, logging, privacy, and Admin controls.
- Unit/integration/E2E/non-functional suites and explicit required paths.
- Structured logs, sync/cache/error metrics, stale/KV/D1/deployment recovery.

- [ ] **Step 3: Write growth and commercial contracts**

Create:

- `GROW-ANALYTICS-001` — exact event names, common fields, field types, allowlists, version rejection, no raw search terms.
- `GROW-REPORT-001` — Beta `top_pages` and `acquisition_country`, UTC daily aggregation, 7/28/90 windows, metrics, ISO/ZZ handling, privacy threshold 10.
- `GROW-AFF-001` — adapter/disclosure/rel/nonblocking-click/whitelist behavior.
- `GROW-ADS-001` — Homepage, City Page, Article, Sidebar, Between Sections; no-fill/disabled zero CLS.
- `GROW-PROVIDER-001` — V1 candidate registry for Google AdSense, Booking, Agoda, Trip.com, Klook, KKday, Expedia, Rentalcars, Airalo, Travel Insurance; no launch promise.
- `GROW-EXPERIMENT-001` — V1 dynamic flags/A-B hypothesis, primary/guardrail metrics, dates, no indexable variants, no extra PII.

- [ ] **Step 4: Run complete authority-set staging validation**

Run: `pnpm exec prettier --write docs/04-AI-Coding-Bible.md docs/09-Engineering-Handbook.md docs/10-Growth-Bible.md && node tooling/docs/validate-docs.mjs --mode staging`

Expected: all required authority files and critical IDs exist; remaining failures are limited to traceability, Kiro derivation, Draft status, and pre-cutover indexes.

### Task 7: Build complete source traceability

**Files:**

- Create: `docs/13-Requirements-Traceability.md`

**Interfaces:**

- Consumes every authority Requirement ID and locked `weather.txt` hash.
- Produces machine-readable `trace` comments and a generated human matrix.

- [ ] **Step 1: Add immutable source metadata**

Record the locked file path, 1,476 line count, SHA-256, audit date, classification rules, and the rule that every Hard source range maps to an Active Requirement while Suggestion/Example may map to Guidance or a rationale-only decision.

- [ ] **Step 2: Trace all original headed sections**

Create at least one trace record for each exact section range: `1–22`, `23–44`, `45–78`, `79–136`, `137–150`, `151–196`, `197–256`, `257–272`, `273–318`, `319–338`, `339–374`, `375–408`, `409–478`, `479–526`, `527–540`, `541–564`, `565–590`, `591–610`, `611–630`, `631–648`, `649–674`, `675–694`, `695–722`, `723–738`, `739–770`, `771–802`, `803–880`, and `881–898`.

Split a range into multiple records whenever different sentences map to different Requirement IDs; do not use one broad record to hide partial coverage.

- [ ] **Step 3: Trace appended recommendation clusters**

Add records for Radar/Explorer enhancements (`899–1011`), Weekend Planner (`1012–1034`), Rankings (`1035–1060`), AI Match (`1061–1103`), Seasonal Travel (`1104–1125`), Compare (`1126–1161`), nearby recommendations (`1162–1179`), timeline (`1180–1196`), Travel News (`1197–1214`), ingestion architecture (`1215–1244`), SEO routes (`1245–1286`), growth loop (`1287–1312`), analytics (`1313–1331`), UI/design/ADR (`1332–1373`), document-system proposal (`1374–1452`), and delivery-form example (`1453–1476`).

Classify “Top 100,” “150–250 pages,” sample prices, example city outputs, and automatic future AI writing as Suggestion/Example rather than Hard. Record Changed rationales for 30-Day Outlook, conditional Pages fallback, authorized price data, and reviewed AI content.

- [ ] **Step 4: Prove zero unresolved decisions**

Run: `node tooling/docs/validate-docs.mjs --mode staging`

Expected: trace hash matches, all Hard source ranges resolve, `Needs Decision` count is 0, and no release value is duplicated in the trace file.

### Task 8: Synchronize the three Kiro-derived specifications

**Files:**

- Modify: `.kiro/specs/where-not-rain/requirements.md`
- Modify: `.kiro/specs/where-not-rain/design.md`
- Modify: `.kiro/specs/where-not-rain/tasks.md`

**Interfaces:**

- Consumes all MVP Active Hard Requirements selected through Roadmap records.
- Produces canonical derived manifests using Task 1's digest algorithm.

- [ ] **Step 1: Regenerate MVP requirements**

Add the exact single-line derived manifest first. Include every MVP Active Hard Requirement exactly once in EARS form. Remove Compare, Weekend Planner, articles, Thai/Vietnamese, custom growth reports, Seasonal, dynamic Feature Flags/experiments, candidate-provider activation, Travel News, AI Match, and 30-Day Outlook from current MVP requirements. Preserve future IDs only in an explicit non-normative “Out of current scope” link to Roadmap, not as requirements.

- [ ] **Step 2: Reconcile design coverage**

Add a derived manifest containing all source IDs referenced by the design. Retain useful implementation diagrams and interfaces, but replace old `SPEC §N` ownership claims with links to authoritative IDs. Add a coverage appendix mapping every MVP Active Hard Requirement to at least one design heading. Remove any design-level `must/shall` statement that has no source ID.

- [ ] **Step 3: Reconcile task coverage and evidence fields**

Remove detailed Beta/V1/V2 tasks. For every remaining task add actual comma-separated IDs, an executable command, and an observable result. Use this concrete field form for a domain task: `_Requirements: DATA-SCORE-001, ENG-TEST-001_`, `Verify: pnpm --filter @wnr/domain test`, `Expected: command exits 0 with all domain tests passing`, and `Evidence: pending — verification has not been executed`. For a different task, use the real package or root command already named in that task; tokens and generic placeholders are forbidden in the resulting `tasks.md`. Keep all current checkboxes unchecked unless the task's full command is run during this task; file existence alone is not evidence. Add a coverage appendix proving every MVP Active Hard Requirement maps to at least one task.

- [ ] **Step 4: Generate canonical manifests and validate**

Use exports from `requirement-format.mjs` in a short Node command or a dedicated `--write-derived-manifest` CLI option; do not hand-calculate digests.

Run: `node tooling/docs/validate-docs.mjs --mode staging`

Expected: Kiro bidirectional coverage and digest checks pass; only Draft/cutover/index errors remain.

### Task 9: Perform logical cutover and final verification

**Files:**

- Modify: all new `docs/*.md` front matter from Draft to Active.
- Modify: `SPEC.md`
- Modify: `README.md`
- Modify: `package.json` only if Task 2 scripts need formatting correction.

**Interfaces:**

- Consumes the fully validated staging set.
- Produces the active authoritative documentation system.

- [ ] **Step 1: Run the pre-cutover gate**

Run:

```bash
pnpm docs:test
node tooling/docs/validate-docs.mjs --mode staging
```

Expected: tests PASS; staging validator reports no errors other than the explicitly recognized pre-cutover state. If any content, trace, release, digest, link, or coverage error exists, stop before changing authority status.

- [ ] **Step 2: Activate domain documents in one controlled batch**

Change every authority front matter status to `Active`. Replace `SPEC.md` with a concise active document containing product identity, hard constraints, authority precedence, current release summary, Requirement ID rules, domain links, Kiro-derived status, change/cutover protocol, and conflict handling. It must not copy feature, schema, API, performance, or release tables.

- [ ] **Step 3: Update root README**

Add a “Documentation authority” section linking `SPEC.md`, `docs/README.md`, Roadmap, and Kiro-derived files. Replace references such as `SPEC §7.2` with stable document/Requirement links. Keep commands and monorepo layout accurate.

- [ ] **Step 4: Run active validation**

Run: `pnpm docs:check`

Expected: exit code 0; zero errors, zero `Needs Decision`, all authority docs Active, every Hard requirement released once, all links and Kiro digests valid.

- [ ] **Step 5: Run repository regression checks**

Run:

```bash
pnpm docs:test
pnpm format:check
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

Expected: every command exits 0. If package installation is unavailable, report that exact blocker and still run all Node-only docs tests/checks; do not claim full regression success.

- [ ] **Step 6: Run independent semantic audit**

The reviewer must verify: unique authority ownership, exact MVP/Beta/V1/V2 assignment, no product-code changes, original Hard-source coverage, all audited gaps closed, no duplicate normative contract, Kiro MVP-only derivation, and no false task completion. Any Critical or Major finding reopens the relevant task and requires rerunning Steps 4–5.

- [ ] **Step 7: Record the cutover decision log**

In `docs/11-Roadmap.md`, record date, changed authority set, validation commands/results, known limitations, and `ADR: none — no new architectural decision` unless implementation actually created or changed an architecture decision. Do not create a Git commit because the workspace is not a Git repository.

## Final Evidence Checklist

- `weather.txt` SHA-256 remains `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`.
- `pnpm docs:test` passes.
- `pnpm docs:check` exits 0 in active mode.
- `pnpm format:check`, recursive typecheck, tests, and builds pass or have a precisely documented environment blocker.
- Traceability has zero `Needs Decision` and maps every Hard source requirement.
- Roadmap is the only release/lifecycle owner.
- Kiro requirements/design/tasks satisfy bidirectional MVP coverage and current digests.
- `SPEC.md` is an index/governance entry point, not a second domain contract.
- Product source files under `apps/`, `workers/`, and `packages/` are unchanged.
