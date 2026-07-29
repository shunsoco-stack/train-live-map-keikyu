/**
 * ODPT（公共交通オープンデータセンター）接続設定。
 *
 * 秘密情報はサーバー側の環境変数からだけ読み込む。京急版では operator を
 * 環境変数で差し替えず、チャレンジカタログで確認した ID に固定する。
 */

export const ODPT_CHALLENGE_API_BASE_URL =
  "https://api-challenge.odpt.org/api/v4";
export const KEIKYU_OPERATOR_ID = "odpt.Operator:Keikyu";
export const ODPT_CHALLENGE_LICENSE_END_DATE_JST = "2027-03-14";
/**
 * 2027-03-14（日本時間）は利用可能な最終日。
 * 翌日の 00:00 JST 以降はトークンが残っていても ODPT を呼ばない。
 */
export const ODPT_CHALLENGE_LICENSE_CUTOFF_MS = Date.parse(
  "2027-03-15T00:00:00+09:00",
);

export type OdptAvailabilityReason =
  | "available"
  | "terms-not-approved"
  | "token-missing"
  | "challenge-license-ended";

export interface OdptAvailability {
  available: boolean;
  reason: OdptAvailabilityReason;
}

export interface OdptConfig {
  baseUrl: string;
  accessToken: string;
  /** 京急向け特定利用条件の確認記録が完了した時だけtrue。 */
  liveDataApproved: boolean;
  operator: typeof KEIKYU_OPERATOR_ID;
  timeoutMs: number;
  retries: number;
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizedBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() || ODPT_CHALLENGE_API_BASE_URL;
  try {
    const parsed = new URL(candidate);
    // ベース URL へ誤って資格情報やトークンを付けてもログ・画面へ出さない。
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return ODPT_CHALLENGE_API_BASE_URL;
  }
}

/** 現在の環境変数から ODPT 設定を読む。 */
export function getOdptConfig(): OdptConfig {
  return {
    baseUrl: normalizedBaseUrl(process.env.ODPT_API_BASE_URL),
    accessToken: process.env.ODPT_ACCESS_TOKEN?.trim() || "",
    liveDataApproved:
      process.env.ODPT_LIVE_DATA_APPROVED?.trim().toLowerCase() ===
      "true",
    operator: KEIKYU_OPERATOR_ID,
    timeoutMs: parseIntEnv(process.env.ODPT_TIMEOUT_MS, 8_000),
    retries: parseIntEnv(process.env.ODPT_RETRIES, 2),
  };
}

export function getOdptAvailability(
  config: OdptConfig = getOdptConfig(),
  nowMs = Date.now(),
): OdptAvailability {
  if (nowMs >= ODPT_CHALLENGE_LICENSE_CUTOFF_MS) {
    return {
      available: false,
      reason: "challenge-license-ended",
    };
  }
  if (!config.liveDataApproved) {
    return {
      available: false,
      reason: "terms-not-approved",
    };
  }
  if (config.accessToken.length === 0) {
    return {
      available: false,
      reason: "token-missing",
    };
  }
  return {
    available: true,
    reason: "available",
  };
}

export function odptAvailabilityReasonText(
  reason: OdptAvailabilityReason,
): string | null {
  switch (reason) {
    case "challenge-license-ended":
      return "チャレンジ2026限定ライセンスの利用期間は2027年3月14日（日本時間）で終了しました（モック動作中）。";
    case "terms-not-approved":
      return "京急向け特定利用条件の確認記録が未完了のため、ODPTライブを無効化しています（モック動作中）。";
    case "token-missing":
      return "ODPT_ACCESS_TOKEN が未設定です（モック動作中）。";
    case "available":
      return null;
  }
}

export function isOdptConfigured(
  config: OdptConfig = getOdptConfig(),
  nowMs = Date.now(),
): boolean {
  return getOdptAvailability(config, nowMs).available;
}
