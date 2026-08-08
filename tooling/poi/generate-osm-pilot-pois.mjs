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
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function query([south, west, north, east]) {
  const box = `${south},${west},${north},${east}`;
  return `[out:json][timeout:90];
(
  nwr["tourism"~"^(attraction|museum|gallery|zoo|theme_park|aquarium|viewpoint)$"](${box});
  nwr["historic"](${box});
  nwr["leisure"~"^(park|garden)$"](${box});
  nwr["amenity"~"^(place_of_worship|marketplace|arts_centre)$"](${box});
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
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: statement }),
        });
        if (!response.ok) throw new Error(`${endpoint} ${response.status}`);
        return await response.json();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
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
  if (tags.leisure) value += 3;
  if (tags.amenity) value += 2;
  if (tags.website) value += 1;
  return value;
}

function canonicalName(tags) {
  return tags["name:en"] ?? tags.name ?? tags["name:zh"] ?? tags["name:ko"] ?? tags["name:ja"] ?? tags["name:th"] ?? null;
}

function environment(tags) {
  const tourism = tags.tourism ?? "";
  if (["museum", "gallery", "aquarium"].includes(tourism) || tags.amenity === "arts_centre" || tags.shop === "mall") return "indoor";
  if (tourism === "viewpoint" || tags.leisure === "park" || tags.leisure === "garden") return "outdoor";
  if (tags.historic || tags.amenity === "place_of_worship") return "mixed";
  return tourism === "zoo" || tourism === "theme_park" ? "mixed" : "outdoor";
}

function category(tags) {
  if (tags.shop === "mall") return "shopping";
  if (tags.amenity === "marketplace") return "food";
  if (tags.leisure === "park" || tags.leisure === "garden" || tags.tourism === "viewpoint") return "leisure";
  return "attraction";
}

function duration(tags) {
  if (tags.tourism === "theme_park" || tags.tourism === "zoo") return 240;
  if (["museum", "gallery", "aquarium"].includes(tags.tourism)) return 150;
  if (tags.leisure === "park" || tags.leisure === "garden") return 120;
  return 90;
}

function reservation(tags) {
  return tags.tourism === "theme_park" ? "recommended" : "none";
}

function recommendedWindow(tags) {
  if (tags.tourism === "viewpoint") return "evening";
  if (tags.leisure === "park" || tags.leisure === "garden" || tags.historic) return "morning";
  if (["museum", "gallery", "aquarium"].includes(tags.tourism) || tags.shop === "mall") return "afternoon";
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
for (const city of cities) {
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

  if (candidates.length < 40) {
    throw new Error(`${city.id} returned only ${candidates.length} usable OSM POIs`);
  }
  for (const candidate of candidates.slice(0, 50)) {
    const { element, tags, name, lat, lon } = candidate;
    const env = environment(tags);
    const nameEn = tags["name:en"] ?? name;
    const nameZh = tags["name:zh"] ?? tags["name:zh-Hans"] ?? nameEn;
    const nameHant = tags["name:zh-Hant"] ?? tags["name:zh-TW"] ?? tags["name:zh"] ?? nameEn;
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
}

const lines = [
  '// Generated from OpenStreetMap via tooling/poi/generate-osm-pilot-pois.mjs.',
  '// Source data © OpenStreetMap contributors, ODbL 1.0.',
  'import type { CuratedPoi } from "./poi-catalog";',
  '',
  'export const OSM_PILOT_POIS: ReadonlyArray<CuratedPoi> = [',
];
for (const item of output) {
  lines.push('  {');
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
  lines.push('  },');
}
lines.push('];', '');

await writeFile('apps/web/src/trips/poi-catalog-osm.generated.ts', `${lines.join('\n')}\n`, 'utf8');
console.log(`Generated ${output.length} OSM POIs.`);
