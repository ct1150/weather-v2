# OPC Phase 1 — static origin and reachability

Date: 2026-08-19  
Status: Implemented

## Goal

Answer a narrower and more useful question:

> From a supported starting hub, which destinations are reachable within the user's travel-time limit and least likely to rain on the selected dates?

## Initial coverage

Starting hubs:

- Singapore;
- Hong Kong;
- Taipei.

Transport modes are exposed only when a maintained edge exists. Singapore currently supports flight and drive estimates; Hong Kong and Taipei currently expose flight estimates. Rail remains in the domain vocabulary but is not shown until the destination dataset contains a useful supported rail network.

## Data contract

The reachability dataset is static, type-checked and versioned with the application. Every edge contains:

```text
origin
→ destination
→ transport mode
→ conservative typical planning minutes
→ verified date
```

Flight estimates include a basic airport allowance. Drive estimates include a simple border / rest allowance. They are not live schedules, fares, availability or guarantees.

## Ranking contract

```text
reachability filter
→ weather hard limits
→ dry score
→ forecast confidence
→ travel time tie-break
```

Travel time never changes the dry score and never moves a worse-weather destination ahead of a better-weather destination.

## URL contract

The finder serializes:

```text
origin
mode
maxTravel
from
to
weather limits
shortlist
```

Old links without reachability state normalize to Singapore, any supported mode and six hours.

## OPC guardrails

- no runtime transport provider;
- no live schedule or price API;
- no new Worker or database;
- no change to Weather Provider boundaries;
- forecasts are requested only for eligible cities, reducing read traffic;
- unsupported combinations fail closed with a clear no-result state.
