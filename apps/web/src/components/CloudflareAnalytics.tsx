// apps/web/src/components/CloudflareAnalytics.tsx
//
// Conditional Cloudflare Web Analytics beacon (PRD-INC-004).
//
// Zero-integration by default: when the switch is off OR the token is absent this
// renders nothing, so no script (and no token) ever reaches the static export or the
// client bundle. The token is a PUBLIC beacon token (not a secret) — it is injected at
// build time via the `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` Pages env var and frozen
// into the static HTML (DEP-CONFIG-001).

import type { ReactNode } from "react";

const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED === "true";
const ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;

/**
 * Render the Cloudflare Web Analytics beacon, or `null` when disabled.
 * Disabled => no DOM output, no network request, no token in the build.
 */
export function CloudflareAnalytics(): ReactNode {
  if (!ANALYTICS_ENABLED || !ANALYTICS_TOKEN) {
    return null;
  }
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: ANALYTICS_TOKEN })}
    />
  );
}

export default CloudflareAnalytics;
