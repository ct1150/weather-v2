import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const INDEXNOW_KEY = "b8e8d4ca85b24f2eb7cc3c20c1527e2f";
export const SITE_HOST = "868656.xyz";

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

export function buildIndexNowPayload(urlList) {
  if (urlList.length === 0) throw new Error("IndexNow requires at least one URL");
  for (const value of urlList) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== SITE_HOST) {
      throw new Error(`IndexNow URL is outside ${SITE_HOST}: ${value}`);
    }
  }
  return {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

export async function submitIndexNow({
  sitemapPath = resolve("apps/web/out/sitemap.xml"),
  fetchImpl = fetch,
} = {}) {
  const sitemap = await readFile(sitemapPath, "utf8");
  const payload = buildIndexNowPayload(extractSitemapUrls(sitemap));
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
  return { status: response.status, submitted: payload.urlList.length };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await submitIndexNow();
  console.log(`IndexNow accepted ${result.submitted} URLs (HTTP ${result.status})`);
}
