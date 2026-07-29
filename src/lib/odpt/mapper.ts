import { getRailwayCatalogLine } from "../../data/railwayCatalog.ts";
import { KEIKYU_OPERATOR_ID } from "./config.ts";
import { resolveTrainDirection } from "./direction.ts";
import {
  buildClampedStationSegment,
  isFiniteLngLat,
  positionOnClampedSegment,
  projectStationToPaths,
  snapPointToClampedSegment,
} from "./geometry.ts";
import type {
  OdptNetworkContext,
  OdptOrderedStation,
  OdptRailwayContext,
} from "@/lib/odpt/network";
import {
  pickOdptText,
  type OdptTrain,
  type OdptTrainInformation,
} from "./types.ts";
import {
  isExcludedSengakujiTrainPosition,
  isShinagawaSengakujiSegment,
  mapKeikyuTrainType,
  mapOdptDelayMinutes,
} from "./trainFields.ts";
import type {
  ServiceStatus,
  TrainLocation,
} from "@/types/train";
import type { LngLat } from "@/types/geo";

export {
  isExcludedSengakujiTrainPosition,
  isShinagawaSengakujiSegment,
  mapKeikyuTrainType,
  mapOdptDelayMinutes,
} from "./trainFields.ts";

const BETWEEN_STATION_RATIO = 0.5;
/** 実測速度ではなく、地図上の連続補間だけに使う。 */

function isExpired(valid: string | undefined, nowMs = Date.now()): boolean {
  if (!valid) return false;
  const validUntil = Date.parse(valid);
  return Number.isFinite(validUntil) && validUntil <= nowMs;
}

