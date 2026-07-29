import type { ServiceStatus } from "@/types/train";

const SEVERITY_ORDER: Record<ServiceStatus["severity"], number> = {
  normal: 0,
  minor: 1,
  major: 2,
};

const SERVICE_STATUS_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tokyo",
});

export function formatServiceStatusUpdatedAt(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp)
    ? SERVICE_STATUS_TIMESTAMP_FORMATTER.format(timestamp)
    : "時刻不明";
}

/**
 * 表示中の路線だけに運行情報を絞る。
 * 複数路線に異常がある場合は重大なものを先に並べ、
 * すべて平常なら地図を覆わないよう1件にまとめる。
 */
export function serviceStatusesForVisibleLines(
  serviceStatuses: readonly ServiceStatus[],
  visibleLineIds: ReadonlySet<string>,
): ServiceStatus[] {
  const selected = serviceStatuses.filter((status) =>
    visibleLineIds.has(status.lineId),
  );
  const reported = selected.filter(
    (status) => status.availability !== "not_reported",
  );
  if (reported.length <= 1) return reported;

  const disrupted = reported
    .filter((status) => status.severity !== "normal")
    .sort(
      (a, b) =>
        SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
        Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
        a.lineName.localeCompare(b.lineName, "ja"),
    );
  if (disrupted.length > 0) return disrupted;

  const latestUpdatedAt = reported.reduce(
    (latest, status) =>
      Date.parse(status.updatedAt) > Date.parse(latest)
        ? status.updatedAt
        : latest,
    reported[0].updatedAt,
  );

  return [
    {
      lineId: "__selected-lines__",
      lineName:
        reported.length === selected.length
          ? `選択中の${selected.length}路線`
          : `公式情報を確認できた${reported.length}路線`,
      severity: "normal",
      message:
        reported.length === selected.length
          ? "すべて平常どおり運転しています。"
          : "公式情報を確認できた路線は平常どおりです。未発表の路線は判定に含めていません。",
      updatedAt: latestUpdatedAt,
      dataAccuracy: reported.every(
        (status) => status.dataAccuracy === "actual",
      )
        ? "actual"
        : reported.some((status) => status.dataAccuracy === "mock")
          ? "mock"
          : "estimated",
      provenance: reported.every(
        (status) => status.provenance === "official",
      )
        ? "official"
        : reported.every((status) => status.provenance === "mock")
          ? "mock"
          : undefined,
      availability: "reported",
    },
  ];
}
