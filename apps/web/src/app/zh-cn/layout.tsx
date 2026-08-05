import type { ReactNode } from "react";

export default function SimplifiedChineseLayout({ children }: { children: ReactNode }): ReactNode {
  return <div lang="zh-CN">{children}</div>;
}
