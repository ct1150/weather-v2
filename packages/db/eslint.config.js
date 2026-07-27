// ESLint flat config for @wnr/db.
//
// Why this file exists
//   The shared preset in `@wnr/eslint-config` declares NO `languageOptions.globals`
//   (only `ecmaVersion: 2022` / `sourceType: "module"`). For the workspace's
//   TypeScript sources that is fine: the TypeScript parser resolves Node globals
//   (`process`, `console`, `__dirname`, ...) automatically. However `packages/db`
//   also ships `seeds/verify-seed.mjs`, a standalone `node --test` QA gate
//   (DATA-GEOGRAPHY-001) parsed by Espree — there `process`/`console` trip
//   `no-undef` because no Node globals are declared.
//
//   Rather than mutate the shared preset (wider blast radius), this package-level
//   flat config re-exports the shared preset verbatim and layers ONE scoping block
//   that declares `globals.node` for `.mjs` files only. The `files` pattern
//   guarantees the existing `.ts`/`.tsx` lint behavior — which already passes — is
//   completely unchanged.
//
//   This file REPLACES the root `eslint.config.js` for everything under
//   `packages/db/` (ESLint v9 flat-config resolution starts from the lint cwd and
//   stops here), so we must spread the shared preset first to keep all rules
//   (js.recommended, tseslint.recommended, boundaries/, ignores) intact.
//
// Reproduction / verification
//   `pnpm --filter @wnr/db lint`           -> exit 0 (was 8 `no-undef` errors)
//   `pnpm -r lint` (other packages)         -> unchanged (they use root config)

import baseConfig from "@wnr/eslint-config";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    // Scope is intentional: only Node-host `.mjs` test/script files. TypeScript
    // sources (`src/**/*.ts`) keep the default language options — the TS parser
    // already makes Node globals available, and we must not alter that path.
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
