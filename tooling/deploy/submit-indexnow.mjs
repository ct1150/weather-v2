import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const INDEXNOW_KEY = "b8e8d4ca85b24f2eb7cc3c20c1527e2f";
export const DEFAULT_SITE_HOST = "868656.xyz";

// 24 logical acquisition targets. Localized variants are allowed for the same intent page.
// The complete sitemap remains crawlable; proactive IndexNow notifications stay focused.
export const PRIORITY_INDEXNOW_PATHS = Object.freeze([
  "/",
  "/best-weather-this-week",
  "/best-weekend",
  "/jp",
  "/kr",
  "/th",
  "/vn",
  "/id",
  "/my",
  "/ph",
  "/sg",
  "/cn",
  "/tw",
  "/jp/best-weather-this-week",
  "/kr/best-weather-this-week",
  "/th/best-weather-this-week",
  "/vn/best-weather-this-week",
  "/id/best-weather-this-week",
  "/my/best-weather-this-week",
  "/ph/best-weather-this-week",
  "/jp/tokyo",
  "/kr/seoul",
  "/th/bangkok",
  "/id/bali",
]);

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

export function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1].trim()));
}

function normalizeIntentPath(pathname) {
  let path = pathname;
  for (const prefix of ["/zh-cn", "/zh-hant"]) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length);
      break;
    }
  }
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

export function priorityIndexNowUrls(urlList) {
  const priorities = new Set(PRIORITY_INDEXNOW_PATHS);
  return urlList.filter((value) => priorities.has(normalizeIntentPath(new URL(value).pathname)));
}

export function buildIndexNowPayload(urlList, siteHost = DEFAULT_SITE_HOST) {
  if (urlList.length === 0) throw new Error("IndexNow requires at least one URL");
  for (const value of urlList) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== siteHost) {
      throw new Error(`IndexNow URL is outside ${siteHost}: ${value}`);
    }
  }
  return {
    host: siteHost,
    key: INDEXNOW_KEY,
    keyLocation: `https://${siteHost}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

export async function submitIndexNow({
  sitemapPath = resolve("apps/web/out/sitemap.xml"),
  fetchImpl = fetch,
  siteHost = process.env.INDEXNOW_SITE_HOST || DEFAULT_SITE_HOST,
} = {}) {
  const sitemap = await readFile(sitemapPath, "utf8");
  const allUrls = extractSitemapUrls(sitemap);
  const priorityUrls = priorityIndexNowUrls(allUrls);
  const payload = buildIndexNowPayload(priorityUrls.length > 0 ? priorityUrls : allUrls, siteHost);
  const keyResponse = await fetchImpl(payload.keyLocation);
  const publishedKey = keyResponse.ok ? (await keyResponse.text()).trim() : "";
  if (publishedKey !== INDEXNOW_KEY) {
    throw new Error(`IndexNow key is not publicly available at ${payload.keyLocation}`);
  }
  const response = await fetchImpl("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow submission failed with HTTP ${response.status}`);
  }
  return {
    status: response.status,
    submitted: payload.urlList.length,
    sitemapUrls: allUrls.length,
    priorityMode: priorityUrls.length > 0,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await submitIndexNow();
  console.log(
    `IndexNow accepted ${result.submitted}/${result.sitemapUrls} URLs (priority=${result.priorityMode}, HTTP ${result.status})`,
  );
}
