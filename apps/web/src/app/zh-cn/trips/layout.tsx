import type { ReactElement, ReactNode } from "react";
import "../../trip-planner.css";
import "../../trip-workspace.css";

export default function ChineseTripsLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  return <>{children}</>;
}