function isValidTimestamp(value: string | undefined): value is string {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function orderedStation(
  railway: OdptRailwayContext,
  stationId: string,
): OdptOrderedStation | null {
  const index = railway.stationIndexByOdptId.get(stationId);
  return index === undefined ? null : (railway.stationOrder[index] ?? null);
}

function destinationLabel(
  destinations: string | Array<string | null> | undefined,
  destinationTitles:
    | Parameters<typeof pickOdptText>[0]
    | Array<Parameters<typeof pickOdptText>[0]>
    | undefined,
  network: OdptNetworkContext,
): string | null {
  if (destinationTitles) {
    const titleValues = Array.isArray(destinationTitles)
      ? destinationTitles
      : [destinationTitles];
    const titles = titleValues
      .map((title) => pickOdptText(title).trim())
      .filter(Boolean);
    if (titles.length === titleValues.length && titles.length > 0) {
      return titles.join("・");
    }
  }
  if (!destinations || destinations.length === 0) return null;
  const values = Array.isArray(destinations)
    ? destinations
    : [destinations];
  const ids = values.filter(
    (stationId): stationId is string =>
      typeof stationId === "string" && stationId.length > 0,
  );
  if (ids.length !== values.length || ids.length === 0) return null;

  const labels = ids.map((stationId) => {
    const station = network.stationByOdptId.get(stationId);
    if (station?.name) return station.name;
    for (const railway of network.railwayByOdptId.values()) {
      const ordered = orderedStation(railway, stationId);
      if (ordered?.name) return ordered.name;
    }
    return null;
  });
  return labels.every((label): label is string => label !== null)
    ? labels.join("・")
    : null;
}

function trainIdentity(train: OdptTrain, railwayId: string): {
  id: string;
  number: string;
} {
  const number =
    train["odpt:trainNumber"] ??
    train["owl:sameAs"]?.split(".").pop() ??
    "—";
  return {
    id:
      train["owl:sameAs"] ??
      train["@id"] ??
      `${railwayId}:${number}:${train["dc:date"] ?? ""}`,
    number,
  };
}

function actualTrainPoint(train: OdptTrain): LngLat | null {
  const candidate: unknown = [train["geo:long"], train["geo:lat"]];
  return isFiniteLngLat(candidate) ? candidate : null;
}

/**
 * ODPT 列車1件を変換する。
 *
 * - 対象路線・駅は実レスポンスで識別済みのものだけ
 * - 直通先など、from/to の一方が京急線内駅でない場合は非表示
 * - 列車座標は必ず ug:region の駅間ポリライン上
 */
export function odptTrainToNetworkTrainLocation(
  train: OdptTrain,
  network: OdptNetworkContext,
): TrainLocation | null {
  if (
    train["odpt:operator"] &&
    train["odpt:operator"] !== KEIKYU_OPERATOR_ID
  ) {
    return null;
  }
  if (!isValidTimestamp(train["dc:date"])) return null;
  if (isExpired(train["dct:valid"] ?? train["odpt:valid"])) return null;

  const railwayId = train["odpt:railway"] ?? "";
  const railway = network.railwayByOdptId.get(railwayId);
  if (!railway || railway.paths.length === 0) return null;
  const catalog = getRailwayCatalogLine(railway.catalogId);
  if (!catalog) return null;

  const fromStationId = train["odpt:fromStation"];
  if (!fromStationId) return null;
  const fromStation = orderedStation(railway, fromStationId);
  if (!fromStation?.position) return null;

  const toStationId = train["odpt:toStation"] ?? null;
  const toStation = toStationId
    ? orderedStation(railway, toStationId)
    : null;
  // toStation が与えられているのに線内 stationOrder に無ければ直通区間を推測しない。
  if (toStationId && !toStation) return null;
  if (toStationId && !toStation?.position) return null;

  if (
    isExcludedSengakujiTrainPosition(
      fromStation.name,
      toStation?.name ?? null,
    )
  ) {
    return null;
  }

  if (
    toStation &&
    isShinagawaSengakujiSegment(fromStation.name, toStation.name)
  ) {
    return null;
  }

  let position: LngLat | null = null;
  let routeSegment: TrainLocation["routeSegment"] = null;

  if (toStation?.position) {
    const segment = buildClampedStationSegment(
      railway.paths,
      fromStation.position,
      toStation.position,
    );
    if (!segment) return null;

    const actual = actualTrainPoint(train);
    position = actual
      ? snapPointToClampedSegment(actual, segment.coordinates)
      : positionOnClampedSegment(segment.coordinates, BETWEEN_STATION_RATIO);
    if (!position) return null;

    routeSegment = {
      fromFraction: 0,
      toFraction: 1,
      coordinates: segment.coordinates,
    };
  } else {
    const projection = projectStationToPaths(
      railway.paths,
      fromStation.position,
    );
    if (!projection) return null;
    position = projection.coordinate;
  }

  const { id, number } = trainIdentity(train, railwayId);
  const delayMinutes = mapOdptDelayMinutes(train["odpt:delay"]);
  const lastUpdatedAt = train["dc:date"];

  return {
    id,
    lineId: catalog.id,
    lineName: catalog.name,
    lineColor: railway.color || catalog.color,
    trainNumber: number,
    direction: resolveTrainDirection(train["odpt:railDirection"], {
      ascendingRailDirection: railway.ascendingRailDirection,
      descendingRailDirection: railway.descendingRailDirection,
    }),
    destination: destinationLabel(
      train["odpt:destinationStation"],
      train["odpt:destinationStationTitle"],
      network,
    ),
    trainType: mapKeikyuTrainType(
      train["odpt:trainType"],
      pickOdptText(train["odpt:trainTypeTitle"]),
    ),
    longitude: position[0],
    latitude: position[1],
    delayMinutes,
    speedKmh: null,
    status: delayMinutes !== null && delayMinutes > 0 ? "delayed" : "running",
    lastUpdatedAt,
    stoppedSince: null,
    // 実座標が来ても線形へスナップするため、利用者には駅間推定として示す。
    dataAccuracy: "estimated",
    routeSegment,
  };
}

export function odptTrainsToNetworkTrainLocations(
  trains: readonly OdptTrain[],
  network: OdptNetworkContext,
): TrainLocation[] {
  return trains
    .map((train) => odptTrainToNetworkTrainLocation(train, network))
    .filter((train): train is TrainLocation => train !== null);
}

/** 旧名の互換ラッパー。ネットワークが無い場合は安全に非表示。 */
export function odptTrainToTrainLocation(
  train: OdptTrain,
  network?: OdptNetworkContext,
): TrainLocation | null {
  return network ? odptTrainToNetworkTrainLocation(train, network) : null;
}

/** 旧名の互換ラッパー。 */
export function odptTrainsToTrainLocations(
  trains: readonly OdptTrain[],
  network?: OdptNetworkContext,
): TrainLocation[] {
  return network ? odptTrainsToNetworkTrainLocations(trains, network) : [];
}

function informationTextFields(
  information: OdptTrainInformation,
): string[] {
  return [
    pickOdptText(information["odpt:trainInformationStatus"]),
    pickOdptText(information["odpt:trainInformationKind"]),
    pickOdptText(information["odpt:trainInformationCause"]),
    pickOdptText(information["odpt:trainInformationText"]),
  ]
    .map((value) => value.normalize("NFKC").trim())
    .filter(Boolean);
}

function isCurrentInformationRecord(
  information: OdptTrainInformation,
  nowMs: number,
): boolean {
  const updatedAt = Date.parse(information["dc:date"] ?? "");
  const validUntil = Date.parse(information["dct:valid"] ?? "");
  return (
    Number.isFinite(updatedAt) &&
    Number.isFinite(validUntil) &&
    updatedAt <= nowMs &&
    validUntil > nowMs
  );
}

/**
 * 列車アイコンを泣き顔へ変えてよい、厳格な「全線運転見合わせ」判定。
 *
 * 誤って一部区間の見合わせや一部列車の運休を全列車へ広げないよう、
 * 有効期限が明示された現行レコードの同一文中に「全線」と
 * 「運転見合わせ」の両方がある場合だけ true にする。
 */
export function isExplicitWholeLineSuspension(
  information: OdptTrainInformation,
  nowMs = Date.now(),
): boolean {
  if (!isCurrentInformationRecord(information, nowMs)) return false;

  const fields = informationTextFields(information);
  const combined = fields.join(" ");
  const explicitlyEnded =
    /見合わせ.{0,12}(?:解除|終了)/.test(combined) ||
    /運転(?:を)?再開(?:しました|しております|しています)/.test(
      combined,
    ) ||
    /平常運転/.test(combined);
  if (explicitlyEnded) return false;

  const sentences = fields.flatMap((field) =>
    field.split(/[。．.!！?\n\r]+/),
  );
  return sentences.some((sentence) => {
    const compact = sentence.replace(/[\s、,:：]/g, "");
    if (
      /(?:予定|見込み|可能性|場合|おそれ|恐れ|計画|明日|今後)/.test(
        compact,
      )
    ) {
      return false;
    }
    if (/全線(?:では)?(?:ありません|ない|なく)/.test(compact)) {
      return false;
    }
    return (
      /全線(?:で|にて|において)?(?:の)?(?:現在)?運転(?:を)?見合(?:わせ|せ)(?:て(?:い|おり)ます|中|となっています)?$/.test(
        compact,
      ) ||
      /運転(?:を)?全線(?:で|にて|において)見合(?:わせ|せ)(?:て(?:い|おり)ます|中|となっています)?$/.test(
        compact,
      )
    );
  });
}

export function wholeLineSuspendedRailwayIds(
  information: readonly OdptTrainInformation[],
  nowMs = Date.now(),
): Set<string> {
  const latestState = new Map<
    string,
    { updatedAt: number; suspended: boolean }
  >();
  for (const item of information) {
    if (!isCurrentInformationRecord(item, nowMs)) continue;
    const updatedAt = Date.parse(item["dc:date"] ?? "");
    const suspended = isExplicitWholeLineSuspension(item, nowMs);
    const railwayIds = Array.isArray(item["odpt:railway"])
      ? item["odpt:railway"]
      : [item["odpt:railway"]];
    for (const railwayId of railwayIds) {
      if (!railwayId) continue;
      const current = latestState.get(railwayId);
      if (!current || updatedAt > current.updatedAt) {
        latestState.set(railwayId, { updatedAt, suspended });
      } else if (updatedAt === current.updatedAt) {
        // 同時刻に矛盾する情報がある場合は、泣き顔へ誤変更しない。
        current.suspended = current.suspended && suspended;
      }
    }
  }
  return new Set(
    [...latestState.entries()]
      .filter(([, state]) => state.suspended)
      .map(([railwayId]) => railwayId),
  );
}

/**
 * TrainInformation の取得失敗時は information=null を渡す。
 * その場合は元の列車配列・各アイコン状態を一切変更しない。
 */
export function applyOfficialWholeLineSuspensions(
  trains: readonly TrainLocation[],
  information: readonly OdptTrainInformation[] | null,
  lineIdByOdptRailwayId: ReadonlyMap<string, string>,
  nowMs = Date.now(),
): TrainLocation[] {
  if (information === null) return [...trains];
  const suspendedRailwayIds = wholeLineSuspendedRailwayIds(
    information,
    nowMs,
  );
  if (suspendedRailwayIds.size === 0) return [...trains];
  const suspendedLineIds = new Set(
    [...suspendedRailwayIds]
      .map((railwayId) => lineIdByOdptRailwayId.get(railwayId))
      .filter((lineId): lineId is string => Boolean(lineId)),
  );
  return trains.map((train) =>
    suspendedLineIds.has(train.lineId)
      ? { ...train, status: "suspended" }
      : train,
  );
}

function latestInformation(
  information: readonly OdptTrainInformation[],
): OdptTrainInformation | null {
  const valid = information.filter(
    (item) =>
      isValidTimestamp(item["dc:date"]) &&
      !isExpired(item["dct:valid"]),
  );
  return (
    [...valid].sort((a, b) =>
      (b["dc:date"] ?? "").localeCompare(a["dc:date"] ?? ""),
    )[0] ?? null
  );
}

function informationSeverity(text: string): ServiceStatus["severity"] {
  if (/運転見合わせ|運転を見合わせ|運休|中止|抑止/.test(text)) {
    return "major";
  }
  if (/遅れ|遅延|一部列車|直通運転中止|運転再開|ダイヤ乱れ/.test(text)) {
    return "minor";
  }
  return "normal";
}

export function odptInformationToServiceStatus(
  information: readonly OdptTrainInformation[],
  railwayLabel: string,
  lineId = "main",
): ServiceStatus {
  const latest = latestInformation(information);
  const now = new Date().toISOString();

  if (!latest) {
    return {
      lineId,
      lineName: railwayLabel,
      severity: "normal",
      message: "現在、公式の運行情報メッセージはありません。",
      updatedAt: now,
      dataAccuracy: "actual",
      provenance: "official",
      availability: "not_reported",
    };
  }

  const text = pickOdptText(latest["odpt:trainInformationText"]).trim();
  const status = pickOdptText(
    latest["odpt:trainInformationStatus"],
  ).trim();
  const kind = pickOdptText(latest["odpt:trainInformationKind"]).trim();
  const cause = pickOdptText(latest["odpt:trainInformationCause"]).trim();
  const combined = [status, kind, cause, text].filter(Boolean).join(" ");
  if (!combined) {
    return {
      lineId,
      lineName: railwayLabel,
      severity: "normal",
      message: "現在、公式の運行情報メッセージはありません。",
      updatedAt: latest["dc:date"] ?? latest["odpt:timeOfOrigin"] ?? now,
      dataAccuracy: "actual",
      provenance: "official",
      availability: "not_reported",
    };
  }

  return {
    lineId,
    lineName: railwayLabel,
    severity: informationSeverity(combined),
    message: text || status || kind,
    updatedAt: latest["dc:date"] ?? latest["odpt:timeOfOrigin"] ?? now,
    dataAccuracy: "actual",
    provenance: "official",
    availability: "reported",
  };
}

export function defaultRailwayLabel(): string {
  return "京急本線";
}
