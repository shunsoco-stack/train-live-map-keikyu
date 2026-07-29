import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOfficialWholeLineSuspensions,
  isExplicitWholeLineSuspension,
  odptTrainToNetworkTrainLocation,
} from "./mapper.ts";
import type { OdptNetworkContext } from "./network.ts";
import type {
  OdptTrain,
  OdptTrainInformation,
} from "./types.ts";
import type { TrainLocation } from "../../types/train.ts";

const NOW_MS = Date.parse("2026-07-30T00:00:00+09:00");
const MAIN_RAILWAY = "odpt.Railway:Keikyu.Main";
const AIRPORT_RAILWAY = "odpt.Railway:Keikyu.Airport";

function information(
  text: string,
  overrides: Partial<OdptTrainInformation> = {},
): OdptTrainInformation {
  return {
    "dc:date": "2026-07-29T23:50:00+09:00",
    "dct:valid": "2026-07-30T00:10:00+09:00",
    "odpt:railway": MAIN_RAILWAY,
    "odpt:trainInformationText": { ja: text },
    ...overrides,
  };
}

function train(id: string, lineId: string): TrainLocation {
  return {
    id,
    lineId,
    lineName: lineId === "main" ? "京急本線" : "空港線",
    lineColor: "#e60012",
    trainNumber: id,
    direction: "outbound",
    destination: null,
    trainType: "unknown",
    latitude: 35.5,
    longitude: 139.7,
    delayMinutes: null,
    speedKmh: null,
    status: "running",
    lastUpdatedAt: "2026-07-29T23:50:00+09:00",
    stoppedSince: null,
    dataAccuracy: "estimated",
    routeSegment: null,
  };
}

test("有効な情報が全線の運転見合わせを明示した時だけ判定する", () => {
  assert.equal(
    isExplicitWholeLineSuspension(
      information("事故のため、全線で運転を見合わせています。"),
      NOW_MS,
    ),
    true,
  );
  assert.equal(
    isExplicitWholeLineSuspension(
      information("全線 運転見合せ"),
      NOW_MS,
    ),
    true,
  );
});

test("一部区間の見合わせや運休を全線見合わせへ拡大しない", () => {
  assert.equal(
    isExplicitWholeLineSuspension(
      information("一部区間で運転を見合わせています。"),
      NOW_MS,
    ),
    false,
  );
  assert.equal(
    isExplicitWholeLineSuspension(
      information("全線で一部列車が運休しています。"),
      NOW_MS,
    ),
    false,
  );
  assert.equal(
    isExplicitWholeLineSuspension(
      information(
        "全線ではありません。一部区間で運転を見合わせています。",
      ),
      NOW_MS,
    ),
    false,
  );
  assert.equal(
    isExplicitWholeLineSuspension(
      information("全線", {
        "odpt:trainInformationStatus": "運転見合わせ",
      }),
      NOW_MS,
    ),
    false,
    "別フィールドの語を連結して明示句を作らない",
  );
  assert.equal(
    isExplicitWholeLineSuspension(
      information("全線ではなく一部区間で運転を見合わせています。"),
      NOW_MS,
    ),
    false,
  );
});

test("将来予定・条件・可能性を現在の全線見合わせへ誤変換しない", () => {
  for (const text of [
    "明日は全線で運転を見合わせる予定です。",
    "台風接近時は全線で運転を見合わせる場合があります。",
    "今後、全線で運転見合わせとなる可能性があります。",
    "全線で運転を見合わせる見込みです。",
  ]) {
    assert.equal(
      isExplicitWholeLineSuspension(information(text), NOW_MS),
      false,
      text,
    );
  }
});

test("期限切れ・有効期限欠落・解除済み情報はアイコンへ反映しない", () => {
  assert.equal(
    isExplicitWholeLineSuspension(
      information("全線で運転を見合わせています。", {
        "dct:valid": "2026-07-29T23:59:59+09:00",
      }),
      NOW_MS,
    ),
    false,
  );
  assert.equal(
    isExplicitWholeLineSuspension(
      information("全線で運転を見合わせています。", {
        "dct:valid": undefined,
      }),
      NOW_MS,
    ),
    false,
  );
  assert.equal(
    isExplicitWholeLineSuspension(
      information("全線の運転見合わせは解除しました。"),
      NOW_MS,
    ),
    false,
  );
  assert.equal(
    isExplicitWholeLineSuspension(
      information("全線で運転を見合わせています。", {
        "dc:date": "2026-07-30T00:00:01+09:00",
      }),
      NOW_MS,
    ),
    false,
  );
});

