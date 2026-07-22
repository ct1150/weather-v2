# Task 7 Report — Complete Source Traceability

- Date: 2026-07-17
- Status: Complete for Task 7 scope
- Authority state: Draft / Non-authoritative
- Source authority during migration: `SPEC.md`
- ADR: none — no new architectural decision

## Status

Created only the two Task 7 artifacts:

1. `docs/13-Requirements-Traceability.md` — immutable source metadata, classification and decision rules, a human-readable matrix, and machine-readable trace comments.
2. `.superpowers/sdd/task-7-report.md` — this execution and validation record.

No product code, authority requirement, Roadmap, Kiro-derived file, validator, test, configuration, or `weather.txt` content was modified. The directory is not a Git repository; no commit was created or claimed.

The trace authority remains `status: Draft`. It records the locked `weather.txt` baseline as 1,476 lines with SHA-256 `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d` and audit date `2026-07-17`.

## Trace result

The document contains 139 fine-grained, one-based inclusive records. Their ranges are a gap-free and non-overlapping partition of `1..1476`; every source line is covered exactly once.

| Dimension      | Count |
| -------------- | ----: |
| Hard           |   114 |
| Suggestion     |    14 |
| Example        |    11 |
| Covered        |   121 |
| Changed        |    14 |
| Rejected       |     4 |
| Needs Decision |     0 |

All 114 Hard records point to an existing `Active` / `Hard` authority Requirement. Every Suggestion or Example record uses `requirement_id: NONE`; the current Active authority set has no Guidance requirement. No trace stores `first_release` or `lifecycle`.

The required non-Hard classifications are explicit:

- `Top 100 Sunny Cities` is Example.
- The `150–250` page target is Suggestion / Rejected.
- Hotel, flight, budget, and other sample price values are Example.
- Tokyo, Sapporo, Busan, Da Nang, Chiang Mai, Okinawa, Hakone, Yokohama, and Kamakura output samples are Example.
- Future autonomous AI writing is Suggestion / Changed to mandatory human review.
- The delivery tree at lines `1453–1476` is Example.

All Changed and Rejected rationales begin with the exact structure `Approved: 2026-07-17 by Product Owner — reason`. Explicit controlled changes include:

- `30-Day Forecast` to `30-Day Outlook` / Trend with uncertainty and confidence.
- Pages-first deployment with the evidence + Accepted ADR + Product Owner-approved Workers fallback.
- Authorized, currency- and freshness-qualified price data only.
- AI-assisted factual travel or safety content only after human editorial review.
- Route-class rendering instead of unconditional static generation.
- Lighthouse 100 as the product target with the approved production-equivalent CI gate.
- Baseline versus later map filters, quality-gated seasonal pages, bounded growth recommendations, privacy-safe search analytics, and quality-gated index scale.

## Verification

### Formatting

Command:

```text
pnpm exec prettier --check docs/13-Requirements-Traceability.md
```

Result on 2026-07-17: exit `0`; `All matched files use Prettier code style!`.

### Documentation tests

Command:

```text
pnpm docs:test
```

Result on 2026-07-17: exit `0`; 59 tests passed, 0 failed, 0 skipped.

### Staging validator

Command:

```text
node tooling/docs/validate-docs.mjs --mode staging
```

Result on 2026-07-17: expected exit `1`; `940 error(s), 0 warning(s); 78 requirement(s), 78 release(s), 139 trace(s)`.

A programmatic classification of the returned validator result proved:

- non-Kiro errors: `0`
- trace errors: `0`
- `.kiro/specs/where-not-rain/design.md`: 202 errors
- `.kiro/specs/where-not-rain/requirements.md`: 127 errors
- `.kiro/specs/where-not-rain/tasks.md`: 611 errors

The nine remaining error codes are exclusively Task 8 Kiro derivation work: `DERIVED_COVERAGE_MISSING`, `KIRO_COVERAGE_MISSING`, `KIRO_REQUIREMENT_MISSING`, `MISSING_DERIVED_MANIFEST`, `MISSING_DESIGN_REQUIREMENTS`, `MISSING_TASK_EVIDENCE`, `MISSING_TASK_EXPECTED`, `MISSING_TASK_REQUIREMENTS`, and `MISSING_TASK_VERIFY`.

### Independent trace audit

