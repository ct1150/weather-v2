// apps/web/src/app/layout.tsx
//
// Root layout for the App Router. Imports the global stylesheet and declares
// site-wide metadata. The static export bakes this into every page.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CloudflareAnalytics } from "../components/CloudflareAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Where Not Rain — travel recommendations",
    template: "%s — Where Not Rain",
  },
  description:
    "Deterministic, explainable destination recommendations from the latest weather and Travel Score.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>
        {children}
        <CloudflareAnalytics />
      </body>
    </html>
  );
}
