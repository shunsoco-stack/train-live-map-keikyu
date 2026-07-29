import type { LngLat } from "@/types/geo";

export const DEFAULT_MAX_STATION_SNAP_METERS = 1_000;

export interface PolylineProjection {
  coordinate: LngLat;
  segmentIndex: number;
  segmentFraction: number;
  distanceAlongMeters: number;
  distanceToLineMeters: number;
  fraction: number;
}

export interface ClampedStationSegment {
  /** fromStation から toStation へ向けた順序の線形。 */
  coordinates: LngLat[];
  fromProjection: PolylineProjection;
  toProjection: PolylineProjection;
  sourcePathIndex: number;
}

interface LocalPolylineIndex {
  points: LngLat[];
  cumulative: number[];
  totalLength: number;
}

function haversineMeters(a: LngLat, b: LngLat): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b[1] - a[1]);
  const longitudeDelta = toRadians(b[0] - a[0]);
  const latitudeA = toRadians(a[1]);
  const latitudeB = toRadians(b[1]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    earthRadiusMeters *
    Math.asin(Math.min(1, Math.sqrt(haversine)))
  );
}

function buildPolylineIndex(points: LngLat[]): LocalPolylineIndex {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] =
      cumulative[index - 1] +
      haversineMeters(points[index - 1], points[index]);
  }
  return {
    points,
    cumulative,
    totalLength: cumulative[cumulative.length - 1] ?? 0,
  };
}

function positionAtFraction(
  index: LocalPolylineIndex,
  fraction: number,
): LngLat {
  const clamped = Math.min(1, Math.max(0, fraction));
  const target = clamped * index.totalLength;
  for (let pointIndex = 1; pointIndex < index.points.length; pointIndex += 1) {
    if (target <= index.cumulative[pointIndex]) {
      const segmentLength =
        index.cumulative[pointIndex] -
        index.cumulative[pointIndex - 1];
      const segmentFraction =
        segmentLength === 0
          ? 0
          : (target - index.cumulative[pointIndex - 1]) /
            segmentLength;
      return interpolate(
        index.points[pointIndex - 1],
        index.points[pointIndex],
        segmentFraction,
      );
    }
  }
  return index.points[index.points.length - 1];
}

export function isFiniteLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

function projectedFractionOnSegment(
  point: LngLat,
  start: LngLat,
  end: LngLat,
): number {
  const referenceLatitude = ((point[1] + start[1] + end[1]) / 3) * (Math.PI / 180);
  const longitudeScale = Math.max(0.01, Math.cos(referenceLatitude));
  const segmentX = (end[0] - start[0]) * longitudeScale;
  const segmentY = end[1] - start[1];
  const pointX = (point[0] - start[0]) * longitudeScale;
  const pointY = point[1] - start[1];
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) return 0;
  return Math.min(
    1,
    Math.max(0, (pointX * segmentX + pointY * segmentY) / lengthSquared),
  );
}

function interpolate(start: LngLat, end: LngLat, fraction: number): LngLat {
  return [
    start[0] + (end[0] - start[0]) * fraction,
    start[1] + (end[1] - start[1]) * fraction,
  ];
}

/** 任意の点をポリライン上の最短点へ投影する。返却座標は必ず線上。 */
export function projectPointToPolyline(
  point: LngLat,
  path: readonly LngLat[],
): PolylineProjection | null {
  if (path.length < 2) return null;
  const mutablePath = path.map((coordinate) => [...coordinate] as LngLat);
  const index = buildPolylineIndex(mutablePath);
  if (index.totalLength <= 0) return null;

  let best: PolylineProjection | null = null;
  for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex += 1) {
    const start = path[segmentIndex];
    const end = path[segmentIndex + 1];
    const segmentFraction = projectedFractionOnSegment(point, start, end);
    const coordinate = interpolate(start, end, segmentFraction);
    const distanceToLineMeters = haversineMeters(point, coordinate);
    const segmentLength =
      index.cumulative[segmentIndex + 1] - index.cumulative[segmentIndex];
    const distanceAlongMeters =
      index.cumulative[segmentIndex] + segmentLength * segmentFraction;
    const projection: PolylineProjection = {
      coordinate,
      segmentIndex,
      segmentFraction,
      distanceAlongMeters,
      distanceToLineMeters,
      fraction: distanceAlongMeters / index.totalLength,
    };

    if (
      !best ||
      projection.distanceToLineMeters < best.distanceToLineMeters
    ) {
      best = projection;
    }
  }
  return best;
}

