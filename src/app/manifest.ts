import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Train Live Map｜京急線版（非公式）",
    short_name: "Train Live Map",
    description:
      "京急線5路線の列車位置と運行状況を地図上で確認できる非公式Webアプリ。",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: "#16060a",
    theme_color: "#b5092f",
    categories: ["navigation", "travel"],
    lang: "ja",
    icons: [
      {
        src: "/icons/train-live-map-keikyu-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/train-live-map-keikyu-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/train-live-map-keikyu-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
