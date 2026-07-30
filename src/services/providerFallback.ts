export type ProviderFallbackReason =
  | "not-configured"
  | "request-failed"
  | "empty"
  | null;

export interface ProviderResolution<T> {
  value: T;
  source: "odpt" | "mock";
  fallback: boolean;
  reason: ProviderFallbackReason;
  error: unknown;
}

/**
 * 実プロバイダが未設定または取得に失敗した場合だけ、同じ呼び出し形の
 * モックへフォールバックする。実APIの成功0件は有効な空状態として保持する。
 */
export async function resolveProviderValue<T>(
  realCall: (() => Promise<T>) | null,
  mockCall: () => Promise<T>,
  isEmpty: (value: T) => boolean = () => false,
): Promise<ProviderResolution<T>> {
  if (!realCall) {
    return {
      value: await mockCall(),
      source: "mock",
      fallback: false,
      reason: "not-configured",
      error: null,
    };
  }

  try {
    const value = await realCall();
    if (isEmpty(value)) {
      return {
        value,
        source: "odpt",
        fallback: false,
        reason: "empty",
        error: null,
      };
    }
    return {
      value,
      source: "odpt",
      fallback: false,
      reason: null,
      error: null,
    };
  } catch (error) {
    return {
      value: await mockCall(),
      source: "mock",
      fallback: true,
      reason: "request-failed",
      error,
    };
  }
}
