import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const NODE_SQLITE_SHIM = fileURLToPath(new URL("./node-sqlite-shim.mjs", import.meta.url));

/**
 * Shared Vitest preset. Packages extend this via `mergeConfig` and add
 * their own include globs. Property tests use fast-check with a minimum of
 * 100 iterations (see design testing strategy).
 *
 * @type {import("vitest/config").UserConfig}
 */
export const baseVitestConfig = defineConfig({
  // `node:sqlite` is a Node built-in that ships behind a newer module id. Vitest's SSR
  // module runner strips the `node:` prefix and tries to load `sqlite` as a URL, which fails.
  // Redirect the import to a local shim that loads the built-in via `require("node:sqlite")`
  // (native Node resolution Vite never inspects), so the test fakes work on every package.
  plugins: [
    {
      name: "wnr-redirect-node-sqlite",
      enforce: "pre",
      resolveId(source) {
        if (source === "node:sqlite" || source === "sqlite") {
          return NODE_SQLITE_SHIM;
        }
        return null;
      },
    },
  ],
  optimizeDeps: {
    exclude: ["node:sqlite"],
  },
  ssr: {
    external: ["node:sqlite"],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    passWithNoTests: true,
    server: {
      deps: {
        external: ["node:sqlite"],
      },
    },
  },
});

export default baseVitestConfig;
