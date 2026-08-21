import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const OUTPUT = "apps/web/src/components/country-map-world.generated.ts";
const API_ROOT = "https://www.geoboundaries.org/api/current/gbOpen";
const MIN_RING_AREA_DEGREES = 0.0015;
const DEFAULT_SIMPLIFY_TOLERANCE = 0.02;
const TRAVEL_ISLAND_SIMPLIFY_TOLERANCE = 0.003;
const TRAVEL_ISLAND_NEARBY_TOLERANCE = 0.03;

const COUNTRIES = [
  {
    countryId: "JP",
    iso3: "JPN",
    frame: { minLongitude: 126, maxLongitude: 146.5, minLatitude: 24, maxLatitude: 46.5 },
  },
  {
    countryId: "KR",
    iso3: "KOR",
    frame: { minLongitude: 124.5, maxLongitude: 130.5, minLatitude: 32, maxLatitude: 39.5 },
  },
  {
    countryId: "TH",
    iso3: "THA",
    frame: { minLongitude: 96.5, maxLongitude: 106.5, minLatitude: 5, maxLatitude: 21.5 },
  },
  {
    countryId: "VN",
    iso3: "VNM",
    frame: { minLongitude: 101.5, maxLongitude: 110.5, minLatitude: 7.5, maxLatitude: 24 },
  },
  {
    countryId: "ID",
    iso3: "IDN",
    frame: { minLongitude: 94, maxLongitude: 142.5, minLatitude: -12, maxLatitude: 7 },
  },
  {
    countryId: "MY",
    iso3: "MYS",
    frame: { minLongitude: 98, maxLongitude: 120.5, minLatitude: 0, maxLatitude: 8.5 },
  },
  {
    countryId: "PH",
    iso3: "PHL",
    frame: { minLongitude: 116, maxLongitude: 127.5, minLatitude: 4, maxLatitude: 21 },
  },
  {
    countryId: "SG",
    iso3: "SGP",
    frame: { minLongitude: 103.55, maxLongitude: 104.1, minLatitude: 1.15, maxLatitude: 1.5 },
  },
  {
    countryId: "TW",
    iso3: "TWN",
    frame: { minLongitude: 119.4, maxLongitude: 122.2, minLatitude: 21.4, maxLatitude: 25.7 },
  },
];

// Small destination islands must survive ring filtering even when their physical
// area is below the general map-detail threshold.
const TRAVEL_ISLAND_ANCHORS = {
  JP: [[127.6809, 26.2124]], // Okinawa / Naha
  KR: [[126.5312, 33.4996]], // Jeju
  TH: [
    [98.3923, 7.8804], // Phuket
    [100.0136, 9.512], // Koh Samui
  ],
  VN: [[103.984, 10.2899]], // Phu Quoc
  ID: [
    [115.2126, -8.6705], // Bali
    [116.1167, -8.5833], // Lombok
    [119.8877, -8.4964], // Labuan Bajo / Flores
  ],
  MY: [[100.3288, 5.4141]], // Penang
  PH: [
    [123.8854, 10.3157], // Cebu
    [121.9248, 11.9674], // Boracay
  ],
  SG: [[103.8198, 1.3521]],
  TW: [],
};

function squaredSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyDouglasPeucker(points, tolerance) {
  if (points.length <= 4) return points;
  const closed = points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1];
  const source = closed ? points.slice(0, -1) : [...points];
  if (source.length <= 3) return points;

  const squaredTolerance = tolerance * tolerance;
  const keep = new Uint8Array(source.length);
  keep[0] = 1;
  keep[source.length - 1] = 1;
  const stack = [[0, source.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDistance = squaredTolerance;
    let index = -1;
    for (let candidate = first + 1; candidate < last; candidate += 1) {
      const distance = squaredSegmentDistance(source[candidate], source[first], source[last]);
      if (distance > maxDistance) {
        index = candidate;
        maxDistance = distance;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const simplified = source.filter((_, index) => keep[index] === 1);
  if (simplified.length < 3) return points;
  if (closed) simplified.push(simplified[0]);
  return simplified;
}

function ringBounds(ring) {
  return ring.reduce(
    (bounds, [longitude, latitude]) => ({
      minLongitude: Math.min(bounds.minLongitude, longitude),
      maxLongitude: Math.max(bounds.maxLongitude, longitude),
      minLatitude: Math.min(bounds.minLatitude, latitude),
      maxLatitude: Math.max(bounds.maxLatitude, latitude),
    }),
    {
      minLongitude: Infinity,
      maxLongitude: -Infinity,
      minLatitude: Infinity,
      maxLatitude: -Infinity,
    },
  );
}

function ringArea(ring) {
  let twiceArea = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    twiceArea += ring[previous][0] * ring[index][1] - ring[index][0] * ring[previous][1];
  }
  return Math.abs(twiceArea) / 2;
}

function pointInRing(point, ring) {
  const [longitude, latitude] = point;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    if (y1 > latitude === y2 > latitude) continue;
    const intersection = ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1;
    if (longitude < intersection) inside = !inside;
  }
  return inside;
}

function minimumDistanceToRing(point, ring) {
  let minimumSquared = Infinity;
  for (let index = 1; index < ring.length; index += 1) {
    minimumSquared = Math.min(
      minimumSquared,
      squaredSegmentDistance(point, ring[index - 1], ring[index]),
    );
  }
  return Math.sqrt(minimumSquared);
}

function protectsTravelIsland(countryId, ring) {
  const anchors = TRAVEL_ISLAND_ANCHORS[countryId] ?? [];
  return anchors.some(
    (anchor) =>
      pointInRing(anchor, ring) ||
      minimumDistanceToRing(anchor, ring) <= TRAVEL_ISLAND_NEARBY_TOLERANCE,
  );
}

function intersectsFrame(bounds, frame) {
  return !(
    bounds.maxLongitude < frame.minLongitude ||
    bounds.minLongitude > frame.maxLongitude ||
    bounds.maxLatitude < frame.minLatitude ||
    bounds.minLatitude > frame.maxLatitude
  );
}

function extractRings(geometry) {
  if (geometry?.type === "Polygon") return geometry.coordinates ?? [];
  if (geometry?.type === "MultiPolygon")
    return (geometry.coordinates ?? []).flatMap((polygon) => polygon);
  throw new Error(`Unsupported geometry type: ${geometry?.type ?? "unknown"}`);
}

function roundRing(ring) {
  return ring.map(([longitude, latitude]) => [
    Number(longitude.toFixed(5)),
    Number(latitude.toFixed(5)),
  ]);
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: { "user-agent": "weather-v2-country-map-generator" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const generated = {};
const sourceMeta = {};

for (const country of COUNTRIES) {
  const metadata = await fetchJson(
    `${API_ROOT}/${country.iso3}/ADM0/`,
    `${country.countryId} metadata`,
  );
  const geometryUrl = metadata.simplifiedGeometryGeoJSON || metadata.gjDownloadURL;
  if (!geometryUrl) throw new Error(`No GeoJSON URL for ${country.countryId}`);

  const geojson = await fetchJson(geometryUrl, `${country.countryId} boundary`);
  const feature = geojson?.features?.[0];
  if (!feature?.geometry) throw new Error(`No boundary geometry for ${country.countryId}`);

  const rings = extractRings(feature.geometry)
    .filter((ring) => Array.isArray(ring) && ring.length >= 4)
    .filter((ring) => intersectsFrame(ringBounds(ring), country.frame))
    .map((ring) => ({
      ring,
      protectsDestination: protectsTravelIsland(country.countryId, ring),
    }))
    .filter(
      ({ ring, protectsDestination }) =>
        protectsDestination || ringArea(ring) >= MIN_RING_AREA_DEGREES,
    )
    .map(({ ring, protectsDestination }) =>
      simplifyDouglasPeucker(
        ring,
        protectsDestination
          ? TRAVEL_ISLAND_SIMPLIFY_TOLERANCE
          : DEFAULT_SIMPLIFY_TOLERANCE,
      ),
    )
    .map(roundRing)
    .filter((ring) => ring.length >= 4);

  if (rings.length === 0) throw new Error(`No in-frame rings for ${country.countryId}`);

  generated[country.countryId] = {
    frame: country.frame,
    rings,
  };
  sourceMeta[country.countryId] = {
    boundaryId: metadata.boundaryID,
    boundaryYear: metadata.boundaryYearRepresented,
    source: metadata.boundarySource,
    license: metadata.boundaryLicense,
  };
}

const source = `// Generated by tooling/maps/generate-country-geometries.mjs\n// Source: geoBoundaries gbOpen ADM0 (https://www.geoboundaries.org/)\n// Source metadata and upstream licenses are retained below.\n\nexport type GeneratedCountryMapRing = ReadonlyArray<readonly [number, number]>;\n\nexport interface GeneratedCountryMapSource {\n  readonly frame: {\n    readonly minLongitude: number;\n    readonly maxLongitude: number;\n    readonly minLatitude: number;\n    readonly maxLatitude: number;\n  };\n  readonly rings: ReadonlyArray<GeneratedCountryMapRing>;\n}\n\nexport const GENERATED_COUNTRY_MAPS: Readonly<Record<string, GeneratedCountryMapSource>> = ${JSON.stringify(generated)};\n\nexport const GENERATED_COUNTRY_MAP_SOURCE_META = ${JSON.stringify(sourceMeta, null, 2)} as const;\n`;

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, source, "utf8");

console.log(
  JSON.stringify({
    output: OUTPUT,
    countries: Object.fromEntries(
      Object.entries(generated).map(([countryId, value]) => [
        countryId,
        {
          rings: value.rings.length,
          points: value.rings.reduce((sum, ring) => sum + ring.length, 0),
        },
      ]),
    ),
  }),
);
