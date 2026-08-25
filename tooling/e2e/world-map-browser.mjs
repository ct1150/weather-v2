import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import process from "node:process";
import { strict as assert } from "node:assert";

const ROOT = process.cwd();
const OUT_DIR = resolve(ROOT, "apps/web/out");
const ARTIFACT_DIR = resolve(ROOT, "artifacts/e2e");
const WEB_PORT = 4173;
const DRIVER_PORT = 9515;
const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function staticCandidate(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0] || "/");
  const relative = normalize(clean).replace(/^[/\\]+/, "");
  const candidates =
    relative.length === 0
      ? ["index.html"]
      : [relative, `${relative}.html`, join(relative, "index.html")];

  for (const candidate of candidates) {
    const full = resolve(OUT_DIR, candidate);
    if (!full.startsWith(OUT_DIR)) continue;
    try {
      if (statSync(full).isFile()) return full;
    } catch {
      // Try the next static-export shape.
    }
  }
  return null;
}

function startStaticServer() {
  return new Promise((resolveServer, reject) => {
    const server = createServer((request, response) => {
      const file = staticCandidate(request.url ?? "/");
      if (file === null) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
        return;
      }
      response.writeHead(200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(readFileSync(file));
    });
    server.once("error", reject);
    server.listen(WEB_PORT, "127.0.0.1", () => resolveServer(server));
  });
}

function findChromeDriver() {
  const lookup = spawnSync(
    "bash",
    ["-lc", "command -v chromedriver || command -v chromium-driver"],
    { encoding: "utf8" },
  );
  const binary = lookup.stdout.trim();
  if (!binary) throw new Error("ChromeDriver is required for world-map browser E2E");
  return binary;
}

