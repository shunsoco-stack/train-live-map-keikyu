import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { COMMUNITY_NAMESPACE } from "../lib/communityNamespace.ts";

interface HeaderReader {
  get(name: string): string | null;
}

const UNKNOWN_NETWORK = "unknown";
const MAX_IP_VALUE_LENGTH = 64;
const MAX_FORWARDED_FOR_LENGTH = MAX_IP_VALUE_LENGTH * 2 + 2;
const NETWORK_HASH_CONTEXT =
  `${COMMUNITY_NAMESPACE}:community:network-rate:v1`;

function singleValidIp(value: string | null): string | null {
  if (!value || value.length > MAX_IP_VALUE_LENGTH) return null;
  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.includes(",") ||
    isIP(candidate) === 0
  ) {
    return null;
  }
  return candidate.toLowerCase();
}

function forwardedClientIp(value: string | null): string | null {
  if (!value || value.length > MAX_FORWARDED_FOR_LENGTH) return null;

  const addresses = value.split(",");
  if (addresses.length === 1) {
    return singleValidIp(addresses[0]);
  }

  // Google Load Balancing appends exactly <client-ip>,<load-balancer-ip>.
  // A client-supplied X-Forwarded-For value appears before those two entries,
  // so never select from a chain with three or more entries.
  if (addresses.length !== 2) return null;

  const clientIp = singleValidIp(addresses[0]);
  const loadBalancerIp = singleValidIp(addresses[1]);
  return clientIp && loadBalancerIp ? clientIp : null;
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
 * persisting, or logging the source IP. Vercel's dedicated header remains
 * authoritative when present. Otherwise, a single source IP or Google Load
 * Balancing's exact client/load-balancer pair is accepted; malformed or
 * client-supplied proxy chains fail closed into one shared "unknown" bucket.
 */
export function requestNetworkHash(headers: HeaderReader): string {
  const vercelForwardedFor = headers.get("x-vercel-forwarded-for");
  const address =
    vercelForwardedFor !== null
      ? (singleValidIp(vercelForwardedFor) ?? UNKNOWN_NETWORK)
      : (forwardedClientIp(headers.get("x-forwarded-for")) ?? UNKNOWN_NETWORK);

  return createHmac("sha256", hashingKey())
    .update(NETWORK_HASH_CONTEXT)
    .update("\0")
    .update(address)
    .digest("hex")
    .slice(0, 32);
}
