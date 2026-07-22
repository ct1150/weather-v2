// apps/web — CloudflareAnalytics conditional beacon (PRD-INC-004 / T03).
//
// Second-layer QA: prove the component is ZERO-integration by default and only emits
// the Cloudflare Web Analytics beacon when BOTH the switch is "true" AND a public token
// is present. Because the module reads `process.env` at load time, each case re-imports
// the module after setting the env (vi.resetModules isolates the module instance).
//
// Written as a `.test.ts` (using React.createElement) so it is picked up by the shared
// vitest include and stays compatible with `tsc` typecheck (no JSX in a .ts file).

import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

async function loadAnalytics() {
  vi.resetModules();
  return import("./CloudflareAnalytics.js");
}

describe("CloudflareAnalytics — zero-integration by default", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED;
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;
  });

  it("renders nothing when the analytics switch is off (no script, no token leaked)", async () => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED = "false";
    process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN = "should-not-appear";
    const { CloudflareAnalytics } = await loadAnalytics();
    const html = renderToStaticMarkup(React.createElement(CloudflareAnalytics));
    expect(html).toBe("");
  });

  it("renders nothing when the switch is on but the token is absent", async () => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED = "true";
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;
    const { CloudflareAnalytics } = await loadAnalytics();
    const html = renderToStaticMarkup(React.createElement(CloudflareAnalytics));
    expect(html).toBe("");
  });

  it("emits the beacon script with the public token when enabled + token present", async () => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED = "true";
    process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN = "public-beacon-token-123";
    const { CloudflareAnalytics } = await loadAnalytics();
    const html = renderToStaticMarkup(React.createElement(CloudflareAnalytics));
    expect(html).toContain("static.cloudflareinsights.com/beacon.min.js");
    expect(html).toContain("public-beacon-token-123");
    expect(html).toContain("defer");
  });
});
