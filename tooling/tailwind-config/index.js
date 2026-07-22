/**
 * Shared Tailwind CSS preset. Consumers extend this via `presets: [preset]`
 * and provide their own `content` globs. Semantic tokens only — no scattered
 * brand color literals (design system, task 12.1 builds on this).
 *
 * @type {import("tailwindcss").Config}
 */
const preset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic marker tokens (Requirement 2.3).
        marker: {
          suitable: "rgb(var(--wnr-marker-suitable) / <alpha-value>)",
          average: "rgb(var(--wnr-marker-average) / <alpha-value>)",
          unsuitable: "rgb(var(--wnr-marker-unsuitable) / <alpha-value>)",
          storm: "rgb(var(--wnr-marker-storm) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};

export default preset;
