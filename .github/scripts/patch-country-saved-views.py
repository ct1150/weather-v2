from pathlib import Path

path = Path("apps/web/src/components/InstantCountryWeatherExplorer.tsx")
text = path.read_text()


def once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"anchor not found: {old[:140]!r}")
    text = text.replace(old, new, 1)


once(
    'import { CountryCompareSheet, type CountryCompareItem } from "./CountryCompareSheet";\nimport {\n  CountryOutlineMap,',
    'import { CountryCompareSheet, type CountryCompareItem } from "./CountryCompareSheet";\nimport { CountrySavedViewsControl } from "./CountrySavedViewsControl";\nimport {\n  CountryOutlineMap,',
)

once(
    '''        <div className="country-map-actions">\n          <button\n            type="button"\n            onClick={() => void copyShareLink()}''',
    '''        <div className="country-map-actions">\n          <CountrySavedViewsControl\n            locale={locale}\n            countryName={country.name}\n            comparedNames={compareSummaries.map((summary) => summary.city.cityName)}\n          />\n          <button\n            type="button"\n            onClick={() => void copyShareLink()}''',
)

path.write_text(text)

test_path = Path("apps/web/src/components/country-weather-explorer.test.tsx")
test = test_path.read_text()

import_anchor = 'import type { CountryWeatherCityViewModel, LocalDate, ScoreViewModel } from "../app/view-models";\n'
if import_anchor not in test:
    raise SystemExit("test import anchor not found")
test = test.replace(
    import_anchor,
    import_anchor + 'import { COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY } from "../country-map/saved-views";\n',
    1,
)

before_anchor = 'beforeEach(() => {\n  window.history.replaceState({}, "", "/jp");\n'
if before_anchor not in test:
    raise SystemExit("beforeEach anchor not found")
test = test.replace(
    before_anchor,
    before_anchor + '  window.localStorage.removeItem(COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY);\n',
    1,
)

anchor = '  it("copies the full shareable country-map state", async () => {'
if anchor not in test:
    raise SystemExit("integration test anchor not found")
new_test = '''  it("saves and restores the complete country-map state locally", () => {\n    renderExplorer();\n\n    fireEvent.click(screen.getByRole("button", { name: "Add Tokyo to compare" }));\n    fireEvent.click(screen.getByRole("button", { name: "Save current view" }));\n\n    const raw = window.localStorage.getItem(COUNTRY_MAP_SAVED_VIEWS_STORAGE_KEY);\n    expect(raw).toContain("cities=tokyo");\n    expect(raw).toContain("Japan · Tokyo");\n\n    fireEvent.click(screen.getByRole("button", { name: "Saved views (1)" }));\n    const dialog = screen.getByRole("dialog", { name: "Saved country maps" });\n    expect(within(dialog).getByText("Japan · Tokyo")).toBeTruthy();\n    expect(within(dialog).getByText(/\\/jp\\?range=7d&cities=tokyo/)).toBeTruthy();\n  });\n\n'''
test = test.replace(anchor, new_test + anchor, 1)
test_path.write_text(test)
