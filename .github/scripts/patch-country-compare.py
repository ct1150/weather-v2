from pathlib import Path

path = Path("apps/web/src/components/InstantCountryWeatherExplorer.tsx")
text = path.read_text()


def once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"anchor not found: {old[:120]!r}")
    text = text.replace(old, new, 1)


once(
    'import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";\nimport { toTraditionalText } from "../trips/traditional";',
    'import { emitProductAnalytics, type BrowserAnalyticsLocale } from "../analytics/browser-events";\nimport {\n  discoveryShortlistFromSearch,\n  MAX_DISCOVERY_SHORTLIST,\n  normalizeDiscoveryShortlist,\n  withDiscoveryShortlist,\n} from "../discovery/discovery-retention";\nimport { toTraditionalText } from "../trips/traditional";',
)
once(
    'import { isMostlyDryTravelDay } from "./rain-day-classification";\nimport {\n  CountryOutlineMap,',
    'import { isMostlyDryTravelDay } from "./rain-day-classification";\nimport { CountryCompareSheet, type CountryCompareItem } from "./CountryCompareSheet";\nimport {\n  CountryOutlineMap,',
)

for old, new in [
    (
        '    copyFailed: "Copy unavailable",\n',
        '    copyFailed: "Copy unavailable",\n    addToCompare: (name: string) => `Add ${name} to compare`,\n    removeFromCompare: (name: string) => `Remove ${name} from compare`,\n    compareFull: "You can compare up to 3 destinations.",\n',
    ),
    (
        '    copyFailed: "暂时无法复制",\n',
        '    copyFailed: "暂时无法复制",\n    addToCompare: (name: string) => `加入对比：${name}`,\n    removeFromCompare: (name: string) => `移出对比：${name}`,\n    compareFull: "最多同时对比 3 个目的地。",\n',
    ),
    (
        '    copyFailed: "暫時無法複製",\n',
        '    copyFailed: "暫時無法複製",\n    addToCompare: (name: string) => `加入比較：${name}`,\n    removeFromCompare: (name: string) => `移出比較：${name}`,\n    compareFull: "最多同時比較 3 個目的地。",\n',
    ),
]:
    once(old, new)

once(
    '  const [selectedCityId, setSelectedCityId] = useState("");\n  const [shareStatus, setShareStatus] = useState("");',
    '  const [selectedCityId, setSelectedCityId] = useState("");\n  const [shareStatus, setShareStatus] = useState("");\n  const [compareCityIds, setCompareCityIds] = useState<ReadonlyArray<string>>([]);\n  const [compareOpen, setCompareOpen] = useState(false);\n  const [compareStatus, setCompareStatus] = useState("");',
)

once('      "theme",\n      "cities",\n', '      "theme",\n')

once(
    '      const city = params.get("city") ?? "";\n      setSelectedCityId(cities.some((item) => item.cityId === city) ? city : "");',
    '      const city = params.get("city") ?? "";\n      setSelectedCityId(cities.some((item) => item.cityId === city) ? city : "");\n      setCompareCityIds(\n        discoveryShortlistFromSearch(params).filter((id) => cities.some((item) => item.cityId === id)),\n      );',
)

once(
    '  function selectMarker(markerId: string): void {\n    const summary = summaries.find((item) => item.city.cityId === markerId);\n    if (summary !== undefined) selectCity(summary);\n  }',
    '''  function persistCompare(values: ReadonlyArray<string>): void {\n    const normalized = normalizeDiscoveryShortlist(values).filter((id) =>\n      cities.some((item) => item.cityId === id),\n    );\n    setCompareCityIds(normalized);\n    const next = withDiscoveryShortlist(new URLSearchParams(window.location.search), normalized);\n    const query = next.toString();\n    window.history.replaceState({}, "", `${window.location.pathname}${query.length > 0 ? `?${query}` : ""}`);\n  }\n\n  function toggleCompare(summary: CitySummary): void {\n    const id = summary.city.cityId;\n    if (compareCityIds.includes(id)) {\n      persistCompare(compareCityIds.filter((value) => value !== id));\n      setCompareStatus("");\n      return;\n    }\n    if (compareCityIds.length >= MAX_DISCOVERY_SHORTLIST) {\n      setCompareStatus(copy.compareFull);\n      return;\n    }\n    persistCompare([...compareCityIds, id]);\n    emitProductAnalytics({\n      locale,\n      routeTemplate: "/[country]",\n      fields: { event: "destination_shortlisted", destination_id: id },\n    });\n    setCompareStatus("");\n  }\n\n  function selectMarker(markerId: string): void {\n    const summary = summaries.find((item) => item.city.cityId === markerId);\n    if (summary !== undefined) selectCity(summary);\n  }''',
)

