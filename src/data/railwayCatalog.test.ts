import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultVisibleRailwayIds,
  findRailwayCatalogLine,
  identifyKeikyuRailway,
  railwayFilterOptions,
  RAILWAY_CATALOG,
} from "./railwayCatalog.ts";

const CASES = [
  {
    id: "main",
    title: "本線",
    stations: ["泉岳寺", "品川", "横浜", "浦賀"],
  },
  {
    id: "airport",
    title: "空港線",
    stations: ["京急蒲田", "天空橋", "羽田空港第1・第2ターミナル"],
  },
  {
    id: "daishi",
    title: "大師線",
    stations: ["京急川崎", "川崎大師", "小島新田"],
  },
  {
    id: "zushi",
    title: "逗子線",
    stations: ["金沢八景", "六浦", "逗子・葉山"],
  },
  {
    id: "kurihama",
    title: "久里浜線",
    stations: ["堀ノ内", "京急久里浜", "三崎口"],
  },
] as const;

test("京急の対象路線を5件だけ保持する", () => {
  assert.equal(RAILWAY_CATALOG.length, 5);
  assert.deepEqual(
    RAILWAY_CATALOG.map((line) => line.id),
    ["main", "airport", "daishi", "zushi", "kurihama"],
  );
});

test("実レスポンス相当の title と stationOrder から5路線を識別する", () => {
  for (const item of CASES) {
    assert.equal(
      identifyKeikyuRailway({
        title: item.title,
        stationTitles: item.stations,
      })?.id,
      item.id,
    );
  }
});

test("推測した odpt.Railway ID だけでは路線を採用しない", () => {
  assert.equal(
    findRailwayCatalogLine(
      "odpt.Railway:Keikyu.Main",
      "本線",
      ["架空駅A", "架空駅B"],
    ),
    null,
  );
  assert.equal(
    findRailwayCatalogLine(
      "odpt.Railway:Keikyu.Airport",
      "未知の路線",
      ["京急蒲田", "羽田空港第1・第2ターミナル"],
    ),
    null,
  );
});

test("路線名が同じでも stationOrder の両端根拠が不足すれば採用しない", () => {
  assert.equal(
    identifyKeikyuRailway({
      title: "久里浜線",
      stationTitles: ["堀ノ内", "京急久里浜"],
    }),
    null,
  );
});

test("利用可能な5路線だけを選択肢として有効化する", () => {
  const options = railwayFilterOptions(
    new Set(["main", "airport", "daishi", "zushi", "kurihama"]),
  );
  assert.equal(options.length, 5);
  assert.ok(options.every((option) => option.available));
});

test("初期表示は利用可能な先頭路線を1件だけ選ぶ", () => {
  const all = railwayFilterOptions(
    new Set(["main", "airport", "daishi", "zushi", "kurihama"]),
  );
  assert.deepEqual([...defaultVisibleRailwayIds(all)], ["main"]);

  const branchOnly = railwayFilterOptions(new Set(["zushi", "kurihama"]));
  assert.deepEqual([...defaultVisibleRailwayIds(branchOnly)], ["zushi"]);
});

test("京急本線に品川〜泉岳寺の対象外注記を持つ", () => {
  const main = RAILWAY_CATALOG.find((line) => line.id === "main");
  assert.match(main?.coverageNote ?? "", /品川〜泉岳寺/);
});
