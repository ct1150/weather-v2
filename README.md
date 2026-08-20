# Where Not Rain

Country-first travel weather maps for a one-person company. A visitor chooses a country, then reads weather icons, lower-rain days and temperatures for popular destinations directly on one map.

## Current product direction

```text
choose country
→ see popular destinations on one map
→ compare the next 7 days at a glance
→ optionally grey places that are too wet, windy, hot or cold
→ tap a destination for its daily forecast
```

The active product does not ask for a starting city, transport mode or maximum travel time. It does not use an opaque multi-factor Travel Score to decide which destination appears better. Weather remains the visible evidence and every supported destination remains on the map.

English, Simplified Chinese and Traditional Chinese home and country pages share the same interaction model. The legacy least-rain finder remains available under `/discover` for existing saved links but is `noindex` and absent from primary navigation, PWA entry and sitemap acquisition. Existing itinerary, collaboration, route and execution capabilities remain available under `/trips` for current users but are not part of product expansion.

The current product contract is recorded in:

- `docs/superpowers/product/2026-08-20-founder-prd-country-weather-map.md`
- `docs/superpowers/plans/2026-08-20-country-weather-map-cutover.md`

## Privacy-safe product measurement

Bounded product events are accepted by the dedicated `product-analytics` Worker and stored in the isolated `wnr_product_events_v1` table in the existing Trip D1 database. The collector stores no account, email, IP, user/session/device identifier, raw URL, query string, free text, itinerary or precise location. Rows have 90-day retention and are never joined to trip or user records.

The country-map funnel is:

```text
homepage map entry
→ country selection
→ country map view
→ city marker/list interaction
→ city detail open
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
