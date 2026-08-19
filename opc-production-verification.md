# OPC production release verification

- Target main SHA: `9f2bb09253d6469ff1504473799029448181f60a`
- Deploy run: 32210090737
- Deploy conclusion: success
- Deploy URL: https://github.com/ct1150/weather-v2/actions/runs/32210090737
- Production Smoke run: 32210273572
- Production Smoke conclusion: success
- Production Smoke URL: https://github.com/ct1150/weather-v2/actions/runs/32210273572
- Localized homepage and discovery checks: see-errors
- Trip API and Weather Read health checks: see-errors
- Overall: failure

## Errors

- English discovery missing expected text: Top 3 least-rain destinations
- Simplified discovery missing expected text: 最少雨的 3 个目的地
- Traditional discovery missing expected text: 最少雨的 3 個目的地
