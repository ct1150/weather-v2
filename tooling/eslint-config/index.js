import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

/**
 * Shared flat ESLint config preset for all workspace packages.
 *
 * Import-boundary rules (eslint-plugin-boundaries) enforce the acyclic layer
 * policy from design.md / ARCH-LAYERS-001 and the "browser/read code must not
 * import provider adapters" rule. Element types are identified by file path; the
 * `default: "disallow"` policy plus explicit allow lists make forbidden
 * dependency directions compile-/lint-time failures.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      // Honor the `_`-prefixed identifier convention for intentionally-unused
      // params/vars (e.g. port stubs in tests) without disabling the rule.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    plugins: { boundaries },
    settings: {
      // eslint-plugin-boundaries v5 expects a flat "boundaries/elements" slash-key
      // (NOT a nested `boundaries: { elements }` object) in the ESLint settings.
      "boundaries/elements": [
        // The sync-only weather provider adapter: importable ONLY by workers/weather-sync.
        // mode:"file" is required because the pattern targets a single file, not a folder;
        // and it MUST be listed before "package" so this file is classified as
        // "provider-adapter" (the first matching descriptor wins for an element's type).
        { type: "provider-adapter", mode: "file", pattern: "**/packages/weather/src/provider.ts" },
        { type: "app", pattern: "**/apps/**/src/**" },
        { type: "worker", pattern: "**/workers/**/src/**" },
        { type: "package", pattern: "**/packages/**/src/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          message: "${file.type} may not import ${dependency.type} (${dependency.file})",
          rules: [
            // apps/web depends on domain/db/ui/i18n/seo/config/analytics, never on @wnr/weather.
            { from: "app", allow: ["app", "package"] },
            // workers/weather-sync is the ONLY code path allowed to import provider adapters.
            { from: "worker", allow: ["worker", "package", "provider-adapter"] },
            // packages depend only on other packages; @wnr/weather depends only on domain.
            { from: "package", allow: ["package"] },
            // the provider adapter may import domain types (a package).
            { from: "provider-adapter", allow: ["package"] },
          ],
        },
      ],
    },
  },
  {
    ignores: ["**/dist/**", "node_modules/**", ".next/**"],
  },
];
