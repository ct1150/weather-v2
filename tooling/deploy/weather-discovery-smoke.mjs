#!/usr/bin/env node

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "site-url": { type: "string" },
    "read-url": { type: "string" },
  },
});

const siteUrl = values["site-url"]?.replace(/\/$/u, "");
const readUrl = values["read-url"]?.replace(/\/$/u, "");
if (!siteUrl || !readUrl) {
  console.error("PHASE6-SMOKE: --site-url and --read-url are required");
  process.exit(1);
}

async function fetchText(url, expected = 200) {
  const response = await fetch(url, { redirect: "follow" });
  const text = await response.text();
  if (response.status !== expected) {
    throw new Error(
      `${url} returned ${response.status}, expected ${expected}: ${text.slice(0, 300)}`,
    );
  }
  return text;
}

async function fetchJson(url, expected = 200) {
  const text = await fetchText(url, expected);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${url} did not return JSON`);
  }
}

function requireText(body, value, label) {
  if (!body.includes(value)) throw new Error(`${label} missing ${JSON.stringify(value)}`);
}

function addDays(date, amount) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

try {
  const english = await fetchText(`${siteUrl}/discover`);
  requireText(english, "Weather Discovery", "English discovery route");
  const simplified = await fetchText(`${siteUrl}/zh-cn/discover`);
  requireText(simplified, "天气探索", "Simplified discovery route");
  const traditional = await fetchText(`${siteUrl}/zh-hant/discover`);
  requireText(traditional, "天氣探索", "Traditional discovery route");

  const citiesPayload = await fetchJson(`${readUrl}/api/v1/trip-cities?locale=en`);
  const cities = citiesPayload?.data?.items;
  if (!Array.isArray(cities) || cities.length < 13) {
    throw new Error(
      `Expected at least 13 discovery cities, received ${Array.isArray(cities) ? cities.length : "invalid"}`,
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const to = addDays(today, 2);
  const batches = [cities.slice(0, 12), cities.slice(12, 24)];
  let snapshotId = null;
  let itemCount = 0;
  for (const batch of batches) {
    const params = new URLSearchParams({
      cityIds: batch.map((city) => city.cityId).join(","),
      from: today,
      to,
      locale: "en",
    });
    const payload = await fetchJson(`${readUrl}/api/v1/trip-forecast?${params.toString()}`);
    const currentSnapshot = payload?.data?.snapshotId;
    const items = payload?.data?.items;
    if (typeof currentSnapshot !== "string" || !Array.isArray(items)) {
      throw new Error("Trip forecast response missing snapshotId/items");
    }
    if (snapshotId !== null && snapshotId !== currentSnapshot) {
      throw new Error(`Discovery batches crossed snapshots: ${snapshotId} -> ${currentSnapshot}`);
    }
    snapshotId = currentSnapshot;
    itemCount += items.length;
  }
  if (itemCount === 0) throw new Error("Discovery forecast returned no daily items");

  const invalidTo = addDays(today, 16);
  const invalid = new URLSearchParams({
    cityIds: cities[0].cityId,
    from: today,
    to: invalidTo,
    locale: "en",
  });
  await fetchText(`${readUrl}/api/v1/trip-forecast?${invalid.toString()}`, 400);

  console.log(
    `PHASE6-SMOKE: OK — routes=3 cities=${cities.length} forecastItems=${itemCount} snapshot=${snapshotId}`,
  );
} catch (error) {
  console.error(`PHASE6-SMOKE: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