function sameCoordinate(a: LngLat, b: LngLat): boolean {
  return Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
}

function deduplicateAdjacent(coordinates: LngLat[]): LngLat[] {
  return coordinates.filter(
    (coordinate, index) =>
      index === 0 || !sameCoordinate(coordinate, coordinates[index - 1]),
  );
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

/**
 * 駅座標2点を同一の route GeoJSON path へ投影し、その駅間だけを切り出す。
 * どちらかの駅が線形から離れすぎている場合や別 path にしか載らない場合は
 * 安全のため null を返す。
 */
export function buildClampedStationSegment(
  paths: readonly (readonly LngLat[])[],
  fromStation: LngLat,
  toStation: LngLat,
  maxSnapMeters = DEFAULT_MAX_STATION_SNAP_METERS,
): ClampedStationSegment | null {
  let best:
    | {
        from: PolylineProjection;
        to: PolylineProjection;
        pathIndex: number;
        score: number;
      }
    | undefined;

  paths.forEach((path, pathIndex) => {
    const from = projectPointToPolyline(fromStation, path);
    const to = projectPointToPolyline(toStation, path);
    if (!from || !to) return;
    if (
      from.distanceToLineMeters > maxSnapMeters ||
      to.distanceToLineMeters > maxSnapMeters
    ) {
      return;
    }
    const score = from.distanceToLineMeters + to.distanceToLineMeters;
    if (!best || score < best.score) {
      best = { from, to, pathIndex, score };
    }
  });

  if (!best) return null;
  const selected = best as {
    from: PolylineProjection;
    to: PolylineProjection;
    pathIndex: number;
    score: number;
  };
  if (
    Math.abs(
      selected.from.distanceAlongMeters - selected.to.distanceAlongMeters,
    ) < 0.5
  ) {
    return null;
  }

  const coordinates = pathBetweenProjections(
    paths[selected.pathIndex],
    selected.from,
    selected.to,
  );
  if (coordinates.length < 2) return null;

  return {
    coordinates,
    fromProjection: selected.from,
    toProjection: selected.to,
    sourcePathIndex: selected.pathIndex,
  };
}

/** 単一駅を最も近い路線 path 上へ投影する。 */
export function projectStationToPaths(
  paths: readonly (readonly LngLat[])[],
  station: LngLat,
  maxSnapMeters = DEFAULT_MAX_STATION_SNAP_METERS,
): PolylineProjection | null {
  const projections = paths
    .map((path) => projectPointToPolyline(station, path))
    .filter((item): item is PolylineProjection => item !== null)
    .sort((a, b) => a.distanceToLineMeters - b.distanceToLineMeters);
  const nearest = projections[0];
  return nearest && nearest.distanceToLineMeters <= maxSnapMeters
    ? nearest
    : null;
}

/** 駅間線形上の位置。fraction は駅間外へ出ないよう 0〜1 にクランプされる。 */
export function positionOnClampedSegment(
  segment: readonly LngLat[],
  fraction: number,
): LngLat | null {
  if (segment.length < 2) return null;
  return positionAtFraction(
    buildPolylineIndex(segment.map((coordinate) => [...coordinate] as LngLat)),
    Math.min(1, Math.max(0, fraction)),
  );
}

/** 実座標がある場合も駅間線形へスナップし、駅間外へ出さない。 */
export function snapPointToClampedSegment(
  point: LngLat,
  segment: readonly LngLat[],
): LngLat | null {
  return projectPointToPolyline(point, segment)?.coordinate ?? null;
}
