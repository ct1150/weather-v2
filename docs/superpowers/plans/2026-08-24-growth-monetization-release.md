# Growth & Monetization release — 2026-08-24

## Objective

Turn the country-first Weather V2 product into a measurable public-growth and monetization beta without weakening the weather-first product contract.

## P0 — implemented in this branch

### Core decision-point commercial bridge

- Country-map city decisions can expose contextual commercial actions after a real city selection.
- City pages can expose the same decision-stage commercial actions immediately from the known city context.
- Discovery-stage monetization prioritizes Hotel + Activities.
- Commercial UI remains fail-closed/zero-fill unless an approved production provider configuration is supplied.
- Affiliate impression/click telemetry now supports active country and city route templates.

### Production configuration path

GitHub Actions web builds now accept these repository variables:

```text
NEXT_PUBLIC_AFFILIATE_SLOTS
NEXT_PUBLIC_AFFILIATE_OFFERS_JSON
```

The safe first slots are:

```text
discovery.hotel
discovery.activities
```

Real provider enablement is intentionally an external launch gate: provider approval/tracking URLs must be supplied by an actual affiliate account. The repository must never fabricate a partner relationship, tracking code, price or availability.

### Product-funnel verification path

Existing country/city analytics remains the product funnel source of truth. New commercial events use the same privacy-safe product-analytics collector and route-template allowlist.

## P1 — implemented foundation

### Revenue attribution

- `affiliate_revenue_daily_v1` stores only provider-reported daily aggregates by provider/category/destination/currency.
- `commercial.sql` now reports impressions, clicks, CTR, conversions and revenue.
- No click ID, order ID, account, email, device/session ID or cross-site visitor identifier is introduced.

### SEO acquisition focus

- The full sitemap remains crawlable.
- Proactive IndexNow submission focuses on 24 logical high-intent acquisition targets (localized variants included) rather than pushing every generated page equally.
- Targets emphasize homepage, global weekly/weekend decisions, country comparison pages, country weekly rankings and a small set of flagship city pages.

### Brand-domain readiness

- `APP_BASE_URL` and `INDEXNOW_SITE_HOST` are configurable at release time.
- A separate migration plan identifies remaining auth/CORS/API/custom-domain/Search Console/redirect steps.

## Release gates

The branch is ready to merge only when repository CI passes the normal format, lint, typecheck, unit/integration, documentation and build gates.

After merge, production commercial rendering remains zero-fill until approved affiliate variables are configured. This is expected and safe.

## Post-deploy acceptance

1. Country page loads normally with affiliate variables absent.
2. Selecting a city still updates the map inspector and emits `city_viewed`.
3. With a validated provider fixture/config, the selected destination can show Hotel and Activities actions.
4. City page can render the same actions for its known city.
5. Invalid/stale/unapproved offer data produces no commercial UI.
6. Affiliate impression/click events are accepted on `/[country]` and `/[country]/[city]`.
7. `commercial.sql` can aggregate commercial funnel data after migration 0007 is applied.
8. Sitemap remains complete while IndexNow prioritizes the high-intent acquisition set.
