import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { CloudflareAnalytics } from "../components/CloudflareAnalytics";
import { LocaleBootstrap } from "../components/LocaleBootstrap";
import { PwaBootstrap } from "../components/PwaBootstrap";
import { SiteHeader } from "../components/SiteHeader";
import "./globals.css";
import "./country-map.css";
import "./instant-country-map.css";
import "./country-map-refinements.css";
import "./country-select-refinements.css";
import "./world-map.css";

export const metadata: Metadata = {
  title: {
    default: "Where Not Rain — time-driven rain-free travel map",
    template: "%s — Where Not Rain",
  },
  description:
    "Pick this weekend, the next 7 days or custom forecast dates and see which supported countries have more mostly rain-free travel days on one world map.",
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
