import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripInviteViewer } from "../../../components/TripInviteViewer";

export const metadata: Metadata = {
  title: "Trip collaboration invite",
  description: "Accept a private Where Not Rain trip collaboration invitation.",
  robots: { index: false, follow: false },
};

export default function TripInvitePage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <TripInviteViewer locale="en" />
    </main>
  );
}
