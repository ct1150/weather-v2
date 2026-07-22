import baseConfig from "@wnr/eslint-config";

/**
 * ESLint flat config for the web app. Extends the shared preset (which enforces
 * the acyclic layer policy / import boundaries from ARCH-LAYERS-001). The build
 * layer imports `@wnr/weather` only via the compiled package entry
 * (`packages/weather/dist/*`), never `packages/weather/src/provider.ts`, so it is
 * classified as an untyped (non-provider-adapter) dependency and remains allowed.
 */
export default [...baseConfig];
