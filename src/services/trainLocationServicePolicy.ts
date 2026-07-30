import type { ProviderFallbackReason } from "./providerFallback.ts";

const LIVE_NOTICE =
  "ODPTライブ／位置は駅間推定です。品川〜泉岳寺間は列車位置情報の提供対象外です。";
const LIVE_NOTICE_EMPTY =
  "ODPTライブ：現在表示できる列車がありません。品川〜泉岳寺間は列車位置情報の提供対象外です。";
const MOCK_NOTICE_FALLBACK =
  "実データの取得に失敗したためモックデータを表示しています。";

/** プロバイダの解決結果を、利用者向けの出所通知へ変換する。 */
export function providerNotice(
  reason: ProviderFallbackReason,
  unavailableNotice: () => string,
): string {
  switch (reason) {
    case "not-configured":
      return unavailableNotice();
    case "request-failed":
      return MOCK_NOTICE_FALLBACK;
    case "empty":
      return LIVE_NOTICE_EMPTY;
    case null:
      return LIVE_NOTICE;
  }
}
