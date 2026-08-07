import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TripInviteViewer } from "../../../../components/TripInviteViewer";

export const metadata: Metadata = {
  title: { absolute: "行程协作邀请 - Where Not Rain" },
  description: "接受私密的 Where Not Rain 行程协作邀请。",
  robots: { index: false, follow: false },
};

export default function SimplifiedTripInvitePage(): ReactElement {
  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <TripInviteViewer locale="zh-cn" />
    </main>
  );
}
