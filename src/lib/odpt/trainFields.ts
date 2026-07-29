import type { TrainType } from "@/types/train";

function normalizedStationName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[・･\s]/g, "")
    .replace(/駅$/, "");
}

/** 品川〜泉岳寺はチャレンジ2026の列車位置提供対象外。 */
export function isShinagawaSengakujiSegment(
  fromStationName: string,
  toStationName: string,
): boolean {
  const names = new Set([
    normalizedStationName(fromStationName),
    normalizedStationName(toStationName),
  ]);
  return names.size === 2 && names.has("品川") && names.has("泉岳寺");
}

/**
 * 泉岳寺を端点に含む列車位置は提供範囲外として表示しない。
 * toStation が欠落した泉岳寺停車中データも除外する一方、品川単独は許可する。
 */
export function isExcludedSengakujiTrainPosition(
  fromStationName: string,
  toStationName: string | null,
): boolean {
  return [fromStationName, toStationName]
    .filter((name): name is string => name !== null)
    .some((name) => normalizedStationName(name) === "泉岳寺");
}

const TRAIN_TYPE_BY_SUFFIX: Readonly<Record<string, TrainType>> = {
  local: "local",
  ordinary: "local",
  express: "express",
  airportexpress: "airport_express",
  limitedexpress: "limited_express",
  rapidlimitedexpress: "rapid_limited_express",
  airportlimitedexpress: "airport_rapid_limited_express",
  airportrapidlimitedexpress: "airport_rapid_limited_express",
  wing: "wing",
  morningwing: "wing",
  eveningwing: "wing",
};

const TRAIN_TYPE_BY_TITLE: Readonly<Record<string, TrainType>> = {
  普通: "local",
  各駅停車: "local",
  急行: "express",
  エアポート急行: "airport_express",
  特急: "limited_express",
  快特: "rapid_limited_express",
  快速特急: "rapid_limited_express",
  エアポート快特: "airport_rapid_limited_express",
  モーニングウィング: "wing",
  イブニングウィング: "wing",
  ウィング: "wing",
};

/** 未知の ID を部分一致で普通列車などへ丸めない。 */
export function mapKeikyuTrainType(
  value: string | undefined,
  title?: string,
): TrainType {
  const suffix = value?.split(/[.:]/).pop()?.toLowerCase() ?? "";
  if (TRAIN_TYPE_BY_SUFFIX[suffix]) return TRAIN_TYPE_BY_SUFFIX[suffix];
  const normalizedTitle = title
    ?.normalize("NFKC")
    .replace(/[・･\s]/g, "");
  return (normalizedTitle && TRAIN_TYPE_BY_TITLE[normalizedTitle]) || "unknown";
}

/** フィールド欠落と 0 秒を区別する。 */
export function mapOdptDelayMinutes(
  delaySeconds: number | undefined,
): number | null {
  if (
    typeof delaySeconds !== "number" ||
    !Number.isFinite(delaySeconds) ||
    delaySeconds < 0
  ) {
    return null;
  }
  return Math.max(0, Math.round(delaySeconds / 60));
}
