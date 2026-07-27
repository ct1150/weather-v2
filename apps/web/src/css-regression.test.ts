import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { test, expect, afterAll } from "vitest";

// Regression gate for the "entire site rendered with no styles" incident.
//
// That bug happened because apps/web never wired Tailwind into the build:
// there were no tailwindcss/postcss/autoprefixer deps, no tailwind.config.ts /
// postcss.config.mjs, and globals.css had no @tailwind directives. The deployed
// CSS was a 222-byte bare reset and every semantic utility class
// (text-foreground, bg-surface-elevated, rounded-pill, focus-ring, ...) was
// missing, so the whole site shipped as naked text.
//
// This test performs a REAL Tailwind compilation of globals.css through the
// project's tailwind.config.ts and asserts that the semantic utility classes
// are actually emitted into the CSS. If the Tailwind link breaks again
// (missing deps, missing config, missing @tailwind directives, broken preset
// resolution), this test goes red instead of letting bare text reach prod.
//
// We deliberately do NOT run a full next build (too slow). Compiling
// globals.css with the Tailwind CLI is sufficient to prove the semantic
// classes can be generated.

const CSS_IN = "./src/app/globals.css";
const CSS_OUT = "/tmp/wnr_css_regression_out.css";
const TAILWIND_CONFIG = "./tailwind.config.ts";

// Primary semantic classes dropped by the original bug. All must be present.
const PRIMARY_CLASSES = [
  ".text-foreground",
  ".text-muted",
  ".text-primary",
  ".border-border",
  ".bg-surface",
  ".bg-surface-elevated",
  ".rounded-pill",
  ".focus-ring",
];

// Secondary semantic classes that should also be compiled.
const SECONDARY_CLASSES = [
  ".text-body",
  ".text-caption",
  ".text-label",
  ".text-heading-3",
  ".text-danger",
  ".text-warning",
];

// Compile globals.css with the real Tailwind CLI. Try the common entry points
// so the test is resilient to how tailwindcss is exposed in this workspace.
function compileTailwind() {
  const base = " -i " + CSS_IN + " -o " + CSS_OUT + " -c " + TAILWIND_CONFIG;
  const attempts = [
    "pnpm exec tailwindcss" + base,
    "npx tailwindcss" + base,
    "node node_modules/tailwindcss/lib/cli.js" + base,
  ];
  let lastError;
  for (const cmd of attempts) {
    try {
      execSync(cmd, { cwd: process.cwd(), stdio: "pipe" });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    "Tailwind CLI failed to compile globals.css via all entry points: " + String(lastError),
  );
}

// Match a class selector as a real token, not as a prefix of a longer class
// (e.g. .text-body must not match .text-body-small). We check the class is
// immediately followed by a selector boundary character.
function cssHasClass(css, cls) {
  const markers = [" {", ",", ":", " ", "\n", ">", "{"];
  for (const marker of markers) {
    if (css.includes(cls + marker)) {
      return true;
    }
  }
  return false;
}

test("tailwind compiles semantic utility classes into the CSS bundle", () => {
  if (existsSync(CSS_OUT)) {
    unlinkSync(CSS_OUT);
  }

  compileTailwind();

  expect(existsSync(CSS_OUT)).toBe(true);
  const css = readFileSync(CSS_OUT, "utf8");

  // Volume guard: a broken link would emit only the bare reset (the original
  // incident shipped a 222-byte reset-only CSS). The real compiled bundle is
  // far larger, so assert a comfortable lower bound.
  expect(css.length).toBeGreaterThan(1000);

  for (const cls of PRIMARY_CLASSES) {
    expect(cssHasClass(css, cls), "primary semantic class missing from compiled CSS: " + cls).toBe(
      true,
    );
  }

  for (const cls of SECONDARY_CLASSES) {
    expect(
      cssHasClass(css, cls),
      "secondary semantic class missing from compiled CSS: " + cls,
    ).toBe(true);
  }
});

afterAll(() => {
  if (existsSync(CSS_OUT)) {
    try {
      unlinkSync(CSS_OUT);
    } catch {
      // best-effort cleanup; ignore
    }
  }
});
