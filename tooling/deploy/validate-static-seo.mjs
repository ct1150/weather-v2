#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const outDir = resolve(repoRoot, "apps/web/out");

function readRequired(relativePath) {
  const path = resolve(outDir, relativePath);
  const stat = statSync(path);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`${relativePath} is missing or empty in static export`);
  }
  return readFileSync(path, "utf8");
}

try {
  const sitemap = readRequired("sitemap.xml");
  if (!sitemap.includes("<urlset") || !sitemap.includes("https://868656.xyz/")) {
    throw new Error("sitemap.xml does not contain a valid URL set for the production host");
  }

  const robots = readRequired("robots.txt");
  if (
    !robots.includes("User-agent: *") ||
    !robots.includes("Sitemap: https://868656.xyz/sitemap.xml")
  ) {
    throw new Error("robots.txt does not advertise the production sitemap");
  }

  const headers = readRequired("_headers");
  if (!headers.includes("/sitemap.xml") || !headers.includes("Content-Type: application/xml")) {
    throw new Error("_headers does not force an XML content type for sitemap.xml");
  }

  console.log("STATIC-SEO: OK — sitemap.xml, robots.txt and crawler headers are present");
} catch (error) {
  console.error(`STATIC-SEO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