A repository-parser audit recomputed the source digest and line count, parsed every authority requirement and trace, counted every source-line occurrence, validated target status/kind, checked structured approvals and duplicate mapping keys, and asserted the required non-Hard source examples.

Observed result:

```json
{
  "hash": "70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d",
  "lineCount": 1476,
  "traceCount": 139,
  "badLineCounts": [],
  "invalidHard": 0,
  "invalidNonHard": 0,
  "badApprovals": 0,
  "needsDecision": 0,
  "duplicateKeys": 0,
  "nonHardChecks": {
    "top100": true,
    "pageTarget": true,
    "samplePrices": true,
    "exampleCities": true,
    "aiAutoWrite": true
  }
}
```

## Concerns

- Staging is intentionally not green until Task 8 regenerates the three Kiro-derived files and adds their required manifests, coverage metadata, task verification fields, and evidence fields.
- Draft documents remain non-authoritative; no product implementation may start from them before controlled cutover.
- No actual provider, analytics, Affiliate, advertising, Cloudflare, database, deployment, or product integration was performed.

## Review remediation addendum — 2026-07-17

This addendum supersedes the earlier Task 7 status, scope, counts, and semantic-completeness claims. The earlier report proved that the trace was structurally parseable, but **structural validity is not semantic validity**: a valid Requirement ID, complete line union, and passing link/hash checks did not prove that each source sentence mapped to its actual authority owner. Review found broad records that concealed mixed ownership and two missing authority contracts.

### Corrected scope and authority additions

The remediation read `task-7-review.md`, `task-7-brief.md`, all 1,476 lines of locked `weather.txt`, the approved optimization design, Documentation Governance, every authority from Founder Vision through Growth, the complete Roadmap registry, and the ADR policy before editing.

The current changed documentation scope is:

- `docs/01-Product-PRD.md`: added Active Hard `PRD-FR-017` for V2 account-backed Favorites, opt-in Email Alerts, Account privacy/security, and Premium entitlement, with six hard acceptance criteria and inline Roadmap link.
- `docs/05-System-Architecture.md`: added Active Hard `ARCH-STACK-001` for the MVP Continuous stack: Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, MapLibre GL, Heroicons, and the governed Cloudflare Workers/D1/KV/optional-R2/Cron/Web Analytics/CDN/Pages platform, with six hard acceptance criteria and owner links.
- `docs/11-Roadmap.md`: added the exact one-to-one release records `REL-V2-PRD_FR_017` (`V2`, `Launch`) and `REL-MVP-ARCH_STACK_001` (`MVP`, `Continuous`), each with matching anchor, visible table row, canonical JSON comment, and authority back-link.
- `docs/13-Requirements-Traceability.md`: regenerated the human matrix and machine comments from one audited 176-record set.
- `.superpowers/sdd/task-7-report.md`: appended this correction and current evidence.

No product code, Kiro-derived file, validator, test, dependency, configuration, `weather.txt`, or other authority was modified. This directory is not a Git repository; no Git operation or commit was performed or claimed. The documents remain Draft / Non-authoritative, and `SPEC.md` remains authoritative until controlled cutover. `ADR: none — no new architectural decision`; this remediation records already approved authority contracts and trace corrections rather than making a runtime architecture decision.

### Corrected trace result

| Dimension      | Count |
| -------------- | ----: |
| Trace records  |   176 |
| Hard           |   149 |
| Suggestion     |    16 |
| Example        |    11 |
| Covered        |   146 |
| Changed        |    26 |
| Rejected       |     4 |
| Needs Decision |     0 |

The 176 one-based inclusive ranges are a gap-free, non-overlapping exact partition of `1..1476`; every line occurs once. Every Hard record resolves to one of 80 Active Hard authority requirements. The Roadmap contains exactly 80 release records for those 80 requirements. Every Changed or Rejected record uses the exact `Approved: 2026-07-17 by Product Owner — reason` format. The human matrix and 176 machine comments are field-for-field equivalent.

