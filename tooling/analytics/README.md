# OPC product funnel analytics

D1 table: `wnr_product_events_v1`

The product-analytics Worker accepts one allowlisted event per request, validates it with
`@wnr/analytics`, rejects sensitive fields and writes one fixed D1 row. The table lives in the
existing Trip D1 database to avoid another account-level service or database, but it is isolated
from trip records and is never joined to users, accounts or itinerary data.

No raw URL, query string, free text, account, email, user ID, session ID, device ID, IP address or
itinerary content is stored. The browser path is still best-effort, and a storage failure cannot
block destination discovery or navigation.

## Retention

Migration `workers/trip-api/migrations/0006_product_analytics.sql` creates the table and indexes.
Every 100 accepted events, a D1 trigger removes rows older than 90 days. `_sample_interval` is fixed
to `1`, preserving the aggregate-query contract used by the original Analytics Engine projection.

## Fixed schema

| Column | Meaning |
|---|---|
| `timestamp` | server receive time |
| `occurred_at` | bounded client event time |
| `index1` | event name |
| `blob1` | locale |
| `blob2` | route template |
| `blob3` | origin ID |
| `blob4` | transport mode |
| `blob5` | days-until-departure bucket |
| `blob6` | no-result reason |
| `blob7` | destination or city ID |
| `blob8` | result type |
| `blob9` | creation source |
| `blob10` | affiliate category |
| `blob11` | placement |
| `blob12` | provider or network ID |
| `blob13` | destination key or country code |
| `blob14` | ranking window |
| `blob15` | ranking theme |
| `double1` | maximum one-way planning minutes |
| `double2` | trip length days |
| `double3` | reachable destination count |
| `double4` | returned result count |
| `double5` | result position or rank |
| `double6` | shortlist count |
| `double7` | calendar reminder count |
| `double8` | rain limit set (`1`/`0`, `-1` N/A) |
| `double9` | wind limit set (`1`/`0`, `-1` N/A) |
| `double10` | temperature limit set (`1`/`0`, `-1` N/A) |
| `double11` | generic bounded count |
| `double12` | fallback flag (`1`/`0`, `-1` N/A) |
| `_sample_interval` | fixed event weight (`1`) |

Use `SUM(_sample_interval)` for event counts. Run a query against production with the existing
product-analytics D1 binding, for example:

```bash
pnpm --filter @wnr/product-analytics exec wrangler d1 execute DB \
  --env production --remote --file ../../tooling/analytics/funnel.sql
```

The SQL files remain deliberately small so the one-person operating model does not require an
external BI service.

## Private Growth Dashboard

The product-analytics Worker exposes an optional private operator view at `/growth`. It is disabled
by default. Configure GitHub Actions Secret `GROWTH_DASHBOARD_PASSWORD` with a strong password of at
least 12 characters; the production deploy then stores it as a Worker Secret. With no secret, the
route returns `404` and collection continues normally.

When enabled, open `https://analytics.868656.xyz/growth`. The browser presents an HTTP Basic-auth
prompt; the username may be any non-empty value and the password is the configured secret. Add
`?format=json` for the same snapshot as JSON. Responses are `no-store`, HTML is `noindex`, and the
secret never enters the public web bundle.

The dashboard intentionally uses only aggregate anonymous event counts and shows both trailing 7-day
and 28-day windows:

- **Acquisition:** homepage views, country selection rate and top selected countries.
- **Activation:** country-map views and city interaction rate.
- **Decision:** city-detail-open rate. A detail open is recorded when a country-map city link is
  activated, distinct from selecting a city inside the map.
- **Retention intent:** shortlist actions relative to country-map views. This is a behavioral signal,
  not a D1/D7 cohort-retention rate, because the analytics design stores no user/session/device ID.

The first monetization-readiness gate uses deliberately simple working thresholds: at least 300
homepage views in 28 days, country selection ≥20%, map city interaction ≥30%, city detail open ≥15%
and shortlist intent ≥5%. These are **internal validation thresholds, not industry benchmarks**. The
gate reaches `ready_for_monetization_test` when sample size is sufficient and at least four of five
checks pass. Affiliate impressions, clicks and revenue are intentionally excluded from this gate so
commercial integration cannot make the underlying product look healthier than it is.

## Country-map funnel

`country-map-funnel.sql` is the active product query after the country-first cutover. It aggregates
homepage map entry, country selection, country-map views and city interactions. Legacy discovery
queries remain available for compatibility analysis, but no longer define the primary product
funnel.

## Affiliate conversion and revenue attribution

Browser analytics intentionally stops at aggregate affiliate impressions/clicks. It does **not**
create a click ID or any user-level identifier. Migration
`workers/trip-api/migrations/0007_affiliate_revenue.sql` adds `affiliate_revenue_daily_v1`, a
provider-report table keyed only by day, provider, category, destination and currency.

Import only verified aggregate data exported by an approved affiliate provider. Never import order
IDs, customer details, booking references, email addresses or raw click identifiers. A typical
upsert is:

```sql
INSERT INTO affiliate_revenue_daily_v1 (
  event_date, provider_id, category, destination_id, currency,
  conversions, revenue_minor, source, imported_at
) VALUES (
  '2026-08-24', 'approved-provider', 'hotel', 'tokyo', 'USD',
  2, 1840, 'provider_report', datetime('now')
)
ON CONFLICT(event_date, provider_id, category, destination_id, currency)
DO UPDATE SET
  conversions = excluded.conversions,
  revenue_minor = excluded.revenue_minor,
  source = excluded.source,
  imported_at = excluded.imported_at;
```

`commercial.sql` joins these daily provider aggregates to impression/click aggregates by provider,
category, destination and date, producing CTR, conversions and revenue without tracking an
individual visitor across the outbound journey.
