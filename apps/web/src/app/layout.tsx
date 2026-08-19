import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { CloudflareAnalytics } from "../components/CloudflareAnalytics";
import { LocaleBootstrap } from "../components/LocaleBootstrap";
import { PwaBootstrap } from "../components/PwaBootstrap";
import { SiteHeader } from "../components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Where Not Rain — least-rain destination finder",
    template: "%s — Where Not Rain",
  },
  description:
    "Choose travel dates, apply optional weather limits and compare the three destinations with the lowest rain risk.",
  metadataBase: new URL("https://868656.xyz"),
  applicationName: "Where Not Rain",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Where Not Rain",
  },
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
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