Review findings were corrected at sentence-level, including: role versus product position; Free-plan constraints versus outcome metrics; business narrative versus Analytics and candidate providers; complete stack versus Analytics and deployment owners; City Page versus Theme Park/Mountain data eligibility; Nearby versus city-page sections; JSON-LD, RSS, sitemap, and rendering owners; Bot Protection versus CSP; the original 16-stage sequence versus the current Roadmap protocol; IMPORTANT cost, DoD, and deployment obligations; baseline map themes versus V1 Seasonal Travel and later activities; authorized hotel price versus covered Travel Score; Travel News generation versus reviewed editorial workflow; seasonal SEO route ownership; Design System versus async states; every-stage ADR generation versus mandatory decision logs and conditional ADRs; rejected SunnyAtlas/surfing suggestions versus approved activity capabilities; and the final Agent-read sentence versus documentation-library delivery.

### Structural evidence versus semantic evidence

**Structural evidence** establishes machine form only. The repository validator and parser prove valid metadata, IDs, anchors, links, exact release cardinality, source digest, source excerpt containment, allowed classifications, structured approvals, and source-union coverage. These checks cannot decide whether, for example, `JSON-LD` belongs to `SEO-PAGE-001` or `SEO-STRUCTURED-001`, or whether a mixed source span must be split.

**Semantic evidence** used a separate full pass. First, every one of the previous 139 records was printed with its complete nonblank `weather.txt` source text and reviewed sequentially against all authority contracts. Each mixed record was split until every resulting range had one semantic owner or one rationale-only decision. Second, an independent audit reloaded all 80 requirements, 80 release records, and all 176 final traces; compared each range to the locked source; required every source line exactly once; compared the full human matrix to the machine tuples; checked every Hard target, excerpt, and approval; and asserted 35 high-risk owner boundaries covering every review finding plus additional mixed ranges found during the full pass. The other retained ranges were also reviewed in sequence rather than inferred from validator success.

Observed independent audit result:

```json
{
  "sha256": "70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d",
  "lineCount": 1476,
  "traceCount": 176,
  "badLineCounts": [],
  "matrixMachineEqual": true,
  "matrixRows": 176,
  "invalidHard": 0,
  "badApprovals": 0,
  "badExcerpts": 0,
  "needsDecision": 0,
  "semanticCheckpoints": 35,
  "semanticMismatches": {},
  "requirements": 80,
  "releases": 80
}
```

The audit also verified the exact new release objects:

```json
{
  "ARCH-STACK-001": {
    "first_release": "MVP",
    "id": "REL-MVP-ARCH_STACK_001",
    "lifecycle": "Continuous",
    "requirement_id": "ARCH-STACK-001"
  },
  "PRD-FR-017": {
    "first_release": "V2",
    "id": "REL-V2-PRD_FR_017",
    "lifecycle": "Launch",
    "requirement_id": "PRD-FR-017"
  }
}
```

### Fresh verification evidence

- `pnpm exec prettier --write docs/01-Product-PRD.md docs/05-System-Architecture.md docs/11-Roadmap.md docs/13-Requirements-Traceability.md` — exit `0`; all authority additions were already formatted and the regenerated trace was formatted. The existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains non-failing and outside this scope.
- `pnpm docs:test` — exit `0`; 59 tests passed, 0 failed, 0 skipped.
- `node tooling/docs/validate-docs.mjs --mode staging` — expected exit `1`; `946 error(s), 0 warning(s); 80 requirement(s), 80 release(s), 176 trace(s)`. Programmatic classification counted all 946 errors under `.kiro/specs/where-not-rain/` and **0 non-Kiro errors**. The nine residual codes are exclusively Kiro derivation/evidence work: `DERIVED_COVERAGE_MISSING` 192, `KIRO_COVERAGE_MISSING` 128, `KIRO_REQUIREMENT_MISSING` 64, `MISSING_DERIVED_MANIFEST` 3, `MISSING_DESIGN_REQUIREMENTS` 75, and each of `MISSING_TASK_EVIDENCE`, `MISSING_TASK_EXPECTED`, `MISSING_TASK_REQUIREMENTS`, and `MISSING_TASK_VERIFY` 121.
- The independent semantic audit above exited `0` with zero partition, matrix, Hard-target, approval, excerpt, unresolved-decision, or semantic-checkpoint failures.

Staging remains nonzero only because Task 8 has not regenerated the three Kiro-derived files for the now-current 80-requirement authority set. This addendum claims completion of Task 7 review remediation only; it does not claim controlled cutover or repository-wide active-mode readiness.

## Re-review Fix Addendum — Round 2 — 2026-07-17

