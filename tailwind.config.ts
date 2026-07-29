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
        // 京急らしい赤を軸にした、落ち着いたダークテーマ
        rail: {
          bg: "#19070a",
          surface: "#270c12",
          border: "#5d1b28",
          accent: "#e60012",
          "accent-dark": "#8f0010",
          text: "#fff7f8",
          muted: "#d9afb6",
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
