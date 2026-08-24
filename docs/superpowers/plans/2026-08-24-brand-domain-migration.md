# Brand-domain migration plan — Where Not Rain

## Goal

Move the public acquisition surface from `868656.xyz` to a durable Where Not Rain brand domain without losing canonical identity, search discovery, analytics continuity, affiliate attribution or saved links.

This plan does not choose or register a domain. DNS/registrar changes begin only after the final brand domain is owned and approved.

## Current migration readiness

The production web build now accepts `APP_BASE_URL` from a GitHub Actions variable, with `https://868656.xyz` as the fallback. IndexNow likewise accepts `INDEXNOW_SITE_HOST`. This allows the canonical/search host to switch without another source-code edit.

The following surfaces still require an intentional cutover because they currently reference the legacy host or its subdomains:

- Trip API public URL and authentication origins/callbacks;
- product-analytics custom domain and `WEB_ORIGIN` CORS allowlist;
- saved-search/share/export URL guards;
- security controls that bound allowed origins;
- any explicit production smoke-test expectations;
- Cloudflare Pages/Workers custom domains and DNS;
- Search Console/Bing Webmaster Tools properties and sitemaps;
- affiliate provider allowed/referrer domains where provider policy requires registration.

## Phase A — Prepare, no traffic change

1. Own and approve the final brand domain.
2. Add the new domain to the existing Cloudflare zone/account.
3. Attach the brand domain to the Pages project while keeping `868656.xyz` live.
4. Decide whether API subdomains stay on `868656.xyz` temporarily or move with the web host.
5. Add the new web origin to auth/CORS/provider allowlists before canonical URLs change.
6. Verify TLS, `/robots.txt`, `/sitemap.xml`, IndexNow key file, country pages and city pages on the new host.
7. Verify product analytics accepts events from the new web origin.
8. Verify approved affiliate programs permit the new referring domain.

## Phase B — Canonical cutover

Set repository/environment variables for the release:

```text
APP_BASE_URL=https://<brand-domain>
INDEXNOW_SITE_HOST=<brand-domain>
```

If APIs move at the same time, update their production URLs/custom domains and corresponding auth/CORS allowlists in the same release.

Acceptance checks before redirecting the old host:

- homepage canonical uses the brand domain;
- country/city canonical and hreflang URLs use the brand domain;
- sitemap contains only brand-domain canonical URLs;
- robots points to the brand-domain sitemap;
- country-map sharing produces brand-domain URLs;
- city links and ranking links stay on the brand domain;
- analytics POST succeeds from the brand domain;
- affiliate outbound links still pass host/path validation;
- no mixed canonical between old and new hosts.

## Phase C — Redirect legacy public URLs

After the brand-domain build is healthy, configure permanent one-hop redirects from `868656.xyz` to the exact path/query on the brand domain.

Requirements:

- preserve path and meaningful query parameters;
- use one permanent redirect hop;
- do not redirect APIs until their clients/callbacks are migrated;
- keep the old domain registered and redirects active for at least 12 months;
- keep the legacy Search Console property during migration monitoring.

## Phase D — Search migration

1. Verify both old and new domain properties in Google Search Console.
2. Submit the new sitemap on the brand-domain property.
3. Use Google's supported site-move workflow if applicable to the property type.
4. Verify the new Bing Webmaster Tools property and submit the sitemap.
5. Publish/verify the IndexNow key on the new host and run the focused high-intent submission.
6. Monitor indexed pages, canonical selection, impressions, clicks and crawl errors on both properties.

Do not delete old sitemap/property history during the migration window.

## Phase E — Commercial and analytics verification

For the first releases after cutover, compare by day:

- country-map views;
- city selection/open rate;
- affiliate impressions;
- affiliate clicks and CTR;
- provider-reported conversions/revenue;
- analytics rejection/CORS errors;
- 404/redirect volume on the legacy domain.

A host migration is successful only when acquisition and commercial funnels remain within normal variance, not merely when DNS resolves.

## Rollback

Before legacy redirects become permanent, rollback is changing `APP_BASE_URL` and `INDEXNOW_SITE_HOST` to the legacy values and restoring the prior Pages custom-domain routing. Keep old API origins and custom domains operational throughout the observation window so rollback does not require a data migration.
