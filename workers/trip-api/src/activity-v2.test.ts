import { describe, expect, it } from "vitest";
import { diffRevisionDocuments } from "./revision-diff";

function document(activityTitle: string) {
  return {
    title: "Trip",
    partyProfile: "family",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2026-08-12",
        cityId: "jp-kyoto",
        cityName: "Kyoto",
        countryName: "Japan",
        theme: "outdoor",
        flexible: true,
        activities: [`14:00 ${activityTitle}`],
        activityItems: [
          {
            id: "activity-day-1-1",
            title: activityTitle,
            cityId: "jp-kyoto",
            startTime: "14:00",
            environment: activityTitle.includes("Museum") ? "indoor" : "outdoor",
            weatherSensitivity: activityTitle.includes("Museum") ? [] : ["rain", "heat", "wind"],
            flexibility: "movable",
            reservation: "none",
            priority: "preferred",
          },
        ],
        notes: "",
      },
    ],
  };
}

describe("Workspace v2 revision diff", () => {
  it("records structured activity changes separately from the compatibility text projection", () => {
    const changes = diffRevisionDocuments(
      document("Arashiyama Bamboo Grove"),
      document("Kyoto Railway Museum"),
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "day.activities", dayId: "day-1" }),
        expect.objectContaining({ field: "day.activityItems", dayId: "day-1" }),
      ]),
    );
    const structured = changes.find((item) => item.field === "day.activityItems");
    expect(structured?.before).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Arashiyama Bamboo Grove" })]),
    );
    expect(structured?.after).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Kyoto Railway Museum" })]),
    );
  });

  it("does not emit activity changes when the structured model is unchanged", () => {
    const same = document("Kyoto Railway Museum");
    const changes = diffRevisionDocuments(same, same);
    expect(changes.find((item) => item.field === "day.activityItems")).toBeUndefined();
  });
});