once(
    '  const selectedReferenceDays =\n    cities[0] === undefined ? [] : daysForIndices(cities[0], selectedIndices);',
    '''  const selectedReferenceDays =\n    cities[0] === undefined ? [] : daysForIndices(cities[0], selectedIndices);\n  const compareSummaries = compareCityIds\n    .map((id) => summaries.find((summary) => summary.city.cityId === id))\n    .filter((summary): summary is CitySummary => summary !== undefined);''',
)

once(
    '            <a href={cityDetailHref(selected.city.path)} className="country-detail-link focus-ring">',
    '''            <div className="mt-4 flex flex-wrap items-center gap-2">\n              <button\n                type="button"\n                onClick={() => toggleCompare(selected)}\n                className="country-detail-link focus-ring"\n                aria-pressed={compareCityIds.includes(selected.city.cityId)}\n              >\n                {compareCityIds.includes(selected.city.cityId)\n                  ? copy.removeFromCompare(selected.city.cityName)\n                  : copy.addToCompare(selected.city.cityName)}\n              </button>\n              {compareStatus ? <span className="text-xs font-semibold text-accent">{compareStatus}</span> : null}\n            </div>\n            <a href={cityDetailHref(selected.city.path)} className="country-detail-link focus-ring">''',
)

once(
    '      </div>\n\n      <section className="country-city-list-section" aria-labelledby="country-destination-list">',
    '''      </div>\n\n      <CountryCompareSheet\n        locale={locale}\n        items={compareSummaries.map((summary): CountryCompareItem => ({\n          id: summary.city.cityId,\n          name: summary.city.cityName,\n          symbol: summary.symbol,\n          rainHeadline: lowerRainHeadline(summary, locale),\n          totalRainMm: summary.totalRainMm,\n          maxRain: summary.maxRain,\n          temperatureMin: summary.temperatureMin,\n          temperatureMax: summary.temperatureMax,\n          maxWind: summary.maxWind,\n          detailHref: cityDetailHref(summary.city.path),\n          days: summary.days.map((day) => ({\n            localDate: day.localDate,\n            conditionLabel: conditionLabel(day.weather.conditionLabel, locale),\n            rainProbability: day.weather.rainProbability,\n            temperatureMin: day.weather.temperatureMin,\n            temperatureMax: day.weather.temperatureMax,\n          })),\n        }))}\n        maxItems={MAX_DISCOVERY_SHORTLIST}\n        open={compareOpen}\n        onOpen={() => setCompareOpen(true)}\n        onClose={() => setCompareOpen(false)}\n        onRemove={(id) => persistCompare(compareCityIds.filter((value) => value !== id))}\n        onClear={() => {\n          persistCompare([]);\n          setCompareOpen(false);\n        }}\n      />\n\n      <section className="country-city-list-section" aria-labelledby="country-destination-list">''',
)

path.write_text(text)

test_path = Path("apps/web/src/components/country-weather-explorer.test.tsx")
test = test_path.read_text()
anchor = '  it("copies the full shareable country-map state", async () => {'
if anchor not in test:
    raise SystemExit("test anchor not found")
new_test = '''  it("compares destinations side by side without leaving the country map", () => {\n    renderExplorer();\n\n    fireEvent.click(screen.getByRole("button", { name: "Add Tokyo to compare" }));\n    const osakaMarker = screen\n      .getAllByTestId("country-weather-marker")\n      .find((item) => item.getAttribute("data-city-id") === "osaka");\n    expect(osakaMarker).toBeDefined();\n    fireEvent.click(osakaMarker!);\n    fireEvent.click(screen.getByRole("button", { name: "Add Osaka to compare" }));\n\n    expect(window.location.search).toContain("cities=tokyo%2Cosaka");\n    fireEvent.click(screen.getByRole("button", { name: "Compare 2 destinations" }));\n\n    const dialog = screen.getByRole("dialog", { name: "Compare destinations" });\n    expect(within(dialog).getAllByText("Tokyo").length).toBeGreaterThan(0);\n    expect(within(dialog).getAllByText("Osaka").length).toBeGreaterThan(0);\n    expect(within(dialog).getByText("Rain outlook")).toBeTruthy();\n    expect(window.location.pathname).toBe("/jp");\n  });\n\n'''
test_path.write_text(test.replace(anchor, new_test + anchor, 1))
