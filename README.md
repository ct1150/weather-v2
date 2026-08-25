# Where Not Rain

Weather-driven destination decisions for travellers whose dates are fixed but destination is still open. The primary task is to choose a starting city and dates, then receive a Top 3 shortlist of reachable destinations ranked by rain risk. Country and city weather maps remain available as a fast visual exploration and SEO acquisition layer.

## Current product direction

```text
choose starting city + travel dates + maximum one-way planning time
→ filter to maintained reachable destinations
→ apply any explicit weather limits
→ rank by rain risk
→ return Top 3
→ select a destination
→ continue into detailed country/city weather or post-selection commercial actions
```

The active product keeps rain as the ranking target. Reachability is an eligibility layer and transport time is only a tie-break after dry score and forecast confidence. Wind and temperature remain explicit user-selected limits rather than hidden score weights.

English, Simplified Chinese and Traditional Chinese home pages now lead into `/discover`. The world map and country maps remain prominent secondary exploration surfaces, and country/city pages stay crawlable acquisition pages. Advanced itinerary, collaboration, route and execution capabilities remain available under `/trips` for existing users but are not part of primary acquisition.

The current positioning realignment is recorded in:

- `docs/superpowers/plans/2026-08-25-home-decision-positioning.md`
- `docs/superpowers/product/2026-08-19-founder-prd-opc-dry-destination-engine.md`
- `docs/00-Founder-Vision.md`

The 2026-08-20 country-first weather-map PRD remains historical context for the map experience; it is superseded for homepage acquisition and primary product positioning by the 2026-08-25 realignment.

## Privacy-safe product measurement

Bounded product events are accepted by the dedicated `product-analytics` Worker and stored in the isolated `wnr_product_events_v1` table in the existing Trip D1 database. The collector stores no account, email, IP, user/session/device identifier, raw URL, query string, free text, itinerary or precise location. Rows have 90-day retention and are never joined to trip or user records.

The primary decision funnel is:

```text
homepage decision entry
→ valid discovery query
→ Top 3 returned
→ destination selected
→ optional post-selection commercial action
```

Country-map usage remains a supporting exploration funnel:

```text
homepage/world map
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
