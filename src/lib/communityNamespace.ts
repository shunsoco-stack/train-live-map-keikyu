/**
 * 他エディションと、ブラウザー保存領域・KV・通知を
 * 共有しないための固定namespace。
 */
export const COMMUNITY_NAMESPACE = "train-live-map-keikyu";

export const COMMUNITY_REPORTER_STORAGE_KEY =
  `${COMMUNITY_NAMESPACE}:community:reporter:v1`;
export const COMMUNITY_PUSH_LINES_STORAGE_KEY =
  `${COMMUNITY_NAMESPACE}:community:push-lines:v1`;

export const COMMUNITY_REPORTS_REDIS_KEY =
  `${COMMUNITY_NAMESPACE}:community:reports:v1`;
export const COMMUNITY_PUSH_SUBSCRIPTIONS_REDIS_KEY =
  `${COMMUNITY_NAMESPACE}:community:push-subscriptions:v1`;

export function communityReporterHashSeed(reporterId: string): string {
  return `${COMMUNITY_NAMESPACE}:community:reporter:v1:${reporterId}`;
}

export function pushSubscriptionHashSeed(endpoint: string): string {
  return `${COMMUNITY_NAMESPACE}:community:push-subscription:v1:${endpoint}`;
}

export function communityPushTopicSeed(lineId: string): string {
  return `${COMMUNITY_NAMESPACE}:community:suspension:v1:${lineId}`;
}

export function communityPushTag(lineId: string): string {
  const safeLineId =
    lineId.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 100) || "unknown";
  return `${COMMUNITY_NAMESPACE}:community:suspension:${safeLineId}`;
}
