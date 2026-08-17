# Weather V2 — Low-frequency CI/CD policy

Date: 2026-08-16
Status: Implemented on PR #45

## Goal

Reduce GitHub-hosted runner usage and Cloudflare preview churn without weakening production release safety.

## Previous behavior

A normal pull-request synchronization could fan out into multiple workflows:

- `Deploy` on every PR update;
- preview D1 migrations;
- preview Worker deployments;
- preview Pages deployment;
- Phase 5/6/7/8/9 preview smoke workflows;
- repeated installs/builds across separate runners.

A single development commit could therefore allocate several runners and redeploy preview infrastructure even while the PR was still Draft.

`refresh-weather.yml` also rebuilt and redeployed the static Pages site every six hours, creating roughly 120 scheduled runs per month before any development activity was counted.

## New workflow set

The repository is intentionally reduced to four workflows:

1. `PR CI`
2. `Deploy`
3. `Production Smoke`
4. `Refresh weather pages`

### PR CI

Trigger:

```text
pull_request: opened | reopened | ready_for_review | synchronize
```

Job guard:

```text
PR draft == false
```

Behavior:

- Draft PR updates create no hosted-runner work;
- marking a PR Ready runs one consolidated validation job;
- later updates to a non-Draft PR re-run that single job;
- no D1 migration, Worker deploy, Pages deploy, or live preview smoke occurs from normal PR synchronization.

PR CI includes install, format, lint, library builds, typecheck, unit/integration tests, docs gate, static web build, Worker builds, deploy pipeline contract tests and secret scanning.

### Deploy

Automatic trigger:

```text
push -> main
```

`workflow_dispatch` remains as an explicit emergency/manual production release path, but the job itself is guarded by:

```text
github.ref == refs/heads/main
```

A manually selected feature branch therefore cannot deploy production.

There is no `pull_request` trigger.

The workflow keeps production safety gates before deployment, then deploys weather D1/seed, weather-sync, the fresh weather snapshot, weather-read, Trip D1, trip-api, Better Auth schema and Cloudflare Pages, followed by IndexNow and a basic production weather smoke.

### Production Smoke

Runs after a successful `Deploy` from main, including a manual main Deploy. Manual Production Smoke dispatch is also restricted to main.

One runner now performs all broad production verification that previously required several workflows:

- broad EN / zh-CN / zh-Hant Trip, Workspace, Execution, Share and weather-route page checks;
- Trip Cities, Trip Forecast, Cloud Trip health and protected sync API checks;
- anonymous Cloud Trip/sync rejection checks;
- Phase 5 weather intelligence;
- Phase 6 Weather Discovery;
- Phase 7 structured activity intelligence;
- Phase 8 hourly weather;
- Phase 8 adaptive replanning;
- collaboration/revision contracts;
- localized invite surfaces;
- Phase 9 trust contracts;
- Phase 9 production zero-fill.

The former separate `Verify trip product production` runner is removed; its end-user page/API coverage is incorporated into this consolidated workflow.

### Refresh weather pages

The static/SEO weather page rebuild changes from every six hours to once per day:

```text
old: 17 */6 * * *   (~120 runs/month)
new: 17 2 * * *     (~30 runs/month)
```

Runtime weather freshness still comes from weather-sync/weather-read. Scheduled and manually triggered refreshes always checkout `main`; manual refresh is rejected at job level when invoked from any non-main ref.

## Removed workflows

The automatic Preview/report fan-out workflows were removed, including refresh-after-deploy, deploy/Phase reporters, separate Phase 5/6/7/8/9 verifiers, collaboration verifier, hourly verifier and the standalone Trip Product production verifier.

## Expected runner behavior

During active development:

```text
feature commit -> Draft PR -> PR CI skipped -> 0 hosted runner jobs
```

Before merge:

```text
mark Ready -> 1 PR CI runner
```

After merge:

```text
main push -> 1 Deploy runner
          -> 1 consolidated Production Smoke runner
```

Scheduled static weather publishing is reduced to one runner per day.

## Verified behavior on PR #45

Commits made after this policy was introduced produced only one `PR CI` workflow run. Because PR #45 remained Draft, the `verify` job concluded `skipped` with no steps and no hosted-runner execution. The previous seven-workflow pull-request fan-out did not occur.

## Billing caveat

This refactor prevents future unnecessary Actions consumption but does not clear the current GitHub Billing/Actions lock. The account must still resolve the existing payment/spending-limit condition before any non-skipped hosted runner can start.

## Release policy

1. Keep feature work Draft while implementation is in progress.
2. Mark Ready only when the change set is ready for consolidated validation.
3. Merge only after PR CI succeeds.
4. Production deployment happens automatically from `main` only.
5. Production Smoke executes only after successful main Deploy.
6. Manual Deploy, Smoke and weather refresh operations are allowed only from `main`.
