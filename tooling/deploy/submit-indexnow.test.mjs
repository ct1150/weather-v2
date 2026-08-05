import assert from "node:assert/strict";
import test from "node:test";

import { INDEXNOW_KEY, buildIndexNowPayload, extractSitemapUrls } from "./submit-indexnow.mjs";

test("extractSitemapUrls reads and decodes canonical sitemap locations", () => {
  const urls = extractSitemapUrls(
    "<urlset><url><loc>https://868656.xyz/</loc></url><url><loc>https://868656.xyz/jp?a=1&amp;b=2</loc></url></urlset>",
  );
  assert.deepEqual(urls, ["https://868656.xyz/", "https://868656.xyz/jp?a=1&b=2"]);
});

test("buildIndexNowPayload scopes notifications to the production host", () => {
  const payload = buildIndexNowPayload(["https://868656.xyz/", "https://868656.xyz/zh-cn"]);
  assert.equal(payload.host, "868656.xyz");
  assert.equal(payload.key, INDEXNOW_KEY);
  assert.equal(payload.keyLocation, `https://868656.xyz/${INDEXNOW_KEY}.txt`);
  assert.equal(payload.urlList.length, 2);
  assert.throws(() => buildIndexNowPayload(["https://example.com/"]), /outside 868656\.xyz/);
});
