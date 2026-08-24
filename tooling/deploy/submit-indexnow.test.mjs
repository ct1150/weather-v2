import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_SITE_HOST,
  INDEXNOW_KEY,
  PRIORITY_INDEXNOW_PATHS,
  buildIndexNowPayload,
  extractSitemapUrls,
  priorityIndexNowUrls,
  submitIndexNow,
} from "./submit-indexnow.mjs";

test("extractSitemapUrls reads and decodes canonical sitemap locations", () => {
  const urls = extractSitemapUrls(
    "<urlset><url><loc>https://868656.xyz/</loc></url><url><loc>https://868656.xyz/jp?a=1&amp;b=2</loc></url></urlset>",
  );
  assert.deepEqual(urls, ["https://868656.xyz/", "https://868656.xyz/jp?a=1&b=2"]);
});

test("priorityIndexNowUrls focuses proactive submission on 24 logical intent pages", () => {
  assert.equal(PRIORITY_INDEXNOW_PATHS.length, 24);
  const urls = priorityIndexNowUrls([
    "https://868656.xyz/jp",
    "https://868656.xyz/zh-cn/jp",
    "https://868656.xyz/jp/tokyo",
    "https://868656.xyz/jp/osaka",
  ]);
  assert.deepEqual(urls, [
    "https://868656.xyz/jp",
    "https://868656.xyz/zh-cn/jp",
    "https://868656.xyz/jp/tokyo",
  ]);
});

test("buildIndexNowPayload scopes notifications to the configured production host", () => {
  const payload = buildIndexNowPayload(["https://868656.xyz/", "https://868656.xyz/zh-cn"]);
  assert.equal(payload.host, DEFAULT_SITE_HOST);
  assert.equal(payload.key, INDEXNOW_KEY);
  assert.equal(payload.keyLocation, `https://868656.xyz/${INDEXNOW_KEY}.txt`);
  assert.equal(payload.urlList.length, 2);
  assert.throws(() => buildIndexNowPayload(["https://example.com/"]), /outside 868656\.xyz/);

  const branded = buildIndexNowPayload(["https://wherenotrain.example/jp"], "wherenotrain.example");
  assert.equal(branded.host, "wherenotrain.example");
});

test("submitIndexNow verifies the public key and submits priority URLs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "indexnow-"));
  const sitemapPath = join(directory, "sitemap.xml");
  await writeFile(
    sitemapPath,
    "<urlset><url><loc>https://868656.xyz/</loc></url><url><loc>https://868656.xyz/jp</loc></url><url><loc>https://868656.xyz/jp/osaka</loc></url></urlset>",
  );
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (!options) return new Response(`${INDEXNOW_KEY}\n`, { status: 200 });
    return new Response(null, { status: 202 });
  };

  try {
    assert.deepEqual(await submitIndexNow({ sitemapPath, fetchImpl }), {
      status: 202,
      submitted: 2,
      sitemapUrls: 3,
      priorityMode: true,
    });
    assert.equal(requests[0].url, `https://868656.xyz/${INDEXNOW_KEY}.txt`);
    assert.equal(requests[1].url, "https://api.indexnow.org/indexnow");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("submitIndexNow stops when the public key does not match", async () => {
  const directory = await mkdtemp(join(tmpdir(), "indexnow-"));
  const sitemapPath = join(directory, "sitemap.xml");
  await writeFile(sitemapPath, "<urlset><url><loc>https://868656.xyz/</loc></url></urlset>");

  try {
    await assert.rejects(
      submitIndexNow({
        sitemapPath,
        fetchImpl: async () => new Response("wrong-key", { status: 200 }),
      }),
      /key is not publicly available/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
