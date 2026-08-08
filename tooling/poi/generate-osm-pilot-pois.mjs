#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const cities = [
  { id: "jp-tokyo", bbox: [35.52, 139.55, 35.82, 139.92] },
  { id: "jp-kyoto", bbox: [34.9, 135.6, 35.1, 135.88] },
  { id: "jp-osaka", bbox: [34.55, 135.35, 34.8, 135.65] },
  { id: "kr-seoul", bbox: [37.4, 126.75, 37.7, 127.2] },
  { id: "kr-jeju", bbox: [33.1, 126.15, 33.6, 126.95] },
  { id: "th-bangkok", bbox: [13.55, 100.35, 13.95, 100.75] },
  { id: "th-phuket", bbox: [7.7, 98.25, 8.25, 98.5] },
];

const endpoints = [
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const USER_AGENT = "WhereNotRain-POI-Enrichment/1.0 (+https://868656.xyz)";
const REQUEST_TIMEOUT_MS = 95_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function query([south, west, north, east]) {
  const box = `${south},${west},${north},${east}`;
  return `[out:json][timeout:90];
(
  nwr["tourism"~"^(attraction|museum|gallery|zoo|theme_park|aquarium|viewpoint|artwork)$"](${box});
  nwr["historic"](${box});
  nwr["natural"~"^(beach|peak|waterfall|cave_entrance|cliff)$"](${box});
  nwr["leisure"~"^(park|garden|nature_reserve|marina)$"](${box});
  nwr["amenity"~"^(place_of_worship|marketplace|arts_centre|theatre|library)$"](${box});
  nwr["shop"="mall"](${box});
);
out center tags;`;
}

async function fetchOverpass(statement) {
  let lastError;
  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": USER_AGENT,
            accept: "application/json",
          },
          body: new URLSearchParams({ data: statement }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
          const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
          const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0;
          throw Object.assign(new Error(`${endpoint} ${response.status}`), {
            retryAfterMs,
            status: response.status,
          });
        }
        const payload = await response.json();
        console.log(`Overpass success: ${endpoint}`);
        return payload;
      } catch (error) {
        lastError = error;
        const retryAfterMs =
          typeof error === "object" && error !== null && "retryAfterMs" in error
            ? Number(error.retryAfterMs)
            : 0;
        const delay = Math.max(retryAfterMs, 2_500 * 2 ** (attempt - 1));
        console.warn(
          `Overpass attempt failed: endpoint=${endpoint} attempt=${attempt} error=${
            error instanceof Error ? error.message : String(error)
          }; retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }
  }
  throw lastError ?? new Error("Overpass unavailable");
}

function score(element) {
  const tags = element.tags ?? {};
  let value = 0;
  if (tags.wikipedia) value += 10;
  if (tags.wikidata) value += 8;
  if (tags.tourism) value += 6;
  if (tags.historic) value += 5;
  if (tags.natural) value += 4;
  if (tags.leisure) value += 3;
  if (tags.amenity) value += 2;
  if (tags.website) value += 1;
  return value;
}

function canonicalName(tags) {
  return (
    tags["name:en"] ??
    tags.name ??
    tags["name:zh"] ??
    tags["name:ko"] ??
    tags["name:ja"] ??
    tags["name:th"] ??
    null
  );
}

function environment(tags) {
  const tourism = tags.tourism ?? "";
  if (
    ["museum", "gallery", "aquarium"].includes(tourism) ||
    ["arts_centre", "theatre", "library"].includes(tags.amenity) ||
    tags.shop === "mall"
  )
    return "indoor";
  if (
    tourism === "viewpoint" ||
    ["park", "garden", "nature_reserve", "marina"].includes(tags.leisure) ||
    tags.natural
  )
    return "outdoor";
  if (tags.historic || tags.amenity === "place_of_worship") return "mixed";
  return tourism === "zoo" || tourism === "theme_park" ? "mixed" : "outdoor";
}

function category(tags) {
  if (tags.shop === "mall") return "shopping";
  if (tags.amenity === "marketplace") return "food";
  if (
    ["park", "garden", "nature_reserve", "marina"].includes(tags.leisure) ||
    tags.tourism === "viewpoint" ||
    tags.natural
  )
    return "leisure";
  return "attraction";
}

function duration(tags) {
  if (tags.tourism === "theme_park" || tags.tourism === "zoo") return 240;
  if (
    ["museum", "gallery", "aquarium"].includes(tags.tourism) ||
    ["arts_centre", "theatre", "library"].includes(tags.amenity)
  )
    return 150;
  if (["park", "garden", "nature_reserve"].includes(tags.leisure)) return 120;
  return 90;
}

function reservation(tags) {
  return tags.tourism === "theme_park" || tags.amenity === "theatre" ? "recommended" : "none";
}

function recommendedWindow(tags) {
  if (tags.tourism === "viewpoint") return "evening";
  if (
    ["park", "garden", "nature_reserve"].includes(tags.leisure) ||
    tags.historic ||
    tags.natural
  )
    return "morning";
  if (
    ["museum", "gallery", "aquarium"].includes(tags.tourism) ||
    ["arts_centre", "theatre", "library"].includes(tags.amenity) ||
    tags.shop === "mall"
  )
    return "afternoon";
  return "any";
}

function sensitivities(env) {
  if (env === "indoor") return [];
  if (env === "mixed") return ["rain", "heat", "wind"];
  return ["rain", "heat", "cold", "wind", "uv"];
}

function quote(value) {
  return JSON.stringify(value);
}

const output = [];
for (let cityIndex = 0; cityIndex < cities.length; cityIndex += 1) {
  const city = cities[cityIndex];
  console.log(`Fetching ${city.id}...`);
  const payload = await fetchOverpass(query(city.bbox));
  const seen = new Set();
  const candidates = (payload.elements ?? [])
    .map((element) => {
      const tags = element.tags ?? {};
      const name = canonicalName(tags);
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const normalized = name.trim().toLocaleLowerCase("en-US");
      if (seen.has(normalized)) return null;
      seen.add(normalized);
      return { element, tags, name: name.trim(), lat, lon, score: score(element) };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  console.log(`${city.id}: ${candidates.length} usable named POIs`);
  if (candidates.length < 40) {
    throw new Error(`${city.id} returned only ${candidates.length} usable OSM POIs`);
  }
  for (const candidate of candidates.slice(0, 50)) {
    const { element, tags, name, lat, lon } = candidate;
    const env = environment(tags);
    const nameEn = tags["name:en"] ?? name;
    const nameZh = tags["name:zh"] ?? tags["name:zh-Hans"] ?? nameEn;
    const nameHant =
      tags["name:zh-Hant"] ?? tags["name:zh-TW"] ?? tags["name:zh"] ?? nameEn;
    output.push({
      id: `osm-${city.id}-${element.type}-${element.id}`,
      cityId: city.id,
      name: { en: nameEn, "zh-cn": nameZh, "zh-hant": nameHant },
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      category: category(tags),
      environment: env,
      weatherSensitivity: sensitivities(env),
      typicalDurationMinutes: duration(tags),
      reservation: reservation(tags),
      recommendedWindow: recommendedWindow(tags),
      provenance: "openstreetmap-v1",
      sourceRef: `${element.type}/${element.id}`,
    });
  }
  if (cityIndex < cities.length - 1) await sleep(2_500);
}

const lines = [
  "// Generated from OpenStreetMap via tooling/poi/generate-osm-pilot-pois.mjs.",
  "// Source data © OpenStreetMap contributors, ODbL 1.0.",
  'import type { CuratedPoi } from "./poi-catalog";',
  "",
  "export const OSM_PILOT_POIS: ReadonlyArray<CuratedPoi> = [",
];
for (const item of output) {
  lines.push("  {");
  lines.push(`    id: ${quote(item.id)},`);
  lines.push(`    cityId: ${quote(item.cityId)},`);
  lines.push(`    name: ${quote(item.name)},`);
  lines.push(`    latitude: ${item.latitude},`);
  lines.push(`    longitude: ${item.longitude},`);
  lines.push(`    category: ${quote(item.category)},`);
  lines.push(`    environment: ${quote(item.environment)},`);
  lines.push(`    weatherSensitivity: ${quote(item.weatherSensitivity)},`);
  lines.push(`    typicalDurationMinutes: ${item.typicalDurationMinutes},`);
  lines.push(`    reservation: ${quote(item.reservation)},`);
  lines.push(`    recommendedWindow: ${quote(item.recommendedWindow)},`);
  lines.push(`    provenance: ${quote(item.provenance)},`);
  lines.push(`    sourceRef: ${quote(item.sourceRef)},`);
  lines.push("  },");
}
lines.push("];", "");

await writeFile(
  "apps/web/src/trips/poi-catalog-osm.generated.ts",
  `${lines.join("\n")}\n`,
  "utf8",
);
console.log(`Generated ${output.length} OSM POIs.`);
