import type { CountryMapGeometry } from "./country-map-geometry";

const OVERRIDES: Readonly<Record<string, CountryMapGeometry>> = {
  CN: {
    path: "M137,230L175,167L251,135L322,93L407,111L492,83L575,111L659,143L754,176L833,233L799,285L824,347L765,405L679,424L625,479L545,466L474,493L401,457L329,440L270,392L207,366L161,319L124,274L137,230ZM552,529L568,522L583,531L578,546L561,550L549,540L552,529Z",
    minLongitude: 73,
    maxLongitude: 135,
    minLatitude: 17,
    maxLatitude: 54.5,
  },
  TW: {
    path: "M514,76C553,107 579,154 590,205C603,264 585,328 559,384C536,434 508,487 476,545C443,506 424,458 417,407C408,345 418,278 435,218C452,157 476,105 514,76Z",
    minLongitude: 119.4,
    maxLongitude: 122.2,
    minLatitude: 21.4,
    maxLatitude: 25.7,
  },
};

export function countryMapGeometryOverride(countryId: string): CountryMapGeometry | null {
  return OVERRIDES[countryId.toUpperCase()] ?? null;
}
