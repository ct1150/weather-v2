# Production product smoke status

- Conclusion: failure
- Deploy head SHA: 693bb29f150551f617953e15eb66ff61ca82fb4b
- Deploy run: https://github.com/ct1150/weather-v2/actions/runs/31147679291
- Verified at: 2026-08-07T04:36:00Z

## Checks

- English landing: success
- English workspace route: success
- Traditional landing: success
- Traditional workspace route: success
- Traditional weather radar: success
- Traditional country weather route: success
- Traditional city weather route: failure (missing: 加入我的行程)
- Simplified legacy route: success
- Simplified city weather route: failure (missing: 加入我的行程)
- English city-to-trip bridge: failure (request)
- Trip cities API: success
- Protected sync health: success
- Anonymous sync rejected: success
- Trip forecast API: success
