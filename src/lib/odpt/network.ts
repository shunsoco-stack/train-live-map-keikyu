import { MOCK_KEIKYU_LINES } from "@/data/routeLine";
import {
  identifyKeikyuRailway,
  railwayFilterOptions,
} from "@/data/railwayCatalog";
import { fetchOdptRailways, fetchOdptStations } from "@/lib/odpt/api";
import {
  getOdptConfig,
  isOdptConfigured,
  KEIKYU_OPERATOR_ID,
  type OdptConfig,
} from "@/lib/odpt/config";
import { isFiniteLngLat } from "@/lib/odpt/geometry";
import {
  odptEntityId,
  pickOdptText,
  type OdptRailway,
  type OdptStation,
} from "@/lib/odpt/types";
import type { LngLat } from "@/types/geo";
import type {
  RailwaysApiResponse,
  RailwayMapLine,
} from "@/types/railway";

const CACHE_MS = 6 * 60 * 60 * 1_000;
const MAX_RENDER_POINTS_PER_PATH = 600;

export interface OdptStationLookup {
  id: string;
  name: string;
  railwayId: string;
  position: LngLat | null;
}

export interface OdptOrderedStation {
  index: number;
  id: string;
  name: string;
  position: LngLat | null;
}

export interface OdptRailwayContext {
  odptId: string;
  catalogId: string;
  title: string;
  color: string;
  /** ug:region から得た線形。駅座標を直線でつないだ代替線形は入れない。 */
  paths: LngLat[][];
  stationOrder: OdptOrderedStation[];
  stationIndexByOdptId: Map<string, number>;
  ascendingRailDirection: string | null;
  descendingRailDirection: string | null;
}

export interface OdptNetworkContext {
  response: RailwaysApiResponse;
  stationByOdptId: Map<string, OdptStationLookup>;
  catalogIdByOdptRailwayId: Map<string, string>;
  lineByCatalogId: Map<string, RailwayMapLine>;
  railwayByOdptId: Map<string, OdptRailwayContext>;
  railwayByCatalogId: Map<string, OdptRailwayContext>;
}

interface NetworkCache {
  expiresAt: number;
  key: string;
  value: Promise<OdptNetworkContext>;
}

let networkCache: NetworkCache | null = null;

function stationPosition(station: OdptStation): LngLat | null {
  const longitude = station["geo:long"];
  const latitude = station["geo:lat"];
  const direct: unknown = [longitude, latitude];
  if (isFiniteLngLat(direct)) return direct;

  const point = station["ug:region"]?.geometry;
  return point?.type === "Point" && isFiniteLngLat(point.coordinates)
    ? point.coordinates
    : null;
}

function stationLookup(station: OdptStation): OdptStationLookup | null {
  const id = odptEntityId(station);
  if (!id) return null;
  if (
    station["odpt:operator"] &&
    station["odpt:operator"] !== KEIKYU_OPERATOR_ID
  ) {
    return null;
  }

  return {
    id,
    name: pickOdptText(
      station["odpt:stationTitle"],
      station["dc:title"] ?? "",
    ).trim(),
    railwayId: station["odpt:railway"] ?? "",
    position: stationPosition(station),
  };
}

function renderPath(path: LngLat[]): LngLat[] {
  if (path.length <= MAX_RENDER_POINTS_PER_PATH) return path;
  const step = (path.length - 1) / (MAX_RENDER_POINTS_PER_PATH - 1);
  return Array.from({ length: MAX_RENDER_POINTS_PER_PATH }, (_, index) => [
    ...path[Math.round(index * step)],
  ]) as LngLat[];
}

/** ug:region からだけ路線線形を取り出す。 */
export function extractRailwayPaths(railway: OdptRailway): LngLat[][] {
  const geometry = railway["ug:region"]?.geometry;
  const coordinates = geometry?.coordinates;

  if (geometry?.type === "LineString" && Array.isArray(coordinates)) {
    const path = coordinates.filter(isFiniteLngLat);
    return path.length >= 2 ? [path] : [];
  }

  if (geometry?.type === "MultiLineString" && Array.isArray(coordinates)) {
    return coordinates
      .filter(Array.isArray)
      .map((path) => path.filter(isFiniteLngLat))
      .filter((path) => path.length >= 2);
  }

  return [];
}

