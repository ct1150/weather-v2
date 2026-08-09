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

try {
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
    `PHASE9-LIVE-SMOKE: OK — ${routes.length} decision routes reachable with zero unconfigured commercial UI`,
  );
} catch (error) {
  console.error(`PHASE9-LIVE-SMOKE: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
