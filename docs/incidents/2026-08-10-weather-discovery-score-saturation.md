# Incident — Weather Discovery scores collapsed to 25

Date: 2026-08-10
Status: Resolved

## User-visible symptom

Weather Discovery, especially the default `dry` / “哪里不下雨” intent, showed many destination cities with the same score of `25`.

## Root cause 1 — multi-day dry-score saturation

The original dry-intent score combined:

- maximum rain probability anywhere in the selected date range; and
- total precipitation accumulated across the whole range.

Both deductions had caps. A single high-probability rain day plus enough accumulated precipitation could saturate the same penalty for materially different cities. Longer trip windows were also penalized simply because precipitation totals accumulate with more days.

### Fix

Release: `a15c1fce7cdaf8b5a5b463e8b56969145474400c`

- dry intent now uses average daily rain probability;
- dry intent now uses average daily precipitation rather than trip-total precipitation;
- maximum rain probability remains a small bounded severe-day surcharge and still powers explicit max-rain constraints/display;
- the other discovery intents were left unchanged;
- regression tests cover multi-city anti-saturation and duration invariance.

## Root cause 2 — production weather-sync silently used the fake provider

Production diagnostics after the scoring fix showed that the weather input itself was wrong.

Examples before the provider fix, for the same dates/coordinates/timezones:

- Seoul production snapshot: precipitation `33.1 / 42.4 / 24.6 mm`, rain probability `98 / 97 / 94%`;
- direct Open-Meteo: precipitation `0 / 0 / 0 mm`, rain probability `4 / 0 / 0%`;
- Bali production snapshot: precipitation `16.2 / 31.4 / 27.1 mm`;
- direct Open-Meteo: precipitation `0.5 / 0.1 / 0.4 mm`.

The old deployment command used a malformed Wrangler `--var` override, producing an extra runtime variable literally named `WEATHER_PRIMARY_PROVIDER=open-meteo` instead of supplying `env.WEATHER_PRIMARY_PROVIDER`. The Worker then silently fell back to its synthetic `fake` provider and published those forecasts as fresh snapshots.

### Fix

Release: `4edf0903eeae313c45db3f4254468445d18394d9`

- `WEATHER_PRIMARY_PROVIDER = "open-meteo"` is explicitly declared in default, preview and production Wrangler vars;
- weather-sync no longer silently substitutes `fake` when the provider binding is missing/unknown/unsupported;
- `/health` exposes the resolved provider and fails with `503 WEATHER_PROVIDER_MISCONFIGURED` when provider configuration is invalid;
- provider-binding contract tests were added.

Preview deployment logs confirmed the correctly named runtime binding:

`WEATHER_PRIMARY_PROVIDER: "open-meteo"`

## Root cause 3 — immediate post-deploy refresh could hit the previous Worker version

The production Deploy workflow issued the protected `/internal/sync` request roughly 1.5 seconds after deploying weather-sync. During rollout propagation, that request could still reach the previous Worker version.

A delayed incident-verification refresh first required production `/health` to report `provider=open-meteo`, then ran the protected sync.

Delayed refresh result:

- activated snapshot: `2e1b71b4-6262-4d85-8af0-6e12a2986327`;
- Tokyo production vs direct Open-Meteo: zero precipitation/rain-probability difference;
- Seoul production vs direct Open-Meteo: zero precipitation/rain-probability difference;
- Bali production vs direct Open-Meteo: zero precipitation/rain-probability difference.

The same refreshed snapshot produced a healthy 24-city dry-score distribution rather than a collapsed score:

- Seoul: `99`;
- Sapporo: `93`;
- Singapore: `85`;
- Osaka: `71`;
- Tokyo: `18`;
- overall observed range: `16–99`.

## Recurrence prevention

Release: `c4678de250bdc6f281aaa3200a4453eb4ec4580b`

A permanent post-Deploy workflow now:

1. runs only after a successful `Deploy` workflow from a `main` push;
2. polls production weather-sync `/health` until the propagated Worker explicitly reports `provider=open-meteo`;
3. only then runs the protected production refresh;
4. requires the refresh report to activate a snapshot;
5. serializes production post-deploy refreshes with a concurrency group;
6. has a contract test locking the Deploy-success → provider-health → protected-refresh ordering.

The guard PR passed the full repository Preview gate and Phase 5/6/7/8/9 regressions before merge.

## Final state

- production weather data has been refreshed from the real Open-Meteo provider;
- direct provider comparisons for Tokyo, Seoul and Bali matched exactly in the delayed production verification;
- Weather Discovery dry scores no longer collapse to `25` and show a meaningful cross-city distribution;
- fake-provider fallback is fail-closed in production code;
- post-deploy propagation is guarded before weather refresh;
- temporary diagnostic PRs were closed without merge;
- no incident-related PR remains open.
