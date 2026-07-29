import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMUNITY_NAMESPACE,
  COMMUNITY_PUSH_LINES_STORAGE_KEY,
  COMMUNITY_PUSH_SUBSCRIPTIONS_REDIS_KEY,
  COMMUNITY_REPORTER_STORAGE_KEY,
  COMMUNITY_REPORTS_REDIS_KEY,
  communityPushTag,
  communityReporterHashSeed,
  pushSubscriptionHashSeed,
} from "./communityNamespace.ts";
import {
  detectSuspensionSpike,
  isAllowedPushEndpoint,
  SUSPENSION_SPIKE_WINDOW_MS,
} from "./communityPush.ts";
import type { CommunityReportRecord } from "../types/community.ts";

const NOW = Date.UTC(2026, 6, 29, 6, 0, 0);

function report(
  reporterHash: string,
  status: CommunityReportRecord["status"],
  ageMs: number,
  lineId = "keikyu-main",
  networkHash?: string,
): CommunityReportRecord {
  return {
    lineId,
    reporterHash,
    networkHash,
    status,
    delayMinutes: null,
    createdAt: new Date(NOW - ageMs).toISOString(),
  };
}

test("直近5分の見合わせ投稿が3件かつ60%以上なら急増と判定する", () => {
  const result = detectSuspensionSpike(
    [
      report("a", "suspended", 60_000),
      report("b", "suspended", 90_000),
      report("c", "suspended", 120_000),
      report("d", "on-time", 150_000),
      report("e", "delayed", 180_000),
    ],
    "keikyu-main",
    NOW,
  );
  assert.equal(result.detected, true);
  assert.equal(result.recentSuspended, 3);
  assert.equal(result.recentTotal, 5);
});

test("見合わせ投稿が3件未満なら通知しない", () => {
  const result = detectSuspensionSpike(
    [
      report("a", "suspended", 60_000),
      report("b", "suspended", 90_000),
    ],
    "keikyu-main",
    NOW,
  );
  assert.equal(result.detected, false);
});

test("見合わせ投稿の比率が60%未満なら通知しない", () => {
  const result = detectSuspensionSpike(
    [
      report("a", "suspended", 60_000),
      report("b", "suspended", 90_000),
      report("c", "suspended", 120_000),
      report("d", "on-time", 150_000),
      report("e", "on-time", 180_000),
      report("f", "on-time", 210_000),
    ],
    "keikyu-main",
    NOW,
  );
  assert.equal(result.detected, false);
});

test("直前5分にも投稿が多い場合は2倍以上の増加を必要とする", () => {
  const result = detectSuspensionSpike(
    [
      report("old-a", "suspended", SUSPENSION_SPIKE_WINDOW_MS + 60_000),
      report("old-b", "suspended", SUSPENSION_SPIKE_WINDOW_MS + 90_000),
      report("a", "suspended", 60_000),
      report("b", "suspended", 90_000),
      report("c", "suspended", 120_000),
    ],
    "keikyu-main",
    NOW,
  );
  assert.equal(result.previousSuspended, 2);
  assert.equal(result.requiredSuspended, 4);
  assert.equal(result.detected, false);
});

test("同じ投稿者の重複は1票として扱う", () => {
  const result = detectSuspensionSpike(
    [
      report("same", "suspended", 60_000),
      report("same", "suspended", 90_000),
      report("b", "suspended", 120_000),
    ],
    "keikyu-main",
    NOW,
  );
  assert.equal(result.recentSuspended, 2);
  assert.equal(result.detected, false);
});

test("投稿者IDを変えても同じネットワークは通知判定で1票にする", () => {
  const result = detectSuspensionSpike(
    [
      report("rotated-a", "suspended", 60_000, "keikyu-main", "network-a"),
      report("rotated-b", "suspended", 90_000, "keikyu-main", "network-a"),
      report("rotated-c", "suspended", 120_000, "keikyu-main", "network-a"),
    ],
    "keikyu-main",
    NOW,
  );

  assert.equal(result.recentSuspended, 1);
  assert.equal(result.detected, false);
});

test("異なる3ネットワークからの見合わせ投稿は通知判定に使える", () => {
  const result = detectSuspensionSpike(
    [
      report("a", "suspended", 60_000, "keikyu-main", "network-a"),
      report("b", "suspended", 90_000, "keikyu-main", "network-b"),
      report("c", "suspended", 120_000, "keikyu-main", "network-c"),
    ],
    "keikyu-main",
    NOW,
  );

  assert.equal(result.recentSuspended, 3);
  assert.equal(result.detected, true);
});

test("既知のWeb Pushサービスだけを許可する", () => {
  assert.equal(
    isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"),
    true,
  );
  assert.equal(
    isAllowedPushEndpoint("https://web.push.apple.com/Q123"),
    true,
  );
  assert.equal(
    isAllowedPushEndpoint(
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ),
    true,
  );
  assert.equal(
    isAllowedPushEndpoint("https://example.com/internal"),
    false,
  );
  assert.equal(
    isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"),
    false,
  );
  assert.equal(
    isAllowedPushEndpoint(
      "https://name:password@fcm.googleapis.com/fcm/send/abc",
    ),
    false,
  );
});

test("コミュニティ保存領域・hash・通知tagを京急版namespaceへ分離する", () => {
  assert.equal(COMMUNITY_NAMESPACE, "train-live-map-keikyu");
  for (const value of [
    COMMUNITY_REPORTER_STORAGE_KEY,
    COMMUNITY_PUSH_LINES_STORAGE_KEY,
    COMMUNITY_REPORTS_REDIS_KEY,
    COMMUNITY_PUSH_SUBSCRIPTIONS_REDIS_KEY,
    communityReporterHashSeed("reporter"),
    pushSubscriptionHashSeed("https://example.invalid/push"),
    communityPushTag("keikyu-main"),
  ]) {
    assert.equal(value.startsWith(`${COMMUNITY_NAMESPACE}:`), true);
  }
});
