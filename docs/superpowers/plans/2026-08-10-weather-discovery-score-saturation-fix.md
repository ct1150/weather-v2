# Weather Discovery dry-score saturation fix

Date: 2026-08-10
Status: Acceptance in progress

## User-visible defect

Weather Discovery could show many destination cities with the same intent score of `25` when using the default `dry` / “哪里不下雨” intent across a multi-day date range.

## Root cause

The dry-intent model used:

- maximum rain probability anywhere in the selected range; plus
- total precipitation accumulated across the whole selected range.

Both penalties had hard caps. A city with one peak-rain day plus enough accumulated precipitation could therefore hit the same saturated penalty as a much wetter city. Longer date ranges also accumulated more precipitation and reduced the absolute score even when the daily weather profile was unchanged.

## Fix

- score the dry intent primarily with average daily rain probability;
- use average daily precipitation rather than trip-total precipitation;
- retain maximum rain probability as a small bounded severe-day surcharge;
- retain maximum rain probability for explicit user constraints and peak-rain display;
- leave the other six discovery intent formulas unchanged.

## Regression coverage

- two cities that share a 100% peak-rain day but have materially different multi-day wetness must receive different scores and must not both collapse to `25`;
- repeating the same daily weather over a longer range must not change the dry-intent score solely because precipitation is accumulated over more days;
- existing dry-vs-rainy, constraints, limited-data, ranking, serialization and other intent tests remain covered.

## Focused gate

The one-time formatter workflow ran the focused `weather-discovery.test.ts` suite successfully before committing the formatted implementation. The helper workflow removed itself afterwards.

## Final gate

This normal-user commit is the acceptance head. Full repository Deploy and the dedicated Weather Discovery Preview regression must pass before merge.
