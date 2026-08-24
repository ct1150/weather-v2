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

The SQL files remain deliberately small so the one-person operating model does not require a BI
service or analytics dashboard.

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
