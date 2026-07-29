import type { TrainDirection } from "@/types/train";

export interface RailwayDirectionMetadata {
  ascendingRailDirection: string | null;
  descendingRailDirection: string | null;
}

/**
 * 列車の odpt:railDirection を、同じ odpt:Railway 応答にある上下方向 ID と
 * 完全一致で照合する。ID の末尾や列車番号からは推測しない。
 */
export function resolveTrainDirection(
  railDirection: string | null | undefined,
  metadata: RailwayDirectionMetadata,
): TrainDirection {
  if (!railDirection) return "unknown";
  if (
    metadata.ascendingRailDirection &&
    railDirection === metadata.ascendingRailDirection
  ) {
    return "inbound";
  }
  if (
    metadata.descendingRailDirection &&
    railDirection === metadata.descendingRailDirection
  ) {
    return "outbound";
  }
  return "unknown";
}

export type StationOrderMovement =
  | "increasing"
  | "decreasing"
  | "same"
  | "unknown";

/** from/to が実レスポンスの stationOrder 上でどちらへ進むかだけを返す。 */
export function stationOrderMovement(
  fromStationId: string | null | undefined,
  toStationId: string | null | undefined,
  stationOrder: readonly string[],
): StationOrderMovement {
  if (!fromStationId || !toStationId) return "unknown";
  const fromIndex = stationOrder.indexOf(fromStationId);
  const toIndex = stationOrder.indexOf(toStationId);
  if (fromIndex < 0 || toIndex < 0) return "unknown";
  if (fromIndex === toIndex) return "same";
  return toIndex > fromIndex ? "increasing" : "decreasing";
}