This addendum supersedes the prior Task 7 trace counts and records the fixes for all four `task-7-review.md` Re-review findings. Before editing, the remediation read the complete Re-review findings and the existing Product PRD, Roadmap, Requirements Traceability, and Task 7 report. The allowed documentation scope was preserved: only `docs/01-Product-PRD.md`, `docs/11-Roadmap.md`, and `docs/13-Requirements-Traceability.md` were changed, and this report was appended. The directory is not a Git repository, so no commit was created or claimed.

### Authority corrections

- `PRD-FR-017` now states the explicit obligation **“V2 SHALL deliver”** the account-backed Favorites, Email Alerts, Account, and Premium experience; the former optional “may provide” wording is absent.
- `PRD-FR-018` is a new Active Hard **14-Day Interactive Timeline** requirement. Its six acceptance criteria specify exact city-local date labels; a maximum 14-day horizon bounded by the latest successfully activated provider dataset; explicit unavailable, stale, partial, probability, and confidence handling without false certainty; zero user-path weather-provider calls; canonical URL and browser-history state restoration; keyboard, focus, announcement, non-color, and reduced-motion accessibility; and an equivalent ranked-list fallback with shared async states.
- Roadmap contains exactly one matching anchored machine/table release record: `REL-Beta-PRD_FR_018`, `first_release: Beta`, `lifecycle: Launch`.

### Trace corrections

The human matrix and machine comments were regenerated from one 178-record set rather than edited independently.

- Source lines `938–943` and `1057–1060` are now Hard / Covered and map to adopted `PRD-FR-015`; illustrative output remains Example / `NONE` at `944–951` and `1061–1103`.
- Source lines `1182–1196` are now Hard / Covered and map to `PRD-FR-018`.
- The former broad `201–238` stack record was split into `201–230` Covered, `231–234` Changed for optional need-based R2, and `235–238` Covered. The R2 rationale uses the required exact approval prefix and states that R2 remains unbound and optional unless a demonstrated, separately approved asset or export need requires object storage; core operation must not depend on it.

Current trace totals are:

| Dimension      | Count |
| -------------- | ----: |
| Trace records  |   178 |
| Hard           |   154 |
| Suggestion     |    13 |
| Example        |    11 |
| Covered        |   147 |
| Changed        |    27 |
| Rejected       |     4 |
| Needs Decision |     0 |

### Fresh verification evidence

- `pnpm exec prettier --write docs/01-Product-PRD.md docs/11-Roadmap.md docs/13-Requirements-Traceability.md` — exit `0`; the three allowed authority files were formatted. The existing non-failing `MODULE_TYPELESS_PACKAGE_JSON` warning remains outside this scope.
- `pnpm exec prettier --check docs/01-Product-PRD.md docs/11-Roadmap.md docs/13-Requirements-Traceability.md && pnpm docs:test` — exit `0`; all matched files used Prettier style and all 59 documentation tests passed with 0 failures and 0 skipped.
- `node tooling/docs/validate-docs.mjs --mode staging` — raw exit `1`, as expected before Task 8; `946 error(s), 0 warning(s); 81 requirement(s), 81 release(s), 178 trace(s)`. Programmatic classification found `0` non-Kiro errors. All residual errors remain under `.kiro/specs/where-not-rain/`: `DERIVED_COVERAGE_MISSING` 192, `KIRO_COVERAGE_MISSING` 128, `KIRO_REQUIREMENT_MISSING` 64, `MISSING_DERIVED_MANIFEST` 3, `MISSING_DESIGN_REQUIREMENTS` 75, and 121 each of `MISSING_TASK_EVIDENCE`, `MISSING_TASK_EXPECTED`, `MISSING_TASK_REQUIREMENTS`, and `MISSING_TASK_VERIFY`.
- The final independent semantic assertion exited `0` and recomputed SHA-256 `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`; confirmed 1,476 source lines, 178 traces, zero lines with a count other than one, 178 equivalent matrix rows and machine records, 81 unique one-to-one requirements/releases, zero unresolved decisions, valid Active Hard targets, valid excerpts and approvals, the exact FR-017/FR-018/release semantics, both AI reclassifications with examples unchanged, the Timeline mapping, and the three-way R2 split.

The staging nonzero status is solely the previously scoped Task 8 Kiro-derivation work. This addendum claims completion only of the requested Task 7 Round 2 re-review remediation; it does not claim controlled cutover or active-mode readiness.
