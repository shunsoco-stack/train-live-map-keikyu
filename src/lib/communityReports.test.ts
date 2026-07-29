import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateCommunityReports,
  COMMUNITY_REPORT_WINDOW_MS,
  validateCommunityReportVote,
} from "./communityReports.ts";
import type { CommunityReportRecord } from "../types/community.ts";

const NOW = Date.UTC(2026, 6, 29, 3, 0, 0);

function report(
  lineId: string,
  reporterHash: string,
  status: CommunityReportRecord["status"],
  delayMinutes: number | null = null,
  createdAt = new Date(NOW - 60_000).toISOString(),
  networkHash?: string,
): CommunityReportRecord {
  return {
    lineId,
    reporterHash,
    networkHash,
    status,
    delayMinutes,
    createdAt,
  };
}

test("平常・遅延・見合わせの利用者投稿を検証する", () => {
  assert.deepEqual(
    validateCommunityReportVote({
      lineId: "keikyu-main",
      status: "on-time",
      delayMinutes: 20,
    }),
    { lineId: "keikyu-main", status: "on-time", delayMinutes: null },
  );
  assert.deepEqual(
    validateCommunityReportVote({
      lineId: "keikyu-main",
      status: "delayed",
      delayMinutes: 15,
    }),
    { lineId: "keikyu-main", status: "delayed", delayMinutes: 15 },
  );
  assert.equal(
    validateCommunityReportVote({
      lineId: "keikyu-main",
      status: "delayed",
      delayMinutes: 0,
    }),
    null,
  );
  assert.equal(
    validateCommunityReportVote({
      lineId: "../../other-app",
      status: "on-time",
    }),
    null,
  );
});

test("遅延投稿は中央値で集計する", () => {
  const summaries = aggregateCommunityReports(
    [
      report("keikyu-main", "a", "delayed", 5),
      report("keikyu-main", "b", "delayed", 15),
      report("keikyu-main", "c", "on-time"),
    ],
    NOW,
  );
  assert.equal(summaries[0].status, "delayed");
  assert.equal(summaries[0].delayMinutes, 10);
  assert.equal(summaries[0].voteCount, 3);
  assert.deepEqual(summaries[0].counts, {
    onTime: 1,
    delayed: 2,
    suspended: 0,
  });
});

test("同数なら重大度の高い見合わせ投稿を優先する", () => {
  const summaries = aggregateCommunityReports(
    [
      report("airport", "a", "on-time"),
      report("airport", "b", "suspended"),
    ],
    NOW,
  );
  assert.equal(summaries[0].status, "suspended");
});

test("期限切れ投稿と未来時刻の投稿を除外する", () => {
  const summaries = aggregateCommunityReports(
    [
      report(
        "keikyu-main",
        "expired",
        "delayed",
        10,
        new Date(NOW - COMMUNITY_REPORT_WINDOW_MS - 1).toISOString(),
      ),
      report(
        "keikyu-main",
        "future",
        "suspended",
        null,
        new Date(NOW + 1).toISOString(),
      ),
      report("airport", "active", "on-time"),
    ],
    NOW,
  );
  assert.deepEqual(
    summaries.map((summary) => summary.lineId),
    ["airport"],
  );
});

test("同じ投稿者・路線は最新の1票だけを数える", () => {
  const summaries = aggregateCommunityReports(
    [
      report(
        "kurihama",
        "same",
        "on-time",
        null,
        new Date(NOW - 120_000).toISOString(),
      ),
      report(
        "kurihama",
        "same",
        "suspended",
        null,
        new Date(NOW - 60_000).toISOString(),
      ),
    ],
    NOW,
  );
  assert.equal(summaries[0].voteCount, 1);
  assert.equal(summaries[0].status, "suspended");
});

test("投稿者IDを変えても同じネットワークは最新の1票だけを数える", () => {
  const summaries = aggregateCommunityReports(
    [
      report(
        "kurihama",
        "rotated-a",
        "on-time",
        null,
        new Date(NOW - 120_000).toISOString(),
        "network-a",
      ),
      report(
        "kurihama",
        "rotated-b",
        "suspended",
        null,
        new Date(NOW - 60_000).toISOString(),
        "network-a",
      ),
    ],
    NOW,
  );

  assert.equal(summaries[0].voteCount, 1);
  assert.equal(summaries[0].status, "suspended");
});

test("異なるネットワークの投稿はそれぞれ集計する", () => {
  const summaries = aggregateCommunityReports(
    [
      report(
        "kurihama",
        "a",
        "suspended",
        null,
        undefined,
        "network-a",
      ),
      report(
        "kurihama",
        "b",
        "suspended",
        null,
        undefined,
        "network-b",
      ),
    ],
    NOW,
  );

  assert.equal(summaries[0].voteCount, 2);
});

test("分数のない遅延記録へ架空の分数を補わない", () => {
  const summaries = aggregateCommunityReports(
    [report("daishi", "a", "delayed", null)],
    NOW,
  );
  assert.equal(summaries[0].status, "delayed");
  assert.equal(summaries[0].delayMinutes, null);
});

test("路線ごとに独立して集計する", () => {
  const summaries = aggregateCommunityReports(
    [
      report("keikyu-main", "a", "delayed", 3),
      report("zushi", "b", "suspended"),
    ],
    NOW,
  );
  assert.deepEqual(
    summaries.map((summary) => [summary.lineId, summary.status]),
    [
      ["keikyu-main", "delayed"],
      ["zushi", "suspended"],
    ],
  );
});
