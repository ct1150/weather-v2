// apps/web/src/app/layout.tsx
//
// Root layout for the App Router. Imports the global stylesheet and declares
// site-wide metadata. The static export bakes this into every page.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CloudflareAnalytics } from "../components/CloudflareAnalytics";
import { LocaleBootstrap } from "../components/LocaleBootstrap";
import { SiteHeader } from "../components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Where Not Rain — travel recommendations",
    template: "%s — Where Not Rain",
  },
  description:
    "Compare rain, temperature and Travel Scores across Asian destinations on one map before choosing where and when to travel.",
  metadataBase: new URL("https://868656.xyz"),
  applicationName: "Where Not Rain",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>
        <LocaleBootstrap />
        <SiteHeader />
        {children}
        <CloudflareAnalytics />
      </body>
    </html>
  );
}
