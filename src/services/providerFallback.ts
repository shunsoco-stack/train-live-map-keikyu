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
 * 実プロバイダの失敗または表示可能データ0件を、同じ呼び出し形のモックへ
 * フォールバックする純粋な制御ロジック。
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
        value: await mockCall(),
        source: "mock",
        fallback: true,
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
