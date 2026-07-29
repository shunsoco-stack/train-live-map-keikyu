import {
  projectPointToPolyline,
  type PolylineProjection,
} from "./odpt/geometry.ts";
import { haversineMeters } from "./geo.ts";
import type { LngLat } from "../types/geo.ts";

export type SnapshotTransitionPath =
  | {
      kind: "animate";
      coordinates: LngLat[];
    }
  | {
      kind: "snap";
      coordinate: LngLat;
    };

function sameCoordinate(a: LngLat, b: LngLat): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function samePolyline(
  first: readonly LngLat[],
  second: readonly LngLat[],
): boolean {
  return (
    first.length === second.length &&
    first.every((coordinate, index) =>
      sameCoordinate(coordinate, second[index]),
    )
  );
}

function deduplicateAdjacent(coordinates: readonly LngLat[]): LngLat[] {
  return coordinates
    .filter(
      (coordinate, index) =>
        index === 0 ||
        !sameCoordinate(coordinate, coordinates[index - 1]),
    )
    .map((coordinate) => [...coordinate] as LngLat);
}

function forwardSlice(
  path: readonly LngLat[],
  start: PolylineProjection,
  end: PolylineProjection,
): LngLat[] {
  const result: LngLat[] = [[...start.coordinate]];
  for (
    let pointIndex = start.segmentIndex + 1;
    pointIndex <= end.segmentIndex;
    pointIndex += 1
  ) {
    result.push([...path[pointIndex]] as LngLat);
  }
  result.push([...end.coordinate]);
  return deduplicateAdjacent(result);
}

function pathBetweenProjections(
  path: readonly LngLat[],
  from: PolylineProjection,
  to: PolylineProjection,
): LngLat[] {
  if (from.distanceAlongMeters <= to.distanceAlongMeters) {
    return forwardSlice(path, from, to);
  }
  return forwardSlice(path, to, from).reverse();
}

function pathLength(coordinates: readonly LngLat[]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += haversineMeters(
      coordinates[index - 1],
      coordinates[index],
    );
  }
  return total;
}

interface TransitionPathInput {
  /** マーカーが現在描画されている座標。 */
  current: LngLat;
  /** 直前の ODPT スナップショットが示した駅間線形。 */
  previousSegment: readonly LngLat[];
  /** 最新の ODPT スナップショットが示した駅間線形。 */
  nextSegment: readonly LngLat[];
  /** 最新スナップショットの推定座標。 */
  target: LngLat;
}

/**
 * スナップショット間を、ODPT が示した駅間ポリラインだけでつなぐ。
 *
 * 駅間が切り替わる場合は「現在点→前駅間の残り→前区間の終点と
 * 完全一致する次区間の始点→目標点」の順で線形を組む。走行方向どおりの
 * 端点接続が無ければ、推測した直線を作らず最新駅間へ安全にスナップする。
 */
export function buildSnapshotTransitionPath({
  current,
  previousSegment,
  nextSegment,
  target,
}: TransitionPathInput): SnapshotTransitionPath | null {
  if (previousSegment.length < 2 || nextSegment.length < 2) return null;

  const currentProjection = projectPointToPolyline(
    current,
    previousSegment,
  );
  const targetProjection = projectPointToPolyline(target, nextSegment);
  if (!currentProjection || !targetProjection) return null;

  if (samePolyline(previousSegment, nextSegment)) {
    if (
      targetProjection.distanceAlongMeters <
      currentProjection.distanceAlongMeters
    ) {
      return {
        kind: "snap",
        coordinate: [...targetProjection.coordinate] as LngLat,
      };
    }
    const coordinates = pathBetweenProjections(
      previousSegment,
      currentProjection,
      targetProjection,
    );
    return coordinates.length >= 2 && pathLength(coordinates) > 0.01
      ? { kind: "animate", coordinates }
      : { kind: "snap", coordinate: targetProjection.coordinate };
  }

  const previousEnd = previousSegment[previousSegment.length - 1];
  const nextStart = nextSegment[0];
  // fromStation→toStation の向きを保ち、前区間の終点から次区間の始点へ
  // 進むケースだけを接続する。別の端点が一致しても逆走はさせない。
  if (!sameCoordinate(previousEnd, nextStart)) {
    return {
      kind: "snap",
      coordinate: [...targetProjection.coordinate] as LngLat,
    };
  }

  const previousEndProjection = projectPointToPolyline(
    previousEnd,
    previousSegment,
  );
  const nextStartProjection = projectPointToPolyline(
    nextStart,
    nextSegment,
  );
  if (!previousEndProjection || !nextStartProjection) {
    return {
      kind: "snap",
      coordinate: [...targetProjection.coordinate] as LngLat,
    };
  }
  const remainingPrevious = pathBetweenProjections(
    previousSegment,
    currentProjection,
    previousEndProjection,
  );
  const enteringNext = pathBetweenProjections(
    nextSegment,
    nextStartProjection,
    targetProjection,
  );
  const coordinates = deduplicateAdjacent([
    ...remainingPrevious,
    ...enteringNext,
  ]);
  if (coordinates.length < 2 || pathLength(coordinates) <= 0.01) {
    return {
      kind: "snap",
      coordinate: [...targetProjection.coordinate] as LngLat,
    };
  }
  return {
    kind: "animate",
    coordinates,
  };
}
