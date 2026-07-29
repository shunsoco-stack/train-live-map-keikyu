import { MOCK_KEIKYU_LINES } from "@/data/routeLine";
import { buildPolylineIndex, positionAtFraction } from "@/lib/geo";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import type {
  ServiceStatus,
  TrainLocation,
  TrainStatus,
} from "@/types/train";
import type { LngLat } from "@/types/geo";

interface MockTrainSpec {
  id: string;
  lineId: TrainLocation["lineId"];
  trainNumber: string;
  direction: TrainLocation["direction"];
  destination: string | null;
  trainType: TrainLocation["trainType"];
  status: TrainStatus;
  delayMinutes: number | null;
  from: string;
  to: string;
  periodSec: number;
  phase: number;
  fixedAt?: number;
  speedKmh: number | null;
  initialStopSec?: number;
}

/**
 * フォールバック表示専用。京急本線の品川〜泉岳寺は定義にも含めない。
 * delayMinutes が null の例も置き、架空の「+0分」を作らない。
 */
const TRAIN_SPECS: MockTrainSpec[] = [
  {
    id: "mock-main-01",
    lineId: "main",
    trainNumber: "101A",
    direction: "outbound",
    destination: "浦賀",
    trainType: "limited_express",
    status: "delayed",
    delayMinutes: 5,
    from: "shinagawa",
    to: "keikyu-kamata",
    periodSec: 210,
    phase: 0.12,
    speedKmh: 55,
  },
  {
    id: "mock-airport-01",
    lineId: "airport",
    trainNumber: "202D",
    direction: "outbound",
    destination: "羽田空港第1・第2ターミナル",
    trainType: "airport_express",
    status: "running",
    delayMinutes: null,
    from: "keikyu-kamata",
    to: "haneda-terminal-1-2",
    periodSec: 160,
    phase: 0.4,
    speedKmh: 45,
  },
  {
    id: "mock-daishi-01",
    lineId: "daishi",
    trainNumber: "303",
    direction: "inbound",
    destination: "京急川崎",
    trainType: "local",
    status: "running",
    delayMinutes: 0,
    from: "kojimashinden",
    to: "keikyu-kawasaki",
    periodSec: 180,
    phase: 0.72,
    speedKmh: 35,
  },
  {
    id: "mock-zushi-01",
    lineId: "zushi",
    trainNumber: "404",
    direction: "outbound",
    destination: "逗子・葉山",
    trainType: "local",
    status: "running",
    delayMinutes: 0,
    from: "kanazawa-hakkei",
    to: "zushi-hayama",
    periodSec: 190,
    phase: 0.25,
    speedKmh: 40,
  },
  {
    id: "mock-kurihama-01",
    lineId: "kurihama",
    trainNumber: "505",
    direction: "outbound",
    destination: "三崎口",
    trainType: "rapid_limited_express",
    status: "suspended",
    delayMinutes: null,
    from: "horinouchi",
    to: "misakiguchi",
    periodSec: 240,
    phase: 0,
    fixedAt: 0.58,
    speedKmh: 0,
    initialStopSec: 7 * 60,
  },
];

function segmentCoordinates(
  lineId: string,
  fromId: string,
  toId: string,
): LngLat[] | null {
  const line = MOCK_KEIKYU_LINES.find((candidate) => candidate.id === lineId);
  if (!line) return null;
  const from = line.stations.find((station) => station.id === fromId);
  const to = line.stations.find((station) => station.id === toId);
  if (!from || !to || from.pointIndex === to.pointIndex) return null;

  if (from.pointIndex < to.pointIndex) {
    return line.coordinates.slice(from.pointIndex, to.pointIndex + 1);
  }
  return line.coordinates
    .slice(to.pointIndex, from.pointIndex + 1)
    .reverse();
}

function loopProgress(
  elapsedSec: number,
  periodSec: number,
  phase: number,
): number {
  return (((elapsedSec / periodSec + phase) % 1) + 1) % 1;
}

export class MockTrainLocationProvider
  implements TrainLocationProvider
{
  public readonly isMock = true;

  constructor(private readonly startMs: number = Date.now()) {}

  async getTrainLocations(): Promise<TrainLocation[]> {
    const now = new Date();
    const elapsedSec = (now.getTime() - this.startMs) / 1_000;

    return TRAIN_SPECS.flatMap((spec) => {
      const line = MOCK_KEIKYU_LINES.find(
        (candidate) => candidate.id === spec.lineId,
      );
      const coordinates = segmentCoordinates(spec.lineId, spec.from, spec.to);
      if (!line || !coordinates) return [];
      const localFraction =
        spec.fixedAt ??
        loopProgress(elapsedSec, spec.periodSec, spec.phase);
      const [longitude, latitude] = positionAtFraction(
        buildPolylineIndex(coordinates),
        localFraction,
      );
      const stopped =
        spec.status === "stopped" || spec.status === "suspended";

      return [
        {
          id: spec.id,
          lineId: line.id,
          lineName: line.name,
          lineColor: line.color,
          trainNumber: spec.trainNumber,
          direction: spec.direction,
          destination: spec.destination,
          trainType: spec.trainType,
          latitude,
          longitude,
          delayMinutes: spec.delayMinutes,
          speedKmh: spec.speedKmh,
          status: spec.status,
          lastUpdatedAt: now.toISOString(),
          stoppedSince:
            stopped && spec.initialStopSec
              ? new Date(
                  this.startMs - spec.initialStopSec * 1_000,
                ).toISOString()
              : null,
          dataAccuracy: "mock" as const,
          routeSegment: {
            fromFraction: 0,
            toFraction: 1,
            coordinates,
          },
        },
      ];
    });
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    const statuses = await this.getServiceStatuses();
    const main = statuses.find((status) => status.lineId === "main");
    if (!main) throw new Error("モック京急本線の運行情報がありません");
    return main;
  }

  async getServiceStatuses(): Promise<ServiceStatus[]> {
    const now = new Date().toISOString();
    return MOCK_KEIKYU_LINES.map((line) => {
      const isMain = line.id === "main";
      const isKurihama = line.id === "kurihama";
      return {
        lineId: line.id,
        lineName: line.name,
        severity: isKurihama ? "major" : isMain ? "minor" : "normal",
        message: isKurihama
          ? "モック：久里浜線で運転を見合わせています。"
          : isMain
            ? "モック：京急本線の一部列車に遅れがあります。"
            : "モック：運行情報の表示確認用データです。",
        updatedAt: now,
        dataAccuracy: "mock",
        provenance: "mock",
        availability: "reported",
      };
    });
  }
}
