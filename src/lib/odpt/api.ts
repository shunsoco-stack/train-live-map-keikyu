import {
  getOdptConfig,
  getOdptAvailability,
  odptAvailabilityReasonText,
  type OdptConfig,
} from "./config.ts";
import type {
  OdptOperator,
  OdptRailDirection,
  OdptRailway,
  OdptStation,
  OdptTrain,
  OdptTrainInformation,
  OdptTrainType,
} from "./types.ts";
import { createLogger } from "../logger.ts";

const log = createLogger("odpt.api");

export class OdptApiError extends Error {
  public readonly kind:
    | "http"
    | "timeout"
    | "parse"
    | "config"
    | "network";
  public readonly status?: number;

  constructor(
    message: string,
    kind:
      | "http"
      | "timeout"
      | "parse"
      | "config"
      | "network",
    status?: number,
  ) {
    super(message);
    this.name = "OdptApiError";
    this.kind = kind;
    this.status = status;
  }
}

export interface OdptFetchResult<T> {
  data: T;
  durationMs: number;
  /** acl:consumerKey を必ず伏せた診断用 URL。 */
  maskedUrl: string;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function buildUrl(
  config: OdptConfig,
  path: string,
  params: Readonly<Record<string, string>>,
): string {
  const url = new URL(`${config.baseUrl}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("acl:consumerKey", config.accessToken);
  return url.toString();
}

function maskToken(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("acl:consumerKey")) {
      parsed.searchParams.set("acl:consumerKey", "***");
    }
    return parsed.toString();
  } catch {
    return url.replace(/(acl%3AconsumerKey|acl:consumerKey)=([^&\s]+)/gi, "$1=***");
  }
}

async function fetchOnce<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new OdptApiError(
        `ODPT API が HTTP ${response.status} を返しました`,
        "http",
        response.status,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new OdptApiError("ODPT API の JSON 解析に失敗しました", "parse");
    }
  } catch (error) {
    if (error instanceof OdptApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new OdptApiError(
        `ODPT API が ${timeoutMs}ms 以内に応答しませんでした`,
        "timeout",
      );
    }
    // fetch の例外に認証 URL が含まれる実装もあるため、元メッセージは伝播しない。
    throw new OdptApiError("ODPT API への通信に失敗しました", "network");
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry<T>(
  config: OdptConfig,
  path: string,
  params: Readonly<Record<string, string>>,
): Promise<OdptFetchResult<T>> {
  function availabilityError(): OdptApiError | null {
    const availability = getOdptAvailability(config);
    return availability.available
      ? null
      : new OdptApiError(
          odptAvailabilityReasonText(availability.reason) ??
            "ODPT API を利用できません",
          "config",
        );
  }

  const initialAvailabilityError = availabilityError();
  if (initialAvailabilityError) throw initialAvailabilityError;

  const url = buildUrl(config, path, params);
  const maskedUrl = maskToken(url);
  const startedAt = Date.now();
  let lastError: OdptApiError | null = null;

  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      const beforeAttemptError = availabilityError();
      if (beforeAttemptError) throw beforeAttemptError;

      log.info("fetch 開始", { path, attempt, url: maskedUrl });
      const data = await fetchOnce<T>(url, config.timeoutMs);
      // 期限直前に開始した応答も、利用期間終了後は返却しない。
      const beforeReturnError = availabilityError();
      if (beforeReturnError) throw beforeReturnError;

      const durationMs = Date.now() - startedAt;
      log.info("fetch 成功", { path, attempt, durationMs });
      return { data, durationMs, maskedUrl };
    } catch (error) {
      lastError =
        error instanceof OdptApiError
          ? error
          : new OdptApiError("ODPT API の取得に失敗しました", "network");
      log.warn("fetch 失敗", {
        path,
        attempt,
        kind: lastError.kind,
        status: lastError.status ?? null,
        message: lastError.message,
      });

      if (
        lastError.kind === "config" ||
        lastError.status === 401 ||
        lastError.status === 403
      ) {
        break;
      }
      if (attempt < config.retries) {
        await sleep(2 ** attempt * 500);
      }
    }
  }

  log.error("fetch 全試行失敗", {
    path,
    durationMs: Date.now() - startedAt,
  });
  throw (
    lastError ??
    new OdptApiError("ODPT API の取得に失敗しました", "network")
  );
}

export function fetchOdptTrains(
  railway: string,
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptTrain[]>> {
  return fetchWithRetry(config, "odpt:Train", {
    "odpt:railway": railway,
  });
}

export function fetchOdptTrainsForOperator(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptTrain[]>> {
  return fetchWithRetry(config, "odpt:Train", {
    "odpt:operator": operator,
  });
}

export function fetchOdptTrainInformation(
  railway: string,
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptTrainInformation[]>> {
  return fetchWithRetry(config, "odpt:TrainInformation", {
    "odpt:railway": railway,
  });
}

export function fetchOdptTrainInformationForOperator(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptTrainInformation[]>> {
  return fetchWithRetry(config, "odpt:TrainInformation", {
    "odpt:operator": operator,
  });
}

export function fetchOdptRailways(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptRailway[]>> {
  return fetchWithRetry(config, "odpt:Railway", {
    "odpt:operator": operator,
  });
}

export function fetchOdptStations(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptStation[]>> {
  return fetchWithRetry(config, "odpt:Station", {
    "odpt:operator": operator,
  });
}

export function fetchOdptOperator(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptOperator[]>> {
  return fetchWithRetry(config, "odpt:Operator", {
    "owl:sameAs": operator,
  });
}

export function fetchOdptTrainTypes(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptTrainType[]>> {
  return fetchWithRetry(config, "odpt:TrainType", {
    "odpt:operator": operator,
  });
}

/** RailDirection は operator を持たない共通マスタのため全件取得する。 */
export function fetchOdptRailDirections(
  config: OdptConfig = getOdptConfig(),
): Promise<OdptFetchResult<OdptRailDirection[]>> {
  return fetchWithRetry(config, "odpt:RailDirection", {});
}
