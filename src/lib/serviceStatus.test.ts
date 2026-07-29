import assert from "node:assert/strict";
import test from "node:test";
import {
  formatServiceStatusUpdatedAt,
  serviceStatusesForVisibleLines,
} from "./serviceStatus.ts";
import type { ServiceStatus } from "../types/train.ts";

function status(
  lineId: string,
  lineName: string,
  severity: ServiceStatus["severity"] = "normal",
  availability: ServiceStatus["availability"] = "reported",
): ServiceStatus {
  return {
    lineId,
    lineName,
    severity,
    message:
      severity === "normal"
        ? "平常どおり運転しています。"
        : `${lineName}に遅れがでています。`,
    updatedAt: "2026-07-29T00:00:00.000Z",
    dataAccuracy: "actual",
    availability,
    provenance: "official",
  };
}

test("選択していない路線の運行情報を表示しない", () => {
  const result = serviceStatusesForVisibleLines(
    [
      status("main", "京急本線", "minor"),
      status("airport", "空港線"),
    ],
    new Set(["airport"]),
  );
  assert.deepEqual(result.map((item) => item.lineId), ["airport"]);
});

test("複数選択時は異常のある路線だけを重大度順に表示する", () => {
  const result = serviceStatusesForVisibleLines(
    [
      status("main", "京急本線"),
      status("airport", "空港線", "minor"),
      status("daishi", "大師線", "major"),
    ],
    new Set(["main", "airport", "daishi"]),
  );
  assert.deepEqual(
    result.map((item) => item.lineId),
    ["daishi", "airport"],
  );
});

test("複数の選択路線がすべて平常なら1件にまとめる", () => {
  const result = serviceStatusesForVisibleLines(
    [status("zushi", "逗子線"), status("kurihama", "久里浜線")],
    new Set(["zushi", "kurihama"]),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].lineName, "選択中の2路線");
  assert.equal(result[0].message, "すべて平常どおり運転しています。");
});

test("表示路線が空なら運行情報も表示しない", () => {
  assert.deepEqual(
    serviceStatusesForVisibleLines(
      [status("main", "京急本線")],
      new Set(),
    ),
    [],
  );
});

test("公式情報が未発表の路線を平常運転と推測しない", () => {
  const result = serviceStatusesForVisibleLines(
    [
      status("main", "京急本線", "normal", "not_reported"),
      status("airport", "空港線", "normal", "not_reported"),
    ],
    new Set(["main", "airport"]),
  );
  assert.deepEqual(result, []);
});

test("運行情報の更新時刻を日本時間で表示する", () => {
  assert.equal(
    formatServiceStatusUpdatedAt("2026-07-29T00:05:00.000Z"),
    "7/29 09:05",
  );
  assert.equal(formatServiceStatusUpdatedAt("invalid"), "時刻不明");
});
