import { RAILWAY_CATALOG, identifyKeikyuRailway } from "@/data/railwayCatalog";
import {
  fetchOdptOperator,
  fetchOdptRailDirections,
  fetchOdptRailways,
  fetchOdptStations,
  fetchOdptTrainInformationForOperator,
  fetchOdptTrainsForOperator,
  fetchOdptTrainTypes,
  type OdptFetchResult,
} from "@/lib/odpt/api";
import {
  getOdptConfig,
  getOdptAvailability,
  isOdptConfigured,
  KEIKYU_OPERATOR_ID,
  odptAvailabilityReasonText,
} from "@/lib/odpt/config";
import {
  odptEntityId,
  pickOdptText,
  type OdptOperator,
  type OdptRailDirection,
  type OdptRailway,
  type OdptStation,
  type OdptTrain,
  type OdptTrainInformation,
  type OdptTrainType,
} from "@/lib/odpt/types";
import { createLogger } from "@/lib/logger";
import { KeikyuTrainLocationProvider } from "@/providers/KeikyuTrainLocationProvider";
import { MockTrainLocationProvider } from "@/providers/MockTrainLocationProvider";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import { resolveProviderValue } from "@/services/providerFallback";
import type {
  ProviderSource,
  ServiceStatus,
  TrainLocation,
} from "@/types/train";

const log = createLogger("service");
const MODULE_START_MS = Date.now();

let mockSingleton: MockTrainLocationProvider | null = null;
let keikyuSingleton: KeikyuTrainLocationProvider | null = null;

function getMockProvider(): MockTrainLocationProvider {
  if (!mockSingleton) {
    mockSingleton = new MockTrainLocationProvider(MODULE_START_MS);
  }
  return mockSingleton;
}

function getRealProvider(): KeikyuTrainLocationProvider | null {
  if (!isOdptConfigured()) return null;
  if (!keikyuSingleton) {
    keikyuSingleton = new KeikyuTrainLocationProvider();
  }
  return keikyuSingleton;
}

export interface TrainsResult {
  trains: TrainLocation[];
  source: ProviderSource;
  isMock: boolean;
  fallback: boolean;
  notice: string | null;
}

export interface ServiceStatusResult {
  serviceStatus: ServiceStatus;
  source: ProviderSource;
  isMock: boolean;
  fallback: boolean;
  notice: string | null;
}

export interface ServiceStatusesResult {
  serviceStatuses: ServiceStatus[];
  source: ProviderSource;
  isMock: boolean;
  fallback: boolean;
  notice: string | null;
}

const LIVE_NOTICE =
  "ODPTライブ／位置は駅間推定です。品川〜泉岳寺間は列車位置情報の提供対象外です。";
const MOCK_NOTICE_NO_TOKEN =
  "ODPT未設定のためモックデータを表示しています。品川〜泉岳寺間はモックでも補完しません。";
const MOCK_NOTICE_LICENSE_ENDED =
  "チャレンジ2026限定ライセンスの利用期間が2027年3月14日（日本時間）で終了したため、モックデータを表示しています。";
const MOCK_NOTICE_TERMS_PENDING =
  "京急向け特定利用条件の確認記録が未完了のため、ODPTライブを無効化してモックデータを表示しています。";
const MOCK_NOTICE_FALLBACK =
  "実データの取得に失敗したためモックデータを表示しています。";
const MOCK_NOTICE_EMPTY =
  "ODPTから表示可能な対象列車を取得できなかったためモックデータを表示しています。";

function unavailableOdptNotice(): string {
  const availability = getOdptAvailability();
  switch (availability.reason) {
    case "challenge-license-ended":
      return MOCK_NOTICE_LICENSE_ENDED;
    case "terms-not-approved":
      return MOCK_NOTICE_TERMS_PENDING;
    case "token-missing":
    case "available":
      return MOCK_NOTICE_NO_TOKEN;
  }
}

interface ProviderCallResult<T> {
  value: T;
  source: ProviderSource;
  fallback: boolean;
  notice: string | null;
}

