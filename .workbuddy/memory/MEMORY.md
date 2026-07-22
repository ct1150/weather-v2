# Project Memory — where-not-rain (WNR)

## Verification in this sandbox (WSL + Windows shell)
- Run pnpm/node via `wsl -d Ubuntu24 -- bash -lc "cd /root/test/weather && <CMD>"`.
- The Windows shell mangles complex quoting inside `bash -lc '...'`. For faithful re-runs of Kiro `Verify:` commands that contain `$(...)`, nested quotes, or `cat` of `.artifacts/*`, use a HEREDOC instead:
  `wsl -d Ubuntu24 bash <<'WSL_EOF' ... WSL_EOF` (quoted delimiter => no Windows-side expansion).
- Capture real exit codes with `trap 'echo X_FINAL_EXIT=$?' EXIT`. The `wsl: Failed to translate ... safe-bin` stderr line is benign noise, not a failure.
- Never trust Engineer self-reports: independently re-run each task's exact `Verify:` and prove exit 0 + weather.txt SHA-256 MATCH (70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d).

## Infra limitations
- Headless Chrome cannot launch in this sandbox -> `pnpm exec lhci autorun` is infra-blocked (ECONNREFUSED 127.0.0.1:37183, "Unable to connect to Chrome"). lighthouserc.cjs config itself is valid. Run the gate logic via `node --test tooling/performance/performance-gates.test.mjs` + `node tooling/performance/evaluate-rum-gate.mjs --window-days 28` instead.

## Status (2026-07-21)
- Full MVP (24 Kiro tasks, phases A-D) independently re-verified and APPROVED. weather.txt immutable & MATCH. `pnpm -r test` + `pnpm -r build` exit 0.
