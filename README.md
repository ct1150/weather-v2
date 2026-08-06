# Where Not Rain

Weather-driven travel discovery platform. Monorepo managed with pnpm workspaces.

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

```
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

## Dependency direction (must never cycle)

`packages/domain` sits at the bottom and imports no framework/Cloudflare/provider code.
`packages/weather` is importable only by `workers/weather-sync`, so a user-path provider
call cannot compile (see [`SPEC.md`](SPEC.md)).

## Commands

```bash
pnpm install        # install workspace deps
pnpm -r typecheck   # typecheck every package
pnpm -r build       # build every package
pnpm -r test        # run tests
pnpm lint           # lint (incl. import-boundary rules, task 1.4)
pnpm format         # prettier
```

## Requirements

- Node >= 22
- pnpm >= 10

## Trip Planner MVP

The weather-aware trip planning increment adds:

- `/zh-cn/trips` — Chinese trip workspace.
- `/zh-cn/trips/qinggan-family-2026` — Qinghai–Gansu family itinerary demo.
- `/zh-cn/trips/new` — Markdown itinerary import preview.

See [`docs/16-Trip-Planner-MVP.md`](docs/16-Trip-Planner-MVP.md) for architecture, weather fallback behavior and the next delivery increment.
