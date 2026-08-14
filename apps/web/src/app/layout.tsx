// apps/web/src/app/layout.tsx
//
// Root layout for the App Router. Imports the global stylesheet and declares
// site-wide metadata. The static export bakes this into every page.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CloudflareAnalytics } from "../components/CloudflareAnalytics";
import { LocaleBootstrap } from "../components/LocaleBootstrap";
import { PwaBootstrap } from "../components/PwaBootstrap";
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
  manifest: "/manifest.webmanifest",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Where Not Rain",
  },
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>
        <LocaleBootstrap />
        <PwaBootstrap />
        <SiteHeader />
        {children}
        <CloudflareAnalytics />
      </body>
    </html>
  );
}
