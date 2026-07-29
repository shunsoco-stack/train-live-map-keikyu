import { createHash } from "node:crypto";
import webpush from "web-push";
import {
  communityPushTag,
  communityPushTopicSeed,
} from "@/lib/communityNamespace";
import { detectSuspensionSpike } from "@/lib/communityPush";
import { createLogger } from "@/lib/logger";
import { getPushSubscriptionStore } from "@/server/pushSubscriptionStore";
import type { CommunityReportRecord } from "@/types/community";

const logger = createLogger("keikyu-community-push");
const SEND_BATCH_SIZE = 20;

export interface VapidConfiguration {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * ブラウザー公開鍵とサーバー署名鍵が同じVAPID鍵ペアである場合だけ有効化する。
 * 未設定・不一致時はPushだけを安全に無効化し、PWAのSW登録は妨げない。
 */
export function vapidConfiguration(): VapidConfiguration | null {
  const browserPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (
    !browserPublicKey ||
    !publicKey ||
    browserPublicKey !== publicKey ||
    !privateKey ||
    !subject ||
    !/^(mailto:[^@\s]+@[^@\s]+|https:\/\/\S+)$/i.test(subject)
  ) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function statusCodeFromError(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return null;
}

interface NotifyInput {
  reports: readonly CommunityReportRecord[];
  lineId: string;
  lineName: string;
  now?: number;
}

export interface NotifyResult {
  detected: boolean;
  attempted: number;
  sent: number;
  removed: number;
}

export async function maybeSendSuspensionSpikeNotification({
  reports,
  lineId,
  lineName,
  now = Date.now(),
}: NotifyInput): Promise<NotifyResult> {
  const spike = detectSuspensionSpike(reports, lineId, now);
  const vapid = vapidConfiguration();
  const store = getPushSubscriptionStore();

  if (!spike.detected || !vapid || !store.persistent) {
    return {
      detected: spike.detected,
      attempted: 0,
      sent: 0,
      removed: 0,
    };
  }

  const subscriptions = (await store.listActive(now))
    .map((item) => item.record)
    .filter((record) => record.lineIds.includes(lineId));
  if (subscriptions.length === 0) {
    return { detected: true, attempted: 0, sent: 0, removed: 0 };
  }

  const claimed = await store.claimLineAlert(lineId);
  if (!claimed) {
    return { detected: true, attempted: 0, sent: 0, removed: 0 };
  }

  webpush.setVapidDetails(
    vapid.subject,
    vapid.publicKey,
    vapid.privateKey,
  );

  const payload = JSON.stringify({
    title: `みんなの情報：${lineName}で見合わせ投稿が急増`,
    body:
      `直近5分で利用者から${spike.recentSuspended}件の投稿がありました。` +
      "京急電鉄の公式情報ではありません。公式の運行情報も確認してください。",
    icon: "/icons/train-live-map-keikyu-192.png",
    badge: "/icons/train-live-map-keikyu-192.png",
    url: "/",
    tag: communityPushTag(lineId),
    lineId,
  });
  const topic = createHash("sha256")
    .update(communityPushTopicSeed(lineId))
    .digest("base64url")
    .slice(0, 32);

  let sent = 0;
  let removed = 0;

  for (
    let index = 0;
    index < subscriptions.length;
    index += SEND_BATCH_SIZE
  ) {
    const batch = subscriptions.slice(index, index + SEND_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((record) =>
        webpush.sendNotification(record.subscription, payload, {
          TTL: 10 * 60,
          urgency: "high",
          topic,
        }),
      ),
    );

    for (let offset = 0; offset < results.length; offset += 1) {
      const result = results[offset];
      if (result.status === "fulfilled") {
        sent += 1;
        continue;
      }

      const statusCode = statusCodeFromError(result.reason);
      if (statusCode === 404 || statusCode === 410) {
        await store.removeById(batch[offset].id);
        removed += 1;
      } else {
        logger.warn("Web Push delivery failed", {
          lineId,
          statusCode,
        });
      }
    }
  }

  logger.info("Community suspension spike notification completed", {
    lineId,
    reports: spike.recentSuspended,
    attempted: subscriptions.length,
    sent,
    removed,
  });

  return {
    detected: true,
    attempted: subscriptions.length,
    sent,
    removed,
  };
}
