#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(text, oldValue, newValue, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one anchor, found ${count}`);
  }
  return text.replace(oldValue, newValue);
}

const deployPath = ".github/workflows/deploy.yml";
let deploy = readFileSync(deployPath, "utf8");

const previewAnchor =
  "      - name: Extended preview smoke (KV hit / D1 fallback / no user-path provider call)\n";
const previewStep = `      - name: Phase 3 Trip API preview smoke (collaboration / revisions)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          SMOKE_TOKEN="$(printf 'wnr-trip-smoke:%s' "$CLOUDFLARE_API_TOKEN" | sha256sum | cut -d' ' -f1)"
          TRIP_SMOKE_TOKEN="$SMOKE_TOKEN" node tooling/deploy/trip-collaboration-smoke.mjs \\
            --trip-url "$TRIP_PREVIEW_URL" --suffix preview

`;
deploy = replaceOnce(deploy, previewAnchor, previewStep + previewAnchor, "preview smoke");

const productionAnchor = "      - name: Deploy to production (main)\n";
const productionStep = `      - name: Phase 3 Trip API production smoke (collaboration / revisions)
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          SMOKE_TOKEN="$(printf 'wnr-trip-smoke:%s' "$CLOUDFLARE_API_TOKEN" | sha256sum | cut -d' ' -f1)"
          TRIP_SMOKE_TOKEN="$SMOKE_TOKEN" node tooling/deploy/trip-collaboration-smoke.mjs \\
            --trip-url "$TRIP_PRODUCTION_URL" --suffix production

`;
deploy = replaceOnce(
  deploy,
  productionAnchor,
  productionStep + productionAnchor,
  "production smoke",
);
writeFileSync(deployPath, deploy);

const verifyPath = ".github/workflows/verify-trip-product-production.yml";
let verify = readFileSync(verifyPath, "utf8");

verify = replaceOnce(
  verify,
  `          fetch_and_match \\
            "English country direct trip action" \\
`,
  `          fetch_and_match \\
            "English collaboration invite route" \\
            "https://868656.xyz/trips/invite" \\
            /tmp/trip-invite-page.html \\
            "Trip collaboration invite" "noindex"

          fetch_and_match \\
            "English country direct trip action" \\
`,
  "English invite route",
);

verify = replaceOnce(
  verify,
  `          fetch_and_match \\
            "Traditional weather radar" \\
`,
  `          fetch_and_match \\
            "Traditional collaboration invite route" \\
            "https://868656.xyz/zh-hant/trips/invite" \\
            /tmp/trip-invite-hant.html \\
            "行程協作邀請" "noindex"

          fetch_and_match \\
            "Traditional weather radar" \\
`,
  "Traditional invite route",
);

verify = replaceOnce(
  verify,
  `          fetch_and_match \\
            "Simplified country weather route" \\
`,
  `          fetch_and_match \\
            "Simplified collaboration invite route" \\
            "https://868656.xyz/zh-cn/trips/invite" \\
            /tmp/trip-invite-cn.html \\
            "行程协作邀请" "noindex"

          fetch_and_match \\
            "Simplified country weather route" \\
`,
  "Simplified invite route",
);

verify = replaceOnce(
  verify,
  `            '"ok":true' '"service":"trip-api"' '"cloudTrip":true' '"cloudSharing":true' '"auth":true'
`,
  `            '"ok":true' '"service":"trip-api"' '"cloudTrip":true' '"cloudSharing":true' \\
            '"cloudCollaboration":true' '"revisionHistory":true' '"auth":true'
`,
  "Cloud Trip health contract",
);
writeFileSync(verifyPath, verify);
