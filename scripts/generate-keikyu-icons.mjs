import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const publicDirectory = path.join(rootDirectory, "public");
const iconDirectory = path.join(publicDirectory, "icons");
const source = path.join(iconDirectory, "train-live-map-keikyu.svg");

await mkdir(iconDirectory, { recursive: true });

const outputs = [
  ["train-live-map-keikyu-192.png", 192],
  ["train-live-map-keikyu-512.png", 512],
];

for (const [fileName, size] of outputs) {
  await sharp(source, { density: 192 })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(iconDirectory, fileName));
}

const maskableForeground = await sharp(source, { density: 192 })
  .resize(410, 410, { fit: "contain" })
  .png()
  .toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: "#c90e2e",
  },
})
  .composite([{ input: maskableForeground, left: 51, top: 51 }])
  .png({ compressionLevel: 9, quality: 100 })
  .toFile(
    path.join(iconDirectory, "train-live-map-keikyu-maskable-512.png"),
  );

await sharp(source, { density: 192 })
  .resize(180, 180, { fit: "cover" })
  .png({ compressionLevel: 9, quality: 100 })
  .toFile(path.join(publicDirectory, "apple-touch-icon.png"));

const ogBackground = Buffer.from(`
  <svg width="1732" height="907" viewBox="0 0 1732 907"
       xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#250008"/>
        <stop offset="0.55" stop-color="#850019"/>
        <stop offset="1" stop-color="#e5183b"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.79" cy="0.42" r="0.56">
        <stop offset="0" stop-color="#fff5ee" stop-opacity="0.32"/>
        <stop offset="1" stop-color="#fff5ee" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="12" stdDeviation="12"
                      flood-color="#210006" flood-opacity="0.65"/>
      </filter>
    </defs>
    <rect width="1732" height="907" fill="url(#bg)"/>
    <rect width="1732" height="907" fill="url(#glow)"/>
    <g fill="none" stroke="#fff5ef" stroke-opacity="0.18"
       stroke-linecap="round">
      <path d="M730 870 C940 680 940 420 1190 230 C1380 86 1530 142 1770 26"
            stroke-width="18" stroke-dasharray="38 22"/>
      <path d="M820 940 C1030 760 1112 570 1398 506 C1540 474 1620 422 1764 318"
            stroke-width="7"/>
    </g>
    <g font-family="'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN',
                    'Yu Gothic UI', sans-serif"
       fill="#fffaf7" filter="url(#shadow)">
      <text x="105" y="278" font-size="112" font-weight="800"
            letter-spacing="-2">Train Live Map</text>
      <text x="110" y="410" font-size="72" font-weight="800">京急線版（非公式）</text>
      <text x="112" y="520" font-size="40" font-weight="700"
            fill="#ffe3df">京急線内の列車位置を、線路上で見やすく。</text>
    </g>
    <rect x="110" y="610" width="440" height="70" rx="35"
          fill="#fff5ef"/>
    <text x="330" y="657" text-anchor="middle"
          font-family="'M PLUS Rounded 1c', 'Yu Gothic UI', sans-serif"
          font-size="29" font-weight="800" fill="#9c001d">
      ODPTライブ・位置は駅間推定
    </text>
  </svg>
`);

const ogIcon = await sharp(source, { density: 192 })
  .resize(590, 590, { fit: "contain" })
  .png()
  .toBuffer();
const ogPath = path.join(
  publicDirectory,
  "og-train-live-map-keikyu.png",
);

await sharp(ogBackground)
  .composite([{ input: ogIcon, left: 1080, top: 158 }])
  .png({ compressionLevel: 9, quality: 100 })
  .toFile(ogPath);
await copyFile(ogPath, path.join(publicDirectory, "og.png"));

console.log(
  "Generated Keikyu edition icon assets (no official logo used).",
);
