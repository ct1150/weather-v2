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
const TOKYO = [139.6917, 35.6895];

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

async function waitForMap(sessionId) {
  const started = Date.now();
  let snapshot = null;
  while (Date.now() - started < 30_000) {
    snapshot = await execute(
      sessionId,
      `
        const map = document.querySelector('[data-world-weather-map-canvas]');
        const canvas = map?.querySelector('canvas.maplibregl-canvas');
        const labels = [...document.querySelectorAll('.world-weather-marker')];
        const hotspots = [...document.querySelectorAll('.world-weather-hotspot')];
        const rect = map?.getBoundingClientRect();
        const hotspotRect = hotspots[0]?.getBoundingClientRect();
        return {
          state: map?.dataset.renderState ?? null,
          countryLayer: map?.dataset.countryLayer ?? null,
          interactionMode: map?.dataset.interactionMode ?? null,
          permanentLabelCount: labels.length,
          hotspotCount: hotspots.length,
          mapWidth: rect?.width ?? 0,
          mapHeight: rect?.height ?? 0,
          canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
          canvasHeight: canvas?.getBoundingClientRect().height ?? 0,
          hotspotWidth: hotspotRect?.width ?? 0,
          hotspotHeight: hotspotRect?.height ?? 0,
        };
      `,
    );
    if (
      snapshot.state === "ready" &&
      snapshot.countryLayer === "ready" &&
      snapshot.hotspotCount === 1
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

async function mapPoint(sessionId, coordinates) {
  return execute(
    sessionId,
    `
      const container = document.querySelector('[data-world-weather-map-canvas]');
      const map = container?.__wnrWorldMap;
      const canvas = container?.querySelector('canvas.maplibregl-canvas');
      if (!map || !canvas) return null;
      const point = map.project(${JSON.stringify(coordinates)});
      const rect = canvas.getBoundingClientRect();
      return { x: Math.round(rect.left + point.x), y: Math.round(rect.top + point.y) };
    `,
  );
}

async function pointerMove(sessionId, point) {
  assert.ok(point, "Map projection point was not available");
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          {
            type: "pointerMove",
            duration: 120,
            origin: "viewport",
            x: point.x,
            y: point.y,
          },
        ],
      },
    ],
  });
}

async function pointerClick(sessionId, point) {
  assert.ok(point, "Map projection point was not available");
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          {
            type: "pointerMove",
            duration: 80,
            origin: "viewport",
            x: point.x,
            y: point.y,
          },
          { type: "pointerDown", button: 0 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

async function worldMapInteractionState(sessionId) {
  return execute(
    sessionId,
    `
      const map = document.querySelector('[data-world-weather-map-canvas]');
      const overview = document.querySelector('[data-world-weather-overview]');
      return {
        highlightedCountry: map?.dataset.highlightedCountry ?? null,
        activeCountry: overview?.dataset.activeCountry ?? null,
        path: window.location.pathname,
      };
    `,
  );
}

async function waitForActiveCountry(sessionId, countryId) {
  const started = Date.now();
  let state = null;
  while (Date.now() - started < 5_000) {
    state = await worldMapInteractionState(sessionId);
    if (state.highlightedCountry === countryId && state.activeCountry === countryId) return state;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Country ${countryId} did not become active: ${JSON.stringify(state)}`);
}

async function clickOverviewLink(sessionId, expectedPath) {
  const element = await webdriver("POST", `/session/${sessionId}/element`, {
    using: "css selector",
    value: "[data-world-weather-overview-link]",
  });
  const elementId = element[ELEMENT_KEY];
  assert.ok(elementId, "World weather overview CTA not found");
  await webdriver("POST", `/session/${sessionId}/element/${elementId}/click`, {});
  await waitForPath(sessionId, expectedPath);
}

async function waitForPath(sessionId, expectedPath) {
  const started = Date.now();
  while (Date.now() - started < 8_000) {
    const current = await webdriver("GET", `/session/${sessionId}/url`);
    if (new URL(current).pathname.replace(/\/$/, "") === expectedPath) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw new Error(`Browser did not navigate to ${expectedPath}`);
}

async function validateViewport({ name, width, height, minScreenshotBytes, mobile }) {
  const sessionId = await createSession(width, height);
  try {
    await webdriver("POST", `/session/${sessionId}/url`, { url: `http://127.0.0.1:${WEB_PORT}/` });
    const snapshot = await waitForMap(sessionId);

    assert.equal(snapshot.permanentLabelCount, 0, `${name}: permanent ISO labels should be removed`);
    assert.equal(snapshot.hotspotCount, 1, `${name}: only the Singapore hotspot should remain`);
    assert.equal(
      snapshot.interactionMode,
      mobile ? "tap-preview" : "hover-open",
      `${name}: interaction mode is incorrect`,
    );
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
      snapshot.hotspotWidth >= 28 &&
        snapshot.hotspotWidth <= 40 &&
        snapshot.hotspotHeight >= 28 &&
        snapshot.hotspotHeight <= 40,
      `${name}: Singapore hotspot is not a compact enlarged touch target`,
    );

    await scrollElementFullyIntoView(sessionId, "[data-world-weather-map-canvas]");
    const tokyo = await mapPoint(sessionId, TOKYO);

    if (mobile) {
      await pointerClick(sessionId, tokyo);
      const selected = await waitForActiveCountry(sessionId, "JP");
      assert.equal(selected.path, "/", "mobile: first tap should preview instead of navigating");
    } else {
      await pointerMove(sessionId, tokyo);
      const hovered = await waitForActiveCountry(sessionId, "JP");
      assert.equal(hovered.path, "/", "desktop: hover should preview without navigating");
    }

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

    if (mobile) {
      await clickOverviewLink(sessionId, "/jp");
    } else {
      await pointerClick(sessionId, tokyo);
      await waitForPath(sessionId, "/jp");
    }

    console.log(
      `${name}:`,
      JSON.stringify({
        ...snapshot,
        screenshotBytes: screenshot.bytes,
        viewport: screenshot.viewportGeometry,
      }),
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
    mobile: true,
  });
  await validateViewport({
    name: "desktop",
    width: 1440,
    height: 900,
    minScreenshotBytes: 35_000,
    mobile: false,
  });
  console.log("world-map browser E2E: passed");
} catch (error) {
  console.error(driverLogs.slice(-8_000));
  throw error;
} finally {
  driver.kill("SIGTERM");
  await new Promise((resolveClose) => server.close(resolveClose));
}
