/**
 * Next.js configuration for the Where Not Rain web app.
 *
 * Deployment strategy this phase: STATIC EXPORT (output: "export") to
 * Cloudflare Pages via `wrangler pages deploy out --project-name where-not-rain`.
 *
 * Why static export (docs/08 DEP-PAGES-001 + system_design.md §1.2):
 *   - The app has no request-time runtime, no D1/KV, no route handlers, and no
 *     SSR/ISR. Pages are pure Server Components fed by a build-time baked dataset.
 * - Env vars (APP_ENV, DEFAULT_LOCALE, ...) are injected at `next build` time and
 *   frozen into the static HTML; they are NOT runtime `wrangler pages deploy --var`
 *   bindings (that path is for Pages Functions, which this phase does not use).
 *
 * Free-plan-safe (DEP-FREE-001): zero D1/KV/Cron/Workers cost, no external calls.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Emit a fully static site into `apps/web/out/`.
  output: "export",

  // Static export cannot optimize images at request time.
  images: { unoptimized: true },

  // We run the consolidated lint/typecheck gates separately in CI; do not let an
  // ESLint config discovery hiccup block the production build.
  eslint: { ignoreDuringBuilds: true },

  // Workspace packages are pre-built to dist (ESM). Bundle them explicitly so the
  // static export is self-contained and network-free.
  transpilePackages: ["@wnr/weather", "@wnr/domain"],
};

export default nextConfig;
