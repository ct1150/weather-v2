#!/usr/bin/env node

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "read-url": { type: "string" },
    city: { type: "string", default: "jp-tokyo" },
    date: { type: "string" },
  },
});

const readUrl = values["read-url"]?.replace(/\/$/u, "");
const city = values.city ?? "jp-tokyo";
const date = values.date ?? new Date().toISOString().slice(0, 10);

if (!readUrl) {
  console.error("PHASE8-HOURLY-SMOKE: --read-url is required");
  process.exit(1);
}

async function read(path) {
  const response = await fetch(`${readUrl}${path}`);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

try {
  const hourly = await read(
    `/api/v1/trip-hourly?cityIds=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}&startHour=8&endHour=12&locale=en`,
  );
  if (!hourly.response.ok) {
    throw new Error(`hourly read returned ${hourly.response.status}: ${JSON.stringify(hourly.payload)}`);
  }
  if (typeof hourly.payload.data?.snapshotId !== "string") {
    throw new Error("hourly read did not return an active snapshot id");
  }
  if (!Array.isArray(hourly.payload.data?.items)) {
    throw new Error("hourly read did not return items");
  }
  if (!Array.isArray(hourly.payload.data?.coverage?.availableCityIds)) {
    throw new Error("hourly read did not return explicit coverage");
  }
  if (
    hourly.payload.data.items.some(
      (item) => typeof item.localTime !== "string" || !item.localTime.startsWith(`${date}T`),
    )
  ) {
    throw new Error("hourly read escaped the requested local date");
  }

  const badWindow = await read(
    `/api/v1/trip-hourly?cityIds=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}&startHour=20&endHour=8`,
  );
  if (badWindow.response.status !== 400) {
    throw new Error(`invalid hour window returned ${badWindow.response.status}, expected 400`);
  }

  const tooMany = await read(
    `/api/v1/trip-hourly?cityIds=jp-tokyo,jp-kyoto,jp-osaka,kr-seoul,kr-jeju&date=${encodeURIComponent(date)}`,
  );
  if (tooMany.response.status !== 400) {
    throw new Error(`five-city hourly request returned ${tooMany.response.status}, expected 400`);
  }

  console.log(
    `PHASE8-HOURLY-SMOKE: OK — snapshot=${hourly.payload.data.snapshotId} rows=${hourly.payload.data.items.length} available=${hourly.payload.data.coverage.availableCityIds.join(",")}`,
  );
} catch (error) {
  console.error(`PHASE8-HOURLY-SMOKE: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
