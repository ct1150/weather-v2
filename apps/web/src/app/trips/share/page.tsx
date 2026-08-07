import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SharedTripViewer } from "../../../components/SharedTripViewer";

export const metadata: Metadata = {
  title: "Shared trip · Where Not Rain",
  description: "Read-only shared weather-aware itinerary.",
  robots: { index: false, follow: false },
};

export default function SharedTripPage(): ReactElement {
  return <SharedTripViewer locale="en" />;
}
