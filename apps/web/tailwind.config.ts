import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        plexus: {
          bg: "#0b0d12",
          panel: "#11141b",
          border: "#1f2330",
          text: "#e6e9ef",
          mute: "#8a93a6",
          accent: "#7c5cff",
          ok: "#34d399",
          warn: "#f59e0b",
          err: "#ef4444",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
