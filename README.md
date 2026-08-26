# Where Not Rain

A time-driven travel weather map for people who know **when** they can travel but have not decided **where** to go. Pick a forecast window and the world map immediately shows which supported countries have stronger mostly rain-free options; open a country only when you want city-level evidence.

## Current product direction

```text
choose time window
→ this weekend / next 7 days / custom forecast dates
→ world map recolors for the selected window
→ country strip updates from the same window
→ open a country
→ compare its cities on the same dates
→ open city-level daily weather
```

Time is the only required homepage input. The active homepage does **not** ask for a starting city, transport mode or maximum one-way planning time. Country color is driven by the strongest three city options in that country for the selected window: mostly rain-free day ratio first, expected rain second, peak rain chance third.

English, Simplified Chinese and Traditional Chinese home pages use the same time-first interaction model. `/discover` remains available as an advanced compatibility surface for origin/reachability planning, but it is `noindex`, absent from primary navigation, PWA entry and sitemap acquisition. Country/city maps remain crawlable evidence and acquisition pages. Advanced itinerary, collaboration, route and execution capabilities remain under `/trips` for existing users but are not part of primary acquisition.

The current positioning is recorded in:

- `docs/superpowers/plans/2026-08-26-time-driven-world-map.md`
- `docs/00-Founder-Vision.md`

The 2026-08-19 OPC reachability engine, 2026-08-20 country-map cutover and 2026-08-25 `/discover` positioning remain historical implementation context. For primary homepage acquisition, the 2026-08-26 time-driven world-map decision supersedes them.

## Privacy-safe product measurement

Bounded product events are accepted by the dedicated `product-analytics` Worker and stored in the isolated `wnr_product_events_v1` table in the existing Trip D1 database. The collector stores no account, email, IP, user/session/device identifier, raw URL, query string, free text, itinerary or precise location. Rows have 90-day retention and are never joined to trip or user records.

The primary decision funnel is:

```text
homepage weather-window view
→ time window selected
→ world/country weather read
→ country selected
→ city weather opened
→ optional downstream conversion
```

The advanced compatibility funnel remains separate:

```text
/direct or saved /discover link
→ optional origin/reachability planning
→ Top 3 shortlist
→ destination selected
→ optional post-selection commercial action
```

## Documentation authority

The documentation system is indexed by [`SPEC.md`](SPEC.md). Read it first for product identity, authority precedence, the current release summary, Requirement ID rules, the domain-document links table, Kiro-derived status, and the change/cutover and conflict protocols.

Supporting documents:

- [`SPEC.md`](SPEC.md) — governance index and authority entry point.
- [`docs/README.md`](docs/README.md) — documentation governance, ownership map, and conflict protocol.
- [`docs/11-Roadmap.md`](docs/11-Roadmap.md) — sole owner of `first_release` and `lifecycle`.
- [`.kiro/specs/where-not-rain/requirements.md`](.kiro/specs/where-not-rain/requirements.md) — MVP-derived requirements.
- [`.kiro/specs/where-not-rain/design.md`](.kiro/specs/where-not-rain/design.md) — MVP-derived design.
- [`.kiro/specs/where-not-rain/tasks.md`](.kiro/specs/where-not-rain/tasks.md) — MVP-derived tasks.

The Kiro-derived files are implementation material and never override an authority document.

## Layout

```text
apps/web                 Next.js App Router UI and static country/city pages
workers/weather-sync     provider ingestion and scoring
workers/weather-read     provider-free weather read API
workers/trip-api         existing advanced itinerary cloud API
workers/product-analytics bounded D1 product-event collector
packages/domain          pure travel-weather domain logic
packages/weather         provider port and adapters, sync-only
packages/db              D1 schema, migrations and repositories
packages/analytics       allowlisted analytics contracts and adapters
packages/seo             metadata, JSON-LD and sitemap quality gates
packages/i18n            locale dictionaries and formatters
tooling/*                shared config, release tooling and aggregate SQL
```

`packages/weather` remains importable only by `workers/weather-sync`, so a user-path provider call cannot compile.

## Commands

```bash
pnpm install
pnpm -r typecheck
pnpm -r build
pnpm -r test
pnpm lint
pnpm format
```

## Requirements

- Node >= 22
- pnpm >= 10
