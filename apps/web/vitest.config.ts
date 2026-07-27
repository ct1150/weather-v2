import { mergeConfig } from "vitest/config";
import { baseVitestConfig } from "@wnr/vitest-config";

// The page components are authored with the automatic JSX runtime (like Next.js),
// so they do NOT import `React` into scope. Vitest's default esbuild transform uses
// the classic runtime (`React.createElement`), which throws "React is not defined"
// when these modules load in tests. Align the test transform with the app runtime.
//
// We also pick up `.tsx` test files (the interactive-map test renders a client
// component with @testing-library/react under the jsdom environment).
export default mergeConfig(baseVitestConfig, {
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
