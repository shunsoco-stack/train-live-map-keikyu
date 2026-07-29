import assert from "node:assert/strict";
import test from "node:test";
import {
  filterRailwayOptions,
  parseStoredRailwayIds,
  restoreVisibleRailwayIds,
  SELECTION_DEFAULT_VERSION,
  toggleRailwayId,
} from "./railwayPreferences.ts";
import type { RailwayFilterOption } from "../types/railway.ts";

const OPTIONS: RailwayFilterOption[] = [
  {
    id: "main",
    name: "京急本線",
    category: "京急線",
    color: "#e60012",
    aliases: ["本線", "Main Line"],
    available: true,
    coverage: "realtime",
    coverageNote: null,
    kind: "line",
  },
  {
    id: "airport",
    name: "空港線",
    category: "京急線",
    color: "#e60012",
    aliases: ["Airport Line"],
    available: true,
    coverage: "realtime",
    coverageNote: null,
    kind: "line",
  },
  {
    id: "unknown",
    name: "未確認路線",
    category: "確認待ち",
    color: "#666666",
    aliases: [],
    available: false,
    coverage: "unavailable",
    coverageNote: null,
    kind: "line",
  },
];

test("保存した表示路線は現在利用可能なIDだけを復元する", () => {
  const result = restoreVisibleRailwayIds({
    stored: JSON.stringify(["airport", "removed"]),
    storedDefaultVersion: SELECTION_DEFAULT_VERSION,
    availableIds: new Set(["main", "airport"]),
    defaultIds: new Set(["main"]),
  });
  assert.deepEqual([...result], ["airport"]);
});

test("表示路線をすべて隠した空の保存値も選択として維持する", () => {
  const result = restoreVisibleRailwayIds({
    stored: "[]",
    storedDefaultVersion: SELECTION_DEFAULT_VERSION,
    availableIds: new Set(["main", "airport"]),
    defaultIds: new Set(["main"]),
  });
  assert.deepEqual([...result], []);
});

test("保存形式が壊れているか既定版が変わった時は安全な既定路線へ戻す", () => {
  assert.deepEqual(
    [
      ...restoreVisibleRailwayIds({
        stored: "{broken",
        storedDefaultVersion: SELECTION_DEFAULT_VERSION,
        availableIds: new Set(["main", "airport"]),
        defaultIds: new Set(["main"]),
      }),
    ],
    ["main"],
  );
  assert.deepEqual(
    [
      ...restoreVisibleRailwayIds({
        stored: '["airport"]',
        storedDefaultVersion: "old",
        availableIds: new Set(["main", "airport"]),
        defaultIds: new Set(["main"]),
      }),
    ],
    ["main"],
  );
});

test("お気に入り保存値は既知の路線だけを復元する", () => {
  assert.deepEqual(
    [
      ...(parseStoredRailwayIds(
        '["main","removed"]',
        new Set(OPTIONS.map((option) => option.id)),
      ) ?? []),
    ],
    ["main"],
  );
});

test("路線名・別名検索とお気に入りだけの絞り込みを組み合わせる", () => {
  assert.deepEqual(
    filterRailwayOptions(OPTIONS, "Airport", false, new Set()).map(
      (option) => option.id,
    ),
    ["airport"],
  );
  assert.deepEqual(
    filterRailwayOptions(
      OPTIONS,
      "",
      true,
      new Set(["main"]),
    ).map((option) => option.id),
    ["main"],
  );
});

test("路線選択とお気に入りの切替は元のSetを変更しない", () => {
  const selected = new Set(["main"]);
  const added = toggleRailwayId(selected, "airport");
  const removed = toggleRailwayId(added, "main");

  assert.deepEqual([...selected], ["main"]);
  assert.deepEqual([...added], ["main", "airport"]);
  assert.deepEqual([...removed], ["airport"]);
});