function orderedStations(
  railway: OdptRailway,
  stationByOdptId: ReadonlyMap<string, OdptStationLookup>,
): OdptOrderedStation[] {
  return [...(railway["odpt:stationOrder"] ?? [])]
    .sort((a, b) => (a["odpt:index"] ?? 0) - (b["odpt:index"] ?? 0))
    .map((entry, arrayIndex) => {
      const id = entry["odpt:station"] ?? "";
      const lookup = stationByOdptId.get(id);
      return {
        index: entry["odpt:index"] ?? arrayIndex + 1,
        id,
        name: pickOdptText(
          entry["odpt:stationTitle"],
          lookup?.name ?? "",
        ).trim(),
        position: lookup?.position ?? null,
      };
    })
    .filter((station) => station.id.length > 0);
}

function validColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function fallbackContext(): OdptNetworkContext {
  const stationByOdptId = new Map<string, OdptStationLookup>();
  const catalogIdByOdptRailwayId = new Map<string, string>();
  const lineByCatalogId = new Map<string, RailwayMapLine>();
  const railwayByOdptId = new Map<string, OdptRailwayContext>();
  const railwayByCatalogId = new Map<string, OdptRailwayContext>();

  for (const mockLine of MOCK_KEIKYU_LINES) {
    const odptId = `mock:railway:${mockLine.id}`;
    const stationOrder: OdptOrderedStation[] = mockLine.stations.map(
      (station, arrayIndex) => {
        const stationId = `mock:station:${mockLine.id}:${station.id}`;
        const position = mockLine.coordinates[station.pointIndex];
        const lookup: OdptStationLookup = {
          id: stationId,
          name: station.name,
          railwayId: odptId,
          position,
        };
        stationByOdptId.set(stationId, lookup);
        return {
          index: arrayIndex + 1,
          id: stationId,
          name: station.name,
          position,
        };
      },
    );
    const line: RailwayMapLine = {
      id: mockLine.id,
      odptId,
      name: mockLine.name,
      color: mockLine.color,
      coordinates: [mockLine.coordinates],
    };
    const railway: OdptRailwayContext = {
      odptId,
      catalogId: mockLine.id,
      title: mockLine.name,
      color: mockLine.color,
      paths: [mockLine.coordinates],
      stationOrder,
      stationIndexByOdptId: new Map(
        stationOrder.map((station, index) => [station.id, index]),
      ),
      ascendingRailDirection: null,
      descendingRailDirection: null,
    };

    catalogIdByOdptRailwayId.set(odptId, mockLine.id);
    lineByCatalogId.set(mockLine.id, line);
    railwayByOdptId.set(odptId, railway);
    railwayByCatalogId.set(mockLine.id, railway);
  }

  const availableIds = new Set(MOCK_KEIKYU_LINES.map((line) => line.id));
  return {
    response: {
      lines: [...lineByCatalogId.values()],
      options: railwayFilterOptions(availableIds),
      generatedAt: new Date().toISOString(),
      source: "fallback",
    },
    stationByOdptId,
    catalogIdByOdptRailwayId,
    lineByCatalogId,
    railwayByOdptId,
    railwayByCatalogId,
  };
}

