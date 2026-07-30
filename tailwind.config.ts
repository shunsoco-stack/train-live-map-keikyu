import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 明るい地図を主役にし、京急らしい赤を操作と列車へ絞った配色。
        rail: {
          bg: "#f4f1f2",
          surface: "#fffafb",
          border: "#dfd1d5",
          accent: "#e6002d",
          "accent-dark": "#b80024",
          text: "#2a0c13",
          muted: "#725a61",
        },
        status: {
          running: "#e60012",
          warn: "#eab308",
          danger: "#ef4444",
          suspended: "#7f1d1d",
          unknown: "#6b7280",
        },
      },
      fontFamily: {
        sans: [
          "M PLUS Rounded 1c",
          "Hiragino Maru Gothic ProN",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Hiragino Kaku Gothic ProN",
          "Yu Gothic UI",
          "Noto Sans JP",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
