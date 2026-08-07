import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SharedTripViewer } from "../../../../../components/SharedTripViewer";

export const metadata: Metadata = {
  title: "分享行程 · Where Not Rain",
  description: "唯讀天氣行程分享。",
  robots: { index: false, follow: false },
};

export default function TraditionalSharedTripPage(): ReactElement {
  return <SharedTripViewer locale="zh-hant" />;
}
