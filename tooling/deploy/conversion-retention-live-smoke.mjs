#!/usr/bin/env node

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "site-url": { type: "string" },
  },
});

const siteUrl = values["site-url"]?.replace(/\/$/u, "");
if (!siteUrl) {
  console.error("PHASE9-LIVE-SMOKE: --site-url is required");
  process.exit(1);
}

const routes = [
  "/discover",
  "/zh-cn/discover",
  "/zh-hant/discover",
  "/trips/workspace",
  "/zh-cn/trips/workspace",
  "/zh-hant/trips/workspace",
];

const googlebotHeaders = {
  "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};

async function verifyCrawlerFile(path, expectedContentType, expectedText) {
  const response = await fetch(`${siteUrl}${path}`, {
    redirect: "follow",
    headers: googlebotHeaders,
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status} to Googlebot`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes(expectedContentType)) {
    throw new Error(`${path} returned unexpected content-type: ${contentType || "missing"}`);
  }
  if (!body.includes(expectedText)) {
    throw new Error(`${path} missing expected crawler content: ${expectedText}`);
  }
  if (/captcha|challenge-platform|cf-chl-/iu.test(body)) {
    throw new Error(`${path} returned a Cloudflare challenge page to Googlebot`);
  }
}

try {
  await verifyCrawlerFile("/robots.txt", "text/plain", `Sitemap: ${siteUrl}/sitemap.xml`);
  await verifyCrawlerFile("/sitemap.xml", "xml", "<urlset");

  for (const route of routes) {
    const response = await fetch(`${siteUrl}${route}`, { redirect: "follow" });
    const html = await response.text();
    if (!response.ok) {
      throw new Error(`${route} returned ${response.status}`);
    }
    if (html.includes('data-contextual-commerce="phase-9"')) {
      throw new Error(
        `${route} rendered a commercial surface without deployment offer configuration`,
      );
    }
    if (html.includes("travel.example") || html.includes("tokyo-hotel-offer")) {
      throw new Error(`${route} leaked test-only affiliate data into a deployed artifact`);
    }
  }

  console.log(
    `PHASE9-LIVE-SMOKE: OK — robots/sitemap are Googlebot-readable and ${routes.length} decision routes are reachable with zero unconfigured commercial UI`,
  );
} catch (error) {
  console.error(`PHASE9-LIVE-SMOKE: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