async function withProvider<T>(
  real: TrainLocationProvider | null,
  mock: TrainLocationProvider,
  call: (provider: TrainLocationProvider) => Promise<T>,
  isEmpty: (value: T) => boolean = () => false,
): Promise<ProviderCallResult<T>> {
  const result = await resolveProviderValue(
    real ? () => call(real) : null,
    () => call(mock),
    isEmpty,
  );
  if (result.reason === "request-failed") {
    log.warn("実データ取得に失敗、モックへフォールバック", {
      message:
        result.error instanceof Error
          ? result.error.message
          : "不明な取得エラー",
    });
  } else if (result.reason === "empty") {
    log.warn("ODPTの表示可能な対象列車が0件、モックへフォールバック");
  }
  const notice =
    result.reason === "not-configured"
      ? unavailableOdptNotice()
      : result.reason === "request-failed"
        ? MOCK_NOTICE_FALLBACK
        : result.reason === "empty"
          ? MOCK_NOTICE_EMPTY
          : LIVE_NOTICE;
  return {
    value: result.value,
    source: result.source,
    fallback: result.fallback,
    notice,
  };
}

export interface TrainLocationService {
  getTrains(): Promise<TrainsResult>;
  getServiceStatus(): Promise<ServiceStatusResult>;
  getServiceStatuses(): Promise<ServiceStatusesResult>;
}

function buildTrainLocationService(
  realProvider: () => TrainLocationProvider | null,
  mockProvider: () => TrainLocationProvider,
): TrainLocationService {
  const service: TrainLocationService = {
    async getTrains(): Promise<TrainsResult> {
      const mock = mockProvider();
      const result = await withProvider(
        realProvider(),
        mock,
        (provider) => provider.getTrainLocations(),
        (trains) => trains.length === 0,
      );

      return {
        trains: result.value,
        source: result.source,
        isMock: result.source === "mock",
        fallback: result.fallback,
        notice: result.notice,
      };
    },

    async getServiceStatus(): Promise<ServiceStatusResult> {
      const result = await service.getServiceStatuses();
      const serviceStatus =
        result.serviceStatuses.find((status) => status.lineId === "main") ??
        result.serviceStatuses[0];
      if (!serviceStatus) {
        throw new Error("運行情報を取得できる京急路線がありません");
      }
      return { ...result, serviceStatus };
    },

    async getServiceStatuses(): Promise<ServiceStatusesResult> {
      const result = await withProvider(
        realProvider(),
        mockProvider(),
        (provider) => provider.getServiceStatuses(),
      );
      return {
        serviceStatuses: result.value,
        source: result.source,
        isMock: result.source === "mock",
        fallback: result.fallback,
        notice: result.notice,
      };
    },
  };
  return service;
}

/**
 * テスト用にも使える生成関数。UI は module singleton の
 * trainLocationService だけを参照する。
 */
export function createTrainLocationService(
  realProvider: TrainLocationProvider | null,
  mockProvider: TrainLocationProvider,
): TrainLocationService {
  return buildTrainLocationService(
    () => realProvider,
    () => mockProvider,
  );
}

export const trainLocationService = buildTrainLocationService(
  getRealProvider,
  getMockProvider,
);

export interface ProbeResult {
  key: string;
  label: string;
  success: boolean;
  count: number;
  durationMs: number | null;
  error: string | null;
}

export interface DebugRailway {
  odptId: string;
  title: string;
  identifiedLineId: string | null;
  identifiedLineName: string | null;
  stationCount: number;
  stationNames: string[];
  hasRegion: boolean;
  geometryType: string | null;
  ascendingRailDirection: string | null;
  descendingRailDirection: string | null;
}

export interface FieldPresence {
  present: number;
  total: number;
}

export interface DebugSnapshot {
  odptConfigured: boolean;
  operatorId: typeof KEIKYU_OPERATOR_ID;
  operatorConfirmed: boolean;
  baseUrl: string;
  activeSource: ProviderSource;
  success: boolean;
  count: number;
  durationMs: number | null;
  fetchedAt: string;
  error: string | null;
  rawSample: {
    trains: OdptTrain[];
    trainInformation: OdptTrainInformation[];
  } | null;
  probes: ProbeResult[];
  availableRailways: string[];
  railways: DebugRailway[];
  missingExpectedLines: string[];
  trainFieldPresence: Record<string, FieldPresence>;
  informationFieldPresence: Record<string, FieldPresence>;
  stationFieldPresence: Record<string, FieldPresence>;
  observedRailDirections: string[];
  observedTrainTypes: string[];
  observedDestinations: string[];
}

interface DebugProbe<T> {
  meta: ProbeResult;
  data: T[];
}