test("同一路線の新しい解除・非見合わせ情報は古い有効な見合わせより優先する", () => {
  const oldSuspension = information(
    "全線で運転を見合わせています。",
    { "dc:date": "2026-07-29T23:40:00+09:00" },
  );
  const newerRelease = information(
    "全線の運転見合わせは解除しました。",
    { "dc:date": "2026-07-29T23:55:00+09:00" },
  );
  const result = applyOfficialWholeLineSuspensions(
    [train("main-1", "main")],
    [oldSuspension, newerRelease],
    new Map([[MAIN_RAILWAY, "main"]]),
    NOW_MS,
  );
  assert.equal(result[0].status, "running");
});

test("明示された対象路線のライブ列車だけをsuspendedへ変える", () => {
  const main = train("main-1", "main");
  const airport = train("airport-1", "airport");
  const result = applyOfficialWholeLineSuspensions(
    [main, airport],
    [information("全線で運転を見合わせています。")],
    new Map([
      [MAIN_RAILWAY, "main"],
      [AIRPORT_RAILWAY, "airport"],
    ]),
    NOW_MS,
  );
  assert.deepEqual(
    result.map((item) => [item.id, item.status]),
    [
      ["main-1", "suspended"],
      ["airport-1", "running"],
    ],
  );
});

test("TrainInformation取得失敗を表すnullでは列車アイコン状態を変えない", () => {
  const delayed = { ...train("main-1", "main"), status: "delayed" as const };
  const result = applyOfficialWholeLineSuspensions(
    [delayed],
    null,
    new Map([[MAIN_RAILWAY, "main"]]),
    NOW_MS,
  );
  assert.deepEqual(result, [delayed]);
  assert.strictEqual(result[0], delayed);
});

function networkFixture(): OdptNetworkContext {
  const stations = [
    {
      index: 0,
      id: "station:Sengakuji",
      name: "泉岳寺",
      position: [139.74, 35.64] as [number, number],
    },
    {
      index: 1,
      id: "station:Shinagawa",
      name: "品川",
      position: [139.74, 35.63] as [number, number],
    },
    {
      index: 2,
      id: "station:Kitashinagawa",
      name: "北品川",
      position: [139.74, 35.62] as [number, number],
    },
  ];
  const railway = {
    odptId: MAIN_RAILWAY,
    catalogId: "main",
    title: "本線",
    color: "#e60012",
    paths: [
      [
        [139.74, 35.64],
        [139.74, 35.63],
        [139.74, 35.62],
      ] as [number, number][],
    ],
    stationOrder: stations,
    stationIndexByOdptId: new Map(
      stations.map((station, index) => [station.id, index]),
    ),
    ascendingRailDirection: null,
    descendingRailDirection: null,
  };
  return {
    response: {
      lines: [],
      options: [],
      generatedAt: "2026-07-30T00:00:00+09:00",
      source: "odpt",
    },
    stationByOdptId: new Map(),
    catalogIdByOdptRailwayId: new Map([[MAIN_RAILWAY, "main"]]),
    lineByCatalogId: new Map(),
    railwayByOdptId: new Map([[MAIN_RAILWAY, railway]]),
    railwayByCatalogId: new Map([["main", railway]]),
  };
}

function odptTrain(
  fromStation: string,
  toStation: string | null,
): OdptTrain {
  return {
    "owl:sameAs": `train:${fromStation}:${toStation ?? "none"}`,
    "dc:date": "2026-07-29T23:50:00+09:00",
    "dct:valid": "2099-01-01T00:00:00+09:00",
    "odpt:operator": "odpt.Operator:Keikyu",
    "odpt:railway": MAIN_RAILWAY,
    "odpt:fromStation": fromStation,
    "odpt:toStation": toStation,
  };
}

test("from/toのどちらかが泉岳寺なら欠落データを含め表示しない", () => {
  const network = networkFixture();
  assert.equal(
    odptTrainToNetworkTrainLocation(
      odptTrain("station:Sengakuji", null),
      network,
    ),
    null,
  );
  assert.equal(
    odptTrainToNetworkTrainLocation(
      odptTrain("station:Shinagawa", "station:Sengakuji"),
      network,
    ),
    null,
  );
});

test("品川単独または品川〜北品川は提供範囲内として残す", () => {
  const network = networkFixture();
  assert.ok(
    odptTrainToNetworkTrainLocation(
      odptTrain("station:Shinagawa", null),
      network,
    ),
  );
  assert.ok(
    odptTrainToNetworkTrainLocation(
      odptTrain("station:Shinagawa", "station:Kitashinagawa"),
      network,
    ),
  );
});
