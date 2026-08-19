# Where Not Rain

Automated least-rain destination decision tool for a one-person company. Users choose a supported starting hub, travel dates, transport mode and maximum one-way planning time, then receive only the three reachable destinations with the lowest rain risk.

## Current product direction

```text
choose origin, transport and maximum one-way planning time
→ choose dates and optionally exclude places that are too wet, hot, cold or windy
→ compare the Top 3 reachable least-rain destinations
→ choose one destination
→ continue to external booking or weather reminders
```

Rain is the only ranking target. Temperature and wind remain visible and may be used as explicit hard filters, but they do not silently alter the dry score.

Existing itinerary, collaboration, route and execution capabilities remain available for current users under `/trips`, but they are no longer part of primary navigation, acquisition, sitemap or product expansion.

The OPC product contract is recorded in `docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md` and its phased implementation plan in `docs/superpowers/plans/2026-08-19-opc-product-cutover-phase0.md`.

## Documentation authority

The documentation system is indexed by [`SPEC.md`](SPEC.md). Read it first for product identity, authority precedence, the current release summary, Requirement ID rules, the domain-document links table, Kiro-derived status, and the change/cutover and conflict protocols.

Supporting documents:

- [`SPEC.md`](SPEC.md) — governance index and authority entry point.
- [`docs/README.md`](docs/README.md) — documentation governance, ownership map, and conflict protocol.
- [`docs/11-Roadmap.md`](docs/11-Roadmap.md) — sole owner of `first_release` and `lifecycle`.
- [`.kiro/specs/where-not-rain/requirements.md`](.kiro/specs/where-not-rain/requirements.md) — MVP-derived requirements (derived).
- [`.kiro/specs/where-not-rain/design.md`](.kiro/specs/where-not-rain/design.md) — MVP-derived design (derived).
- [`.kiro/specs/where-not-rain/tasks.md`](.kiro/specs/where-not-rain/tasks.md) — MVP-derived tasks (derived).

The Kiro-derived files are implementation material and never override an authority document.

## Layout

The monorepo layout and package boundaries are authoritative via the domain documents indexed in [`SPEC.md`](SPEC.md):

```text
apps/web              Next.js App Router app (UI + read APIs) — never imports @wnr/weather
workers/weather-sync  Six-hour tiered ingestion + scoring + read-model writer (only provider caller)
workers/maintenance   Ranking refresh, sitemap, health, cleanup
packages/ui           Shared components, design tokens, AsyncState primitives
packages/domain       Entities, ports, pure Travel Score logic (no framework deps)
packages/weather      WeatherProvider port + Open-Meteo/WeatherAPI adapters (sync-only)
packages/db           D1 schema, migrations, repositories, KV read models
packages/config       Typed runtime config + feature flags
packages/analytics    Event contracts + adapters, affiliate adapter
packages/seo          Metadata, JSON-LD, sitemap, quality gates
packages/i18n         Locale dictionaries, formatters, reason-code translation
packages/test-utils   Generators, fixtures, fake bindings
tooling/*             Shared tsconfig, eslint, prettier, tailwind, vitest presets
docs/12-ADR/          Architecture Decision Records
```

## Dependency direction

`packages/domain` sits at the bottom and imports no framework, Cloudflare or provider code.
`packages/weather` is importable only by `workers/weather-sync`, so a user-path provider call cannot compile.

## Commands

```bash
pnpm install        # install workspace deps
pnpm -r typecheck   # typecheck every package
pnpm -r build       # build every package
pnpm -r test        # run tests
pnpm lint           # lint
pnpm format         # prettier
```

## Requirements

- Node >= 22
- pnpm >= 10
