import type { ReactNode } from "react";

export default function TraditionalChineseLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return <div lang="zh-Hant">{children}</div>;
}
