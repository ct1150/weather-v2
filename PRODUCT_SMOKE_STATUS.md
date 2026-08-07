# Production product smoke status

- Conclusion: failure
- Deploy head SHA: 2a035895326682830f11b8699667fde8cdcaf463
- Deploy run: https://github.com/ct1150/weather-v2/actions/runs/31154970804
- Verified at: 2026-08-07T07:05:59Z

## Checks

- English landing: success
- English import route: success
- English workspace route: success
- English country direct trip action: success
- Traditional landing: success
- Traditional import route: success
- Traditional workspace route: success
- Traditional weather radar: success
- Traditional country weather route: failure (missing: /zh-hant/trips/workspace)
- Traditional city weather route: success
- Simplified landing: success
- Simplified import route: success
- Simplified country weather route: failure (missing: /zh-cn/trips/workspace)
- Simplified city weather route: success
- English city-to-trip bridge: success
- Trip cities API: success
- Protected sync health: success
- Anonymous sync rejected: success
- Trip forecast API: success
