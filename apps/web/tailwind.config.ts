import type { Config } from "tailwindcss";
import preset from "@wnr/tailwind-config";

const config: Config = {
  presets: [preset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/*/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        foreground: "rgb(var(--wnr-foreground) / <alpha-value>)",
        body: "rgb(var(--wnr-body) / <alpha-value>)",
        muted: "rgb(var(--wnr-muted) / <alpha-value>)",
        primary: "rgb(var(--wnr-primary) / <alpha-value>)",
        border: "rgb(var(--wnr-border) / <alpha-value>)",
        surface: "rgb(var(--wnr-surface) / <alpha-value>)",
        "surface-elevated": "rgb(var(--wnr-surface-elevated) / <alpha-value>)",
        danger: "rgb(var(--wnr-danger) / <alpha-value>)",
        warning: "rgb(var(--wnr-warning) / <alpha-value>)",
      },
      fontSize: {
        body: ["1rem", { lineHeight: "1.5" }],
        "body-small": ["0.875rem", { lineHeight: "1.4" }],
        caption: ["0.75rem", { lineHeight: "1.3" }],
        label: ["0.875rem", { lineHeight: "1.4" }],
        "heading-3": ["1.25rem", { lineHeight: "1.3" }],
      },
      borderRadius: {
        pill: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