async function waitFor(url, predicate, timeoutMs = 25_000, intervalMs = 250) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await fetch(url);
      if (await predicate(last)) return;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function webdriver(method, path, body) {
  const response = await fetch(`http://127.0.0.1:${DRIVER_PORT}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) {
    throw new Error(
      `WebDriver ${method} ${path} failed: ${JSON.stringify(payload.value ?? payload)}`,
    );
  }
  return payload.value;
}

async function createSession(width, height) {
  const value = await webdriver("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        "goog:chromeOptions": {
          args: [
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--use-angle=swiftshader",
            `--window-size=${width},${height}`,
          ],
        },
      },
    },
  });
  const sessionId = value.sessionId;
  assert.ok(sessionId, "ChromeDriver did not return a session id");
  await webdriver("POST", `/session/${sessionId}/window/rect`, { width, height, x: 0, y: 0 });
  return sessionId;
}

async function execute(sessionId, script) {
  return webdriver("POST", `/session/${sessionId}/execute/sync`, { script, args: [] });
}

async function waitForMap(sessionId, expectedMarkers = 10) {
  const started = Date.now();
  let snapshot = null;
  while (Date.now() - started < 30_000) {
    snapshot = await execute(
      sessionId,
      `
        const map = document.querySelector('[data-world-weather-map-canvas]');
        const canvas = map?.querySelector('canvas.maplibregl-canvas');
        const markers = [...document.querySelectorAll('.world-weather-marker')];
        const rect = map?.getBoundingClientRect();
        const markerRects = markers.map((marker) => marker.getBoundingClientRect());
        let overlapPairs = 0;
        for (let left = 0; left < markerRects.length; left += 1) {
          for (let right = left + 1; right < markerRects.length; right += 1) {
            const a = markerRects[left];
            const b = markerRects[right];
            const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            if (overlapWidth * overlapHeight > 40) overlapPairs += 1;
          }
        }
        return {
          state: map?.dataset.renderState ?? null,
          countryLayer: map?.dataset.countryLayer ?? null,
          markerCount: markers.length,
          overlapPairs,
          mapWidth: rect?.width ?? 0,
          mapHeight: rect?.height ?? 0,
          canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
          canvasHeight: canvas?.getBoundingClientRect().height ?? 0,
          markerWidth: markerRects[0]?.width ?? 0,
          markerHeight: markerRects[0]?.height ?? 0,
        };
      `,
    );
    if (
      snapshot.state === "ready" &&
      snapshot.countryLayer === "ready" &&
      snapshot.markerCount === expectedMarkers
    ) {
      return snapshot;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 350));
  }
  throw new Error(`World map never reached ready state: ${JSON.stringify(snapshot)}`);
}

async function scrollElementFullyIntoView(sessionId, selector) {
  const encodedSelector = JSON.stringify(selector);
  const geometry = await execute(
    sessionId,
    `
      const element = document.querySelector(${encodedSelector});
      if (!element) return null;
      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        viewportHeight: window.innerHeight,
      };
    `,
  );
  assert.ok(geometry, `Element not found for ${selector}`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));

  const settled = await execute(
    sessionId,
    `
      const element = document.querySelector(${encodedSelector});
      const rect = element?.getBoundingClientRect();
      return rect ? {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        viewportHeight: window.innerHeight,
      } : null;
    `,
  );
  assert.ok(settled, `Element disappeared before screenshot: ${selector}`);
  assert.ok(settled.top >= -2, `Map starts above the viewport (${settled.top}px)`);
  assert.ok(
    settled.bottom <= settled.viewportHeight + 2,
    `Map extends below the viewport (${settled.bottom}px > ${settled.viewportHeight}px)`,
  );
  return settled;
}

async function screenshotElement(sessionId, selector, outputPath) {
  const viewportGeometry = await scrollElementFullyIntoView(sessionId, selector);
  const element = await webdriver("POST", `/session/${sessionId}/element`, {
    using: "css selector",
    value: selector,
  });
  const elementId = element[ELEMENT_KEY];
  assert.ok(elementId, `Element not found for ${selector}`);
  const base64 = await webdriver("GET", `/session/${sessionId}/element/${elementId}/screenshot`);
  const png = Buffer.from(base64, "base64");
  writeFileSync(outputPath, png);
  return { bytes: png.length, viewportGeometry };
}

async function clickCountry(sessionId, countryId) {
  const element = await webdriver("POST", `/session/${sessionId}/element`, {
    using: "css selector",
    value: `.world-weather-marker[data-country-id="${countryId}"]`,
  });
  const elementId = element[ELEMENT_KEY];
  assert.ok(elementId, `${countryId} weather marker not found`);
  await webdriver("POST", `/session/${sessionId}/element/${elementId}/click`, {});

  const started = Date.now();
  while (Date.now() - started < 8_000) {
    const current = await webdriver("GET", `/session/${sessionId}/url`);
    if (new URL(current).pathname.replace(/\/$/, "") === "/jp") return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw new Error("Clicking the JP marker did not navigate to /jp");
}

async function validateViewport({ name, width, height, minScreenshotBytes, clickJp = false }) {
  const sessionId = await createSession(width, height);
  try {
    await webdriver("POST", `/session/${sessionId}/url`, { url: `http://127.0.0.1:${WEB_PORT}/` });
    const snapshot = await waitForMap(sessionId);

    assert.equal(snapshot.markerCount, 10, `${name}: expected all supported country labels`);
    assert.equal(
      snapshot.countryLayer,
      "ready",
      `${name}: supported-country polygon layer is missing`,
    );
    assert.ok(snapshot.overlapPairs <= 3, `${name}: too many country labels overlap`);
    assert.ok(
      snapshot.mapWidth >= Math.min(width * 0.72, 300),
      `${name}: map is unexpectedly narrow`,
    );
    assert.ok(
      snapshot.mapHeight >= 280 && snapshot.mapHeight <= 520,
      `${name}: map height is invalid`,
    );
    assert.ok(
      Math.abs(snapshot.canvasWidth - snapshot.mapWidth) < 4 &&
        Math.abs(snapshot.canvasHeight - snapshot.mapHeight) < 4,
      `${name}: MapLibre canvas does not fill its container`,
    );
    assert.ok(
      snapshot.markerWidth >= 20 &&
        snapshot.markerWidth <= 42 &&
        snapshot.markerHeight >= 20 &&
        snapshot.markerHeight <= 34,
      `${name}: country label geometry is not compact`,
    );

    const screenshotPath = join(ARTIFACT_DIR, `world-map-${name}.png`);
    const screenshot = await screenshotElement(
      sessionId,
      "[data-world-weather-map-canvas]",
      screenshotPath,
    );
    assert.ok(
      Math.abs(screenshot.viewportGeometry.height - snapshot.mapHeight) < 4,
      `${name}: screenshot geometry does not match the full map`,
    );
    assert.ok(
      screenshot.bytes >= minScreenshotBytes,
      `${name}: map screenshot is suspiciously small (${screenshot.bytes} bytes), consistent with a blank/solid block`,
    );

    if (clickJp) await clickCountry(sessionId, "JP");
    console.log(
      `${name}:`,
      JSON.stringify({ ...snapshot, screenshotBytes: screenshot.bytes, viewport: screenshot.viewportGeometry }),
    );
  } finally {
    await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  }
}

mkdirSync(ARTIFACT_DIR, { recursive: true });
const server = await startStaticServer();
const driver = spawn(findChromeDriver(), [`--port=${DRIVER_PORT}`], {
  stdio: ["ignore", "pipe", "pipe"],
});
let driverLogs = "";
driver.stdout.on("data", (chunk) => {
  driverLogs += chunk.toString();
});
driver.stderr.on("data", (chunk) => {
  driverLogs += chunk.toString();
});

try {
  await waitFor(`http://127.0.0.1:${DRIVER_PORT}/status`, async (response) => response.ok);
  await validateViewport({
    name: "mobile",
    width: 390,
    height: 844,
    minScreenshotBytes: 18_000,
  });
  await validateViewport({
    name: "desktop",
    width: 1440,
    height: 900,
    minScreenshotBytes: 35_000,
    clickJp: true,
  });
  console.log("world-map browser E2E: passed");
} catch (error) {
  console.error(driverLogs.slice(-8_000));
  throw error;
} finally {
  driver.kill("SIGTERM");
  await new Promise((resolveClose) => server.close(resolveClose));
}
