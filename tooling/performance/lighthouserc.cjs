// tooling/performance/lighthouserc.cjs
//
// Lighthouse CI configuration for the FIRST performance-layer gate (ENG-PERF-001).
//
// - Five representative pages (homepage, country, city, ranking, search shell).
// - Exactly 3 runs each, mobile emulation, 4x CPU slowdown, 1.6 Mbps
//   downlink, 750 Kbps uplink, 150 ms RTT.
// - The gate uses each page's MEDIAN of the three runs.
// - Every representative page must independently meet Performance >= 95,
//   SEO = 100, Accessibility = 100, Best Practices = 100.
//
// Aultion-ONLY mode: no `upload.target` is set, so no CI token or
// network upload is required. Lighthouse CI must be installed
// (`pnpm add -D @lhci/cli`) and a production build output served from
// `staticDistDir` (or via `startServerCommand`) before `lhci autorun`
// can collect in this environment.

module.exports = {
  ci: {
    collect: {
      // The production web build output. Populate this via the real Next.js
      // build (e.g. `pnpm --filter @wnr/web build` producing `dist`/`out`).
      staticDistDir: "apps/web/dist",
      url: [
        "http://localhost:4173/",
        "http://localhost:4173/japan",
        "http://localhost:4173/japan/tokyo",
        "http://localhost:4173/ranking/weekend",
        "http://localhost:4173/explore",
      ],
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        throttlingMethod: "simulate",
        throttling: {
          cpuSlowdownMultiplier: 4,
          downloadThroughputKbps: 1600,
          uploadThroughputKbps: 750,
          requestLatencyMs: 150,
        },
        screenEmulation: {
          width: 360,
          height: 640,
          deviceScaleFactor: 2,
          mobile: true,
          disabled: false,
        },
        emulatedUserAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
    },
    assert: {
      // One page below any threshold blocks release (assertion level "error").
      assertions: {
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 1 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
      },
    },
    // No upload target: assertion-only mode, no CI token / network required.
  },
};
