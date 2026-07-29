/**
 * 列車位置・運行情報に関する型定義。
 * データ取得元（モック / ODPT）に依存しない共通のドメイン型。
 */

import type { LngLat } from "@/types/geo";

/** 列車の走行方向。ODPT で確認できない場合は推測せず unknown とする。 */
export type TrainDirection = "inbound" | "outbound" | "unknown";
// inbound = 上り / outbound = 下り

/** 列車の状態 */
export type TrainStatus =
  | "running" // 通常走行中
  | "stopped" // 駅間などで停止中
  | "delayed" // 遅延あり(走行中)
  | "suspended" // 運転見合わせ
  | "unknown"; // データ不明・古い

/** 位置情報の精度 */
export type DataAccuracy =
  | "actual" // 実測(将来の実データ用)
  | "estimated" // 推定
  | "mock"; // モックデータ

/**
 * 列車種別。
 * rapid / special_rapid は既存クライアントとの互換用に残している。
 */
export type TrainType =
  | "local"
  | "express"
  | "airport_express"
  | "limited_express"
  | "rapid_limited_express"
  | "airport_rapid_limited_express"
  | "wing"
  | "rapid"
  | "special_rapid"
  | "unknown";

/** ODPT が示す現在の駅間を、路線全体の fraction(0〜1)で表した範囲。 */
export interface RouteSegmentEstimate {
  fromFraction: number;
  toFraction: number;
  /**
   * ODPTで確認した路線形状から切り出した、現在の駅間線形。
   * 未指定の場合は位置を推測して移動させない。
   */
  coordinates?: LngLat[];
}

/** 1編成の列車位置情報 */
export interface TrainLocation {
  id: string;
  /** アプリ内で一意な路線ID */
  lineId: string;
  lineName: string;
  lineColor: string;
  trainNumber: string;
  direction: TrainDirection;
  /** 行先。参照駅情報で確認できない場合は null。 */
  destination: string | null;
  trainType: TrainType;
  latitude: number;
  longitude: number;
  /** ODPT の odpt:delay から換算した分数。フィールドが無い場合は null。 */
  delayMinutes: number | null;
  /** 実測速度。ODPT が提供しない場合は null。 */
  speedKmh: number | null;
  status: TrainStatus;
  /** ISO8601 文字列。最終更新時刻 */
  lastUpdatedAt: string;
  /** ISO8601 文字列。停止し始めた時刻。停止していない場合は null */
  stoppedSince: string | null;
  dataAccuracy: DataAccuracy;
  /** 推定アニメーションが越えてはいけない現在の駅間。 */
  routeSegment: RouteSegmentEstimate | null;
}

/** 路線全体の運行情報 */
export interface ServiceStatus {
  /** アプリ内で一意な路線ID */
  lineId: string;
  lineName: string;
  /** 運行状況の概況(平常運転 / 一部遅延 / 運転見合わせ など) */
  severity: "normal" | "minor" | "major";
  message: string;
  /** ISO8601 文字列 */
  updatedAt: string;
  dataAccuracy: DataAccuracy;
  /** 公式情報、利用者投稿、モックを混同しないための出所。 */
  provenance?: "official" | "community" | "mock";
  /**
   * official レコード自体の有無。
   * not_reported は「平常運転」と同義ではない。
   */
  availability?: "reported" | "not_reported";
}

/** データ取得元の種別 */
export type ProviderSource = "odpt" | "mock";

/** API /api/trains のレスポンス形式 */
export interface TrainsApiResponse {
  trains: TrainLocation[];
  /** ISO8601 文字列。サーバー側での生成時刻 */
  generatedAt: string;
  /** ISO8601 文字列。表示中データの dc:date のうち最新の時刻。 */
  dataUpdatedAt: string;
  isMock: boolean;
  /** 実際に使われたデータ取得元 */
  source: ProviderSource;
  /** 実データ失敗によるモックフォールバックか */
  fallback: boolean;
  /** UI に表示する注意書き(モック表示中など)。不要なら null。 */
  notice: string | null;
}

/** API /api/service-status のレスポンス形式 */
export interface ServiceStatusApiResponse {
  serviceStatus: ServiceStatus;
  /** 利用可能な全路線の運行情報。旧クライアント向けにserviceStatusも残す。 */
  serviceStatuses?: ServiceStatus[];
  isMock: boolean;
  source: ProviderSource;
  fallback: boolean;
  notice: string | null;
}