async function runProbe<T>(
  key: string,
  label: string,
  request: () => Promise<OdptFetchResult<T[]>>,
): Promise<DebugProbe<T>> {
  try {
    const result = await request();
    return {
      meta: {
        key,
        label,
        success: true,
        count: result.data.length,
        durationMs: result.durationMs,
        error: null,
      },
      data: result.data,
    };
  } catch (error) {
    return {
      meta: {
        key,
        label,
        success: false,
        count: 0,
        durationMs: null,
        error:
          error instanceof Error ? error.message : "取得に失敗しました",
      },
      data: [],
    };
  }
}

function fieldPresence<T extends object>(
  values: readonly T[],
  field: keyof T,
): FieldPresence {
  return {
    present: values.filter((value) =>
      Object.prototype.hasOwnProperty.call(value, field),
    ).length,
    total: values.length,
  };
}

function debugRailways(
  railways: readonly OdptRailway[],
  stations: readonly OdptStation[],
): DebugRailway[] {
  const stationTitleById = new Map(
    stations.map((station) => [
      odptEntityId(station),
      pickOdptText(
        station["odpt:stationTitle"],
        station["dc:title"] ?? "",
      ),
    ]),
  );

  return railways.map((railway) => {
    const stationOrder = [...(railway["odpt:stationOrder"] ?? [])].sort(
      (a, b) => (a["odpt:index"] ?? 0) - (b["odpt:index"] ?? 0),
    );
    const stationNames = stationOrder.map((station) =>
      pickOdptText(
        station["odpt:stationTitle"],
        stationTitleById.get(station["odpt:station"] ?? "") ?? "",
      ),
    );
    const title = pickOdptText(
      railway["odpt:railwayTitle"],
      railway["dc:title"] ?? "",
    );
    const identified = identifyKeikyuRailway({ title, stationTitles: stationNames });
    return {
      odptId: odptEntityId(railway),
      title,
      identifiedLineId: identified?.id ?? null,
      identifiedLineName: identified?.name ?? null,
      stationCount: stationOrder.length,
      stationNames,
      hasRegion: Boolean(railway["ug:region"]?.geometry),
      geometryType: railway["ug:region"]?.geometry?.type ?? null,
      ascendingRailDirection:
        railway["odpt:ascendingRailDirection"] ?? null,
      descendingRailDirection:
        railway["odpt:descendingRailDirection"] ?? null,
    };
  });
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort()
    .slice(0, 100);
}

/**
 * /dev/debug 用。認証トークンやリクエスト URL は返さない。
 */
