from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected text not found in {path}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "apps/web/src/app/view-models.ts",
    "  readonly precipitationMm?: number | null;\n  readonly observedAt: string;",
    "  readonly precipitationMm?: number | null;\n  /** Maximum sustained wind during the local day, in km/h. */\n  readonly windSpeedMax?: number | null;\n  readonly observedAt: string;",
)

replace_once(
    "apps/web/src/build/bake.ts",
    "    precipitationMm: day.precipitationMm,\n    observedAt: `${day.localDate}T12:00:00Z`,",
    "    precipitationMm: day.precipitationMm,\n    windSpeedMax: day.windSpeedMaxKph,\n    observedAt: `${day.localDate}T12:00:00Z`,",
)

replace_once(
    "apps/web/src/components/CountryWeatherExplorer.tsx",
    '    if (scrollOnMobile && window.matchMedia("(max-width: 1023px)").matches) {',
    '    if (\n      scrollOnMobile &&\n      typeof window.matchMedia === "function" &&\n      window.matchMedia("(max-width: 1023px)").matches\n    ) {',
)

replace_once(
    "apps/web/src/components/country-weather-explorer.test.tsx",
    '  maplibre.markerElements.length = 0;\n  Object.defineProperty(window, "matchMedia", {',
    '  maplibre.markerElements.length = 0;\n  Object.defineProperty(window.URL, "createObjectURL", {\n    configurable: true,\n    value: vi.fn(() => "blob:maplibre-test-worker"),\n  });\n  Object.defineProperty(window.URL, "revokeObjectURL", {\n    configurable: true,\n    value: vi.fn(),\n  });\n  Object.defineProperty(window, "matchMedia", {',
)

smoke = Path(".github/workflows/production-smoke.yml")
text = smoke.read_text(encoding="utf-8")
replacements = [
    (
        '          fetch_and_match "English homepage" "${SITE_URL}/" /tmp/home-en.html \\\n            "Dates fixed." "Where is it least likely to rain?" "Find 3 dry-weather destinations"',
        '          fetch_and_match "English homepage" "${SITE_URL}/" /tmp/home-en.html \\\n            "Pick a country. See where the weather looks better." "Choose a country" "Open weather map"',
    ),
    (
        '          fetch_and_match "English country direct trip action" "${SITE_URL}/jp" /tmp/weather-en-country.html \\\n            "Japan" \'data-direct-trip-action="enabled"\'',
        '          fetch_and_match "English country weather map" "${SITE_URL}/jp" /tmp/weather-en-country.html \\\n            "Japan travel weather at a glance" "Popular destinations at a glance" "Next 7 days"',
    ),
    (
        '          fetch_and_match "Traditional homepage" "${SITE_URL}/zh-hant" /tmp/home-hant.html \\\n            "未來14天 · 少雨目的地決策" "日期定了，去哪裡更不容易下雨？" \\\n            "找 3 個少雨目的地"',
        '          fetch_and_match "Traditional homepage" "${SITE_URL}/zh-hant" /tmp/home-hant.html \\\n            "選擇一個國家，一張圖看懂哪裡天氣更好。" "選擇國家" "打開天氣地圖"',
    ),
    (
        '          fetch_and_match "Traditional country weather route" "${SITE_URL}/zh-hant/jp" /tmp/weather-hant-country.html \\\n            "國家旅行天氣地圖" "地圖上比較全部旅遊城市" "日本"',
        '          fetch_and_match "Traditional country weather route" "${SITE_URL}/zh-hant/jp" /tmp/weather-hant-country.html \\\n            "一張圖看懂日本哪裡天氣更好" "熱門旅遊地天氣一目了然" "未來 7 天"',
    ),
    (
        '          fetch_and_match "Simplified homepage" "${SITE_URL}/zh-cn" /tmp/home-cn.html \\\n            "未来14天 · 少雨目的地决策" "日期定了，去哪里更不容易下雨？" \\\n            "找 3 个少雨目的地"',
        '          fetch_and_match "Simplified homepage" "${SITE_URL}/zh-cn" /tmp/home-cn.html \\\n            "选择一个国家，一张图看懂哪里天气更好。" "选择国家" "打开天气地图"',
    ),
    (
        '          fetch_and_match "Simplified country weather route" "${SITE_URL}/zh-cn/jp" /tmp/weather-cn-country.html \\\n            "国家旅行天气地图" "地图上比较全部旅游城市" "日本" \'data-direct-trip-action="enabled"\'',
        '          fetch_and_match "Simplified country weather route" "${SITE_URL}/zh-cn/jp" /tmp/weather-cn-country.html \\\n            "一张图看懂日本哪里天气更好" "热门旅游地天气一目了然" "未来 7 天"',
    ),
]
for old, new in replacements:
    if old not in text:
        raise RuntimeError(f"production smoke block not found: {old[:90]!r}")
    text = text.replace(old, new, 1)
smoke.write_text(text, encoding="utf-8")

analytics_readme = Path("tooling/analytics/README.md")
analytics_text = analytics_readme.read_text(encoding="utf-8")
section = """

## Country-map funnel

`country-map-funnel.sql` is the active product query after the country-first cutover. It aggregates
homepage map entry, country selection, country-map views and city interactions. Legacy discovery
queries remain available for compatibility analysis, but no longer define the primary product
funnel.
"""
if "## Country-map funnel" not in analytics_text:
    analytics_readme.write_text(analytics_text.rstrip() + section, encoding="utf-8")
