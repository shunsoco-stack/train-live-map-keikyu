import type {
  CommunityReportRecord,
  CommunityReportStatus,
  CommunityReportSummary,
  CommunityReportVote,
} from "@/types/community";

export const COMMUNITY_REPORT_WINDOW_MS = 30 * 60 * 1000;
export const COMMUNITY_REPORT_COOLDOWN_SECONDS = 60;

const STATUS_PRIORITY: Record<CommunityReportStatus, number> = {
  "on-time": 0,
  delayed: 1,
  suspended: 2,
};
const LINE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function validateCommunityReportVote(
  input: unknown,
): CommunityReportVote | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  const lineId =
    typeof value.lineId === "string" ? value.lineId.trim() : "";
  const status = value.status;

  if (
    !LINE_ID_PATTERN.test(lineId) ||
    (status !== "on-time" &&
      status !== "delayed" &&
      status !== "suspended")
  ) {
    return null;
  }

  if (status === "delayed") {
    const delayMinutes = Number(value.delayMinutes);
    if (
      !Number.isInteger(delayMinutes) ||
      delayMinutes < 1 ||
      delayMinutes > 120
    ) {
      return null;
    }
    return { lineId, status, delayMinutes };
  }

  return { lineId, status, delayMinutes: null };
}

function dedupeLatestReports(
  reports: readonly CommunityReportRecord[],
  now: number,
): CommunityReportRecord[] {
  const cutoff = now - COMMUNITY_REPORT_WINDOW_MS;
  const latest = new Map<string, CommunityReportRecord>();

  for (const report of reports) {
    const createdAt = Date.parse(report.createdAt);
    if (!Number.isFinite(createdAt) || createdAt < cutoff || createdAt > now) {
      continue;
    }

    const identity = report.networkHash ?? report.reporterHash;
    const key = `${report.lineId}\u0000${identity}`;
    const previous = latest.get(key);
    if (!previous || Date.parse(previous.createdAt) < createdAt) {
      latest.set(key, report);
    }
  }

  return [...latest.values()];
}

/**
 * 利用者投稿を路線別に集計する。これは公式運行情報とは別のデータであり、
 * 同じネットワーク（旧記録は同じ投稿者）・路線の重複は最新1件として扱う。
 */
export function aggregateCommunityReports(
  reports: readonly CommunityReportRecord[],
  now = Date.now(),
): CommunityReportSummary[] {
  const byLine = new Map<string, CommunityReportRecord[]>();

  for (const report of dedupeLatestReports(reports, now)) {
    const group = byLine.get(report.lineId) ?? [];
    group.push(report);
    byLine.set(report.lineId, group);
  }

  return [...byLine.entries()]
    .map(([lineId, lineReports]) => {
      const counts = {
        onTime: lineReports.filter((item) => item.status === "on-time")
          .length,
        delayed: lineReports.filter((item) => item.status === "delayed")
          .length,
        suspended: lineReports.filter(
          (item) => item.status === "suspended",
        ).length,
      };
      const statusCounts: Array<[CommunityReportStatus, number]> = [
        ["on-time", counts.onTime],
        ["delayed", counts.delayed],
        ["suspended", counts.suspended],
      ];
      const status = statusCounts.sort(
        (a, b) =>
          b[1] - a[1] ||
          STATUS_PRIORITY[b[0]] - STATUS_PRIORITY[a[0]],
      )[0][0];
      const updatedAt = lineReports.reduce(
        (latest, item) =>
          Date.parse(item.createdAt) > Date.parse(latest)
            ? item.createdAt
            : latest,
        lineReports[0].createdAt,
      );

      return {
        lineId,
        status,
        delayMinutes:
          status === "delayed"
            ? median(
                lineReports
                  .filter((item) => item.status === "delayed")
                  .map((item) => item.delayMinutes)
                  .filter((value): value is number => value !== null),
              )
            : null,
        voteCount: lineReports.length,
        counts,
        updatedAt,
      };
    })
    .sort((a, b) => a.lineId.localeCompare(b.lineId));
}
