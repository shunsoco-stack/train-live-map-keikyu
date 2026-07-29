import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveTrainDirection,
  stationOrderMovement,
} from "./direction.ts";
import {
  buildClampedStationSegment,
  positionOnClampedSegment,
  projectPointToPolyline,
} from "./geometry.ts";
import {
  isShinagawaSengakujiSegment,
  mapKeikyuTrainType,
  mapOdptDelayMinutes,
} from "./trainFields.ts";
import { resolveProviderValue } from "../../services/providerFallback.ts";

const DIRECTION_METADATA = {
  ascendingRailDirection: "odpt.RailDirection:Keikyu.Inbound",
  descendingRailDirection: "odpt.RailDirection:Keikyu.Outbound",
};

test("Railway応答の上り方向IDとの完全一致だけを上りにする", () => {
  assert.equal(
    resolveTrainDirection(
      "odpt.RailDirection:Keikyu.Inbound",
      DIRECTION_METADATA,
    ),
    "inbound",
  );
});

test("Railway応答の下り方向IDとの完全一致だけを下りにする", () => {
  assert.equal(
    resolveTrainDirection(
      "odpt.RailDirection:Keikyu.Outbound",
      DIRECTION_METADATA,
    ),
    "outbound",
  );
});

test("末尾がInboundでもRailway応答に無ければ方向を推測しない", () => {
  assert.equal(
    resolveTrainDirection(
      "odpt.RailDirection:Other.Inbound",
      DIRECTION_METADATA,
    ),
    "unknown",
  );
  assert.equal(resolveTrainDirection(null, DIRECTION_METADATA), "unknown");
});

test("実レスポンスの駅順に沿った移動方向を識別する", () => {
  const order = ["shinagawa", "kamata", "kawasaki", "yokohama"];
  assert.equal(
    stationOrderMovement("kamata", "yokohama", order),
    "increasing",
  );
  assert.equal(
    stationOrderMovement("yokohama", "kamata", order),
    "decreasing",
  );
  assert.equal(
    stationOrderMovement("outside", "kamata", order),
    "unknown",
  );
});

test("駅間推定位置を曲がったポリライン上へ置く", () => {
  const path: [number, number][] = [
    [139.7, 35.5],
    [139.71, 35.51],
    [139.72, 35.5],
  ];
  const segment = buildClampedStationSegment(
    [path],
    [139.7, 35.5],
    [139.72, 35.5],
  );
  assert.ok(segment);
  const midpoint = positionOnClampedSegment(segment.coordinates, 0.5);
  assert.ok(midpoint);
  const projection = projectPointToPolyline(midpoint, path);
  assert.ok(projection);
  assert.ok(projection.distanceToLineMeters < 0.01);
  assert.ok(midpoint[1] > 35.5, "単純な駅間直線ではなく曲線上にある");
});

test("駅間フラクションを0〜1へクランプし線路外へ出さない", () => {
  const path: [number, number][] = [
    [139.7, 35.5],
    [139.71, 35.51],
    [139.72, 35.5],
  ];
  assert.deepEqual(positionOnClampedSegment(path, -10), path[0]);
  assert.deepEqual(positionOnClampedSegment(path, 10), path[2]);
});

test("異なるMultiLineString pathにある駅を直線で結ばない", () => {
  const paths: [number, number][][] = [
    [
      [139.7, 35.5],
      [139.71, 35.5],
    ],
    [
      [140.7, 36.5],
      [140.71, 36.5],
    ],
  ];
  assert.equal(
    buildClampedStationSegment(
      paths,
      [139.7, 35.5],
      [140.71, 36.5],
      500,
    ),
    null,
  );
});

test("品川〜泉岳寺の両endpointだけを提供対象外として判定する", () => {
  assert.equal(isShinagawaSengakujiSegment("品川", "泉岳寺"), true);
  assert.equal(isShinagawaSengakujiSegment("泉岳寺駅", "品川駅"), true);
  assert.equal(isShinagawaSengakujiSegment("品川", "北品川"), false);
  assert.equal(isShinagawaSengakujiSegment("品川", "未知"), false);
});

test("delayフィールド欠落時は架空の0分を付けない", () => {
  assert.equal(mapOdptDelayMinutes(undefined), null);
  assert.equal(mapOdptDelayMinutes(Number.NaN), null);
  assert.equal(mapOdptDelayMinutes(0), 0);
  assert.equal(mapOdptDelayMinutes(300), 5);
});

test("未知の列車種別を普通へ推測しない", () => {
  assert.equal(
    mapKeikyuTrainType("odpt.TrainType:Keikyu.Local"),
    "local",
  );
  assert.equal(
    mapKeikyuTrainType("odpt.TrainType:Keikyu.RapidLimitedExpress"),
    "rapid_limited_express",
  );
  assert.equal(
    mapKeikyuTrainType("odpt.TrainType:Keikyu.FutureType"),
    "unknown",
  );
  assert.equal(
    mapKeikyuTrainType(
      "odpt.TrainType:Keikyu.FutureIdentifier",
      "エアポート快特",
    ),
    "airport_rapid_limited_express",
  );
  assert.equal(mapKeikyuTrainType(undefined), "unknown");
});

test("実API失敗時はモックへフォールバックする", async () => {
  const result = await resolveProviderValue(
    async () => {
      throw new Error("API failed");
    },
    async () => ["mock"],
  );
  assert.deepEqual(result.value, ["mock"]);
  assert.equal(result.source, "mock");
  assert.equal(result.fallback, true);
  assert.equal(result.reason, "request-failed");
});

test("実APIが0列車ならモックへフォールバックする", async () => {
  const result = await resolveProviderValue(
    async () => [] as string[],
    async () => ["mock"],
    (trains) => trains.length === 0,
  );
  assert.deepEqual(result.value, ["mock"]);
  assert.equal(result.source, "mock");
  assert.equal(result.fallback, true);
  assert.equal(result.reason, "empty");
});