export async function getDebugSnapshot(): Promise<DebugSnapshot> {
  const config = getOdptConfig();
  const availability = getOdptAvailability(config);
  const configured = availability.available;
  const empty: DebugSnapshot = {
    odptConfigured: configured,
    operatorId: KEIKYU_OPERATOR_ID,
    operatorConfirmed: false,
    baseUrl: config.baseUrl,
    activeSource: "mock",
    success: false,
    count: 0,
    durationMs: null,
    fetchedAt: new Date().toISOString(),
    error: configured
      ? null
      : odptAvailabilityReasonText(availability.reason),
    rawSample: null,
    probes: [],
    availableRailways: [],
    railways: [],
    missingExpectedLines: RAILWAY_CATALOG.map((line) => line.id),
    trainFieldPresence: {},
    informationFieldPresence: {},
    stationFieldPresence: {},
    observedRailDirections: [],
    observedTrainTypes: [],
    observedDestinations: [],
  };
  if (!configured) return empty;

  const [
    operatorProbe,
    railwayProbe,
    trainProbe,
    informationProbe,
    stationProbe,
    directionProbe,
    trainTypeProbe,
  ] = await Promise.all([
    runProbe<OdptOperator>("operator", `operator (${KEIKYU_OPERATOR_ID})`, () =>
      fetchOdptOperator(KEIKYU_OPERATOR_ID, config),
    ),
    runProbe<OdptRailway>(
      "railways",
      `odpt:Railway (${KEIKYU_OPERATOR_ID})`,
      () => fetchOdptRailways(KEIKYU_OPERATOR_ID, config),
    ),
    runProbe<OdptTrain>(
      "trains",
      `odpt:Train (${KEIKYU_OPERATOR_ID})`,
      () => fetchOdptTrainsForOperator(KEIKYU_OPERATOR_ID, config),
    ),
    runProbe<OdptTrainInformation>(
      "train-information",
      `odpt:TrainInformation (${KEIKYU_OPERATOR_ID})`,
      () =>
        fetchOdptTrainInformationForOperator(
          KEIKYU_OPERATOR_ID,
          config,
        ),
    ),
    runProbe<OdptStation>(
      "stations",
      `odpt:Station (${KEIKYU_OPERATOR_ID})`,
      () => fetchOdptStations(KEIKYU_OPERATOR_ID, config),
    ),
    runProbe<OdptRailDirection>(
      "rail-directions",
      "odpt:RailDirection",
      () => fetchOdptRailDirections(config),
    ),
    runProbe<OdptTrainType>(
      "train-types",
      `odpt:TrainType (${KEIKYU_OPERATOR_ID})`,
      () => fetchOdptTrainTypes(KEIKYU_OPERATOR_ID, config),
    ),
  ]);

  const railways = debugRailways(
    railwayProbe.data,
    stationProbe.data,
  );
  const identified = new Set(
    railways
      .map((railway) => railway.identifiedLineId)
      .filter((lineId): lineId is string => lineId !== null),
  );
  const operatorConfirmed = operatorProbe.data.some(
    (operator) => odptEntityId(operator) === KEIKYU_OPERATOR_ID,
  );
  const probes = [
    operatorProbe.meta,
    railwayProbe.meta,
    trainProbe.meta,
    informationProbe.meta,
    stationProbe.meta,
    directionProbe.meta,
    trainTypeProbe.meta,
  ];

  return {
    ...empty,
    operatorConfirmed,
    activeSource: trainProbe.meta.success ? "odpt" : "mock",
    success: trainProbe.meta.success,
    count: trainProbe.meta.count,
    durationMs: trainProbe.meta.durationMs,
    error: trainProbe.meta.error,
    rawSample: {
      trains: trainProbe.data.slice(0, 3),
      trainInformation: informationProbe.data.slice(0, 3),
    },
    probes,
    availableRailways: railways
      .map((railway) => railway.odptId)
      .filter(Boolean)
      .sort(),
    railways,
    missingExpectedLines: RAILWAY_CATALOG.filter(
      (line) => !identified.has(line.id),
    ).map((line) => line.id),
    trainFieldPresence: {
      railway: fieldPresence(trainProbe.data, "odpt:railway"),
      fromStation: fieldPresence(trainProbe.data, "odpt:fromStation"),
      toStation: fieldPresence(trainProbe.data, "odpt:toStation"),
      railDirection: fieldPresence(
        trainProbe.data,
        "odpt:railDirection",
      ),
      trainType: fieldPresence(trainProbe.data, "odpt:trainType"),
      destinationStation: fieldPresence(
        trainProbe.data,
        "odpt:destinationStation",
      ),
      delay: fieldPresence(trainProbe.data, "odpt:delay"),
      valid: fieldPresence(trainProbe.data, "dct:valid"),
    },
    informationFieldPresence: {
      railway: fieldPresence(
        informationProbe.data,
        "odpt:railway",
      ),
      text: fieldPresence(
        informationProbe.data,
        "odpt:trainInformationText",
      ),
      status: fieldPresence(
        informationProbe.data,
        "odpt:trainInformationStatus",
      ),
      valid: fieldPresence(informationProbe.data, "dct:valid"),
    },
    stationFieldPresence: {
      title: fieldPresence(stationProbe.data, "odpt:stationTitle"),
      latitude: fieldPresence(stationProbe.data, "geo:lat"),
      longitude: fieldPresence(stationProbe.data, "geo:long"),
      region: fieldPresence(stationProbe.data, "ug:region"),
    },
    observedRailDirections: uniqueStrings([
      ...trainProbe.data.map((train) => train["odpt:railDirection"]),
      ...railways.flatMap((railway) => [
        railway.ascendingRailDirection,
        railway.descendingRailDirection,
      ]),
      ...directionProbe.data.map((direction) =>
        odptEntityId(direction),
      ),
    ]),
    observedTrainTypes: uniqueStrings([
      ...trainProbe.data.map((train) => train["odpt:trainType"]),
      ...trainTypeProbe.data.map((trainType) =>
        odptEntityId(trainType),
      ),
    ]),
    observedDestinations: uniqueStrings(
      trainProbe.data.flatMap((train) => {
        const destinations = train["odpt:destinationStation"];
        return Array.isArray(destinations)
          ? destinations
          : destinations
            ? [destinations]
            : [];
      }),
    ),
  };
}
