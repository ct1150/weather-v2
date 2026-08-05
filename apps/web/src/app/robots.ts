// apps/web/src/app/robots.ts
//
// Static-export robots (SEO-INDEXABILITY-001). Advertises the generated
// sitemap and blocks non-discovery surfaces. Next emits this as
// `out/robots.txt` during `next build` (static export compatible).

import type { MetadataRoute } from "next";
import { PRIMARY_SITE_URL } from "./seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${PRIMARY_SITE_URL}/sitemap.xml`,
    host: PRIMARY_SITE_URL,
  };
}