async function loadNetwork(config: OdptConfig): Promise<OdptNetworkContext> {
  const [railwayResult, stationResult] = await Promise.all([
    fetchOdptRailways(config.operator, config),
    fetchOdptStations(config.operator, config),
  ]);

  const stationByOdptId = new Map<string, OdptStationLookup>();
  for (const station of stationResult.data) {
    const lookup = stationLookup(station);
    if (lookup) stationByOdptId.set(lookup.id, lookup);
  }

  const catalogIdByOdptRailwayId = new Map<string, string>();
  const lineByCatalogId = new Map<string, RailwayMapLine>();
  const railwayByOdptId = new Map<string, OdptRailwayContext>();
  const railwayByCatalogId = new Map<string, OdptRailwayContext>();
  const availableIds = new Set<string>();

  for (const railway of railwayResult.data) {
    if (
      railway["odpt:operator"] &&
      railway["odpt:operator"] !== KEIKYU_OPERATOR_ID
    ) {
      continue;
    }

    const railwayId = odptEntityId(railway);
    if (!railwayId) continue;
    const title = pickOdptText(
      railway["odpt:railwayTitle"],
      railway["dc:title"] ?? "",
    ).trim();
    const stationOrder = orderedStations(railway, stationByOdptId);
    const catalog = identifyKeikyuRailway({
      title,
      stationTitles: stationOrder.map((station) => station.name),
    });
    if (!catalog) continue;

    const paths = extractRailwayPaths(railway);
    const color = validColor(railway["odpt:color"], catalog.color);
    const runtime: OdptRailwayContext = {
      odptId: railwayId,
      catalogId: catalog.id,
      title,
      color,
      paths,
      stationOrder,
      stationIndexByOdptId: new Map(
        stationOrder.map((station, index) => [station.id, index]),
      ),
      ascendingRailDirection:
        railway["odpt:ascendingRailDirection"] ?? null,
      descendingRailDirection:
        railway["odpt:descendingRailDirection"] ?? null,
    };

    availableIds.add(catalog.id);
    catalogIdByOdptRailwayId.set(railwayId, catalog.id);
    railwayByOdptId.set(railwayId, runtime);
    if (!railwayByCatalogId.has(catalog.id)) {
      railwayByCatalogId.set(catalog.id, runtime);
    }

    const existingLine = lineByCatalogId.get(catalog.id);
    if (existingLine) {
      existingLine.coordinates.push(...paths.map(renderPath));
      continue;
    }

    lineByCatalogId.set(catalog.id, {
      id: catalog.id,
      odptId: railwayId,
      name: catalog.name,
      color,
      coordinates: paths.map(renderPath),
    });
  }

  if (railwayByOdptId.size === 0) {
    throw new Error(
      "ODPT の title / stationOrder から京急5路線を識別できませんでした",
    );
  }

  const lines = [...lineByCatalogId.values()].sort((a, b) => {
    const aIndex = MOCK_KEIKYU_LINES.findIndex((line) => line.id === a.id);
    const bIndex = MOCK_KEIKYU_LINES.findIndex((line) => line.id === b.id);
    return aIndex - bIndex;
  });

  return {
    response: {
      lines,
      options: railwayFilterOptions(availableIds),
      generatedAt: new Date().toISOString(),
      source: "odpt",
    },
    stationByOdptId,
    catalogIdByOdptRailwayId,
    lineByCatalogId,
    railwayByOdptId,
    railwayByCatalogId,
  };
}

function cacheKey(config: OdptConfig): string {
  // トークン自体はキャッシュキーにも複製しない（環境変数変更時は再起動する）。
  return `${config.baseUrl}\u0000${config.operator}`;
}

export async function getOdptNetworkContext(
  config: OdptConfig = getOdptConfig(),
): Promise<OdptNetworkContext> {
  if (!isOdptConfigured(config)) return fallbackContext();

  const now = Date.now();
  const key = cacheKey(config);
  if (
    networkCache &&
    networkCache.expiresAt > now &&
    networkCache.key === key
  ) {
    return networkCache.value;
  }

  const value = loadNetwork(config).catch((error) => {
    networkCache = null;
    throw error;
  });
  networkCache = { expiresAt: now + CACHE_MS, key, value };
  return value;
}

export function getFallbackRailwayNetwork(): RailwaysApiResponse {
  return fallbackContext().response;
}

/** テストと /dev/debug 用。プロセス内キャッシュを消す。 */
export function clearOdptNetworkCache(): void {
  networkCache = null;
}
