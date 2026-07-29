import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { COMMUNITY_NAMESPACE } from "../lib/communityNamespace.ts";

interface HeaderReader {
  get(name: string): string | null;
}

const UNKNOWN_NETWORK = "unknown";
const MAX_IP_HEADER_LENGTH = 64;
const NETWORK_HASH_CONTEXT =
  `${COMMUNITY_NAMESPACE}:community:network-rate:v1`;

function singleValidIp(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.length > MAX_IP_HEADER_LENGTH ||
    candidate.includes(",") ||
    isIP(candidate) === 0
  ) {
    return null;
  }
  return candidate.toLowerCase();
}

function hashingKey(): string {
  return (
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.VAPID_PRIVATE_KEY?.trim() ||
    `${NETWORK_HASH_CONTEXT}:local-fallback`
  );
}

/**
 * Produces a stable, server-side rate-limit identity without returning,
 * persisting, or logging the source IP. Vercel supplies the first header and
 * overwrites x-forwarded-for at its edge; malformed proxy chains fail closed
 * into one shared "unknown" bucket.
 */
export function requestNetworkHash(headers: HeaderReader): string {
  const vercelForwardedFor = headers.get("x-vercel-forwarded-for");
  const address =
    vercelForwardedFor !== null
      ? (singleValidIp(vercelForwardedFor) ?? UNKNOWN_NETWORK)
      : (singleValidIp(headers.get("x-forwarded-for")) ?? UNKNOWN_NETWORK);

  return createHmac("sha256", hashingKey())
    .update(NETWORK_HASH_CONTEXT)
    .update("\0")
    .update(address)
    .digest("hex")
    .slice(0, 32);
}
