// apps/web/src/app/robots.ts
//
// Static-export robots (SEO-INDEXABILITY-001). Advertises the generated
// sitemap and blocks non-discovery surfaces. Next emits this as
// `out/robots.txt` during `next build` (static export compatible).

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://where-not-rain.pages.dev/sitemap.xml",
    host: "https://where-not-rain.pages.dev",
  };
}
