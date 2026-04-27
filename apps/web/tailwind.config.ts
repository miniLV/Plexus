import type { Config } from "tailwindcss";

/**
 * Tailwind v3 config for Plexus 1.0.
 *
 * Tokens live in `styles/tokens.css` as space-separated RGB triplets so that
 * Tailwind utilities like `bg-plexus-accent/12` resolve through the
 * `rgb(var(--token) / <alpha-value>)` channel. See ADR-006 for the v3 vs v4
 * decision and ADR-005 for the shadcn vendoring approach.
 */
function rgbVar(name: string): string {
  return `rgb(var(--${name}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        plexus: {
          bg: rgbVar("plexus-bg"),
          surface: rgbVar("plexus-surface"),
          "surface-2": rgbVar("plexus-surface-2"),
          border: rgbVar("plexus-border"),
          "border-strong": rgbVar("plexus-border-strong"),
          text: rgbVar("plexus-text"),
          "text-2": rgbVar("plexus-text-2"),
          "text-3": rgbVar("plexus-text-3"),
          "text-mute": rgbVar("plexus-text-mute"),
          accent: rgbVar("plexus-accent"),
          "accent-2": rgbVar("plexus-accent-2"),
          // Faint accent fill (≈ accent at 13% in dark / 10% in light).
          // Use bg-plexus-accent/12 where you'd reach for this directly.
          "accent-faint": "rgb(var(--plexus-accent) / 0.13)",
          ok: rgbVar("plexus-ok"),
          warn: rgbVar("plexus-warn"),
          err: rgbVar("plexus-err"),
          info: rgbVar("plexus-info"),
          // Back-compat aliases (remove once every page is re-skinned).
          panel: rgbVar("plexus-surface"),
          mute: rgbVar("plexus-text-3"),
        },
      },
      borderRadius: {
        sm: "var(--plexus-radius-sm)",
        DEFAULT: "var(--plexus-radius)",
        md: "var(--plexus-radius-md)",
        lg: "var(--plexus-radius-lg)",
      },
      fontFamily: {
        sans: ["var(--plexus-font-sans-loaded)", "var(--plexus-font-sans)"],
        mono: ["var(--plexus-font-mono)"],
      },
      boxShadow: {
        sm: "var(--plexus-shadow-sm)",
        DEFAULT: "var(--plexus-shadow)",
        lg: "var(--plexus-shadow-lg)",
      },
      transitionTimingFunction: {
        "plexus-out": "var(--plexus-ease-out)",
      },
      transitionDuration: {
        "plexus-fast": "var(--plexus-dur-fast)",
        "plexus-normal": "var(--plexus-dur)",
        "plexus-slow": "var(--plexus-dur-slow)",
      },
      keyframes: {
        "fade-in-0": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "zoom-in-95": {
          "0%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-0": "fade-in-0 var(--plexus-dur) var(--plexus-ease-out)",
        "zoom-in-95": "zoom-in-95 var(--plexus-dur) var(--plexus-ease-out)",
      },
    },
  },
  plugins: [],
};

export default config;
