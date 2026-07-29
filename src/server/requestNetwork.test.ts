import assert from "node:assert/strict";
import test from "node:test";
import { requestNetworkHash } from "./requestNetwork.ts";

function headers(values: Record<string, string | undefined>) {
  const normalized = new Map(
    Object.entries(values).map(([name, value]) => [
      name.toLowerCase(),
      value,
    ]),
  );
  return {
    get(name: string): string | null {
      return normalized.get(name.toLowerCase()) ?? null;
    },
  };
}

test("Vercelの転送元IPを優先して不可逆な識別子だけを返す", () => {
  const sourceIp = "203.0.113.24";
  const hash = requestNetworkHash(
    headers({
      "x-vercel-forwarded-for": sourceIp,
      "x-forwarded-for": "198.51.100.10",
    }),
  );
  const same = requestNetworkHash(
    headers({ "x-vercel-forwarded-for": sourceIp }),
  );

  assert.equal(hash, same);
  assert.match(hash, /^[a-f0-9]{32}$/);
  assert.equal(hash.includes(sourceIp), false);
});

test("VercelヘッダーはIPv6も受け入れる", () => {
  const sourceIp = "2001:DB8:ABCD:1::24";

  assert.equal(
    requestNetworkHash(headers({ "x-vercel-forwarded-for": sourceIp })),
    requestNetworkHash(
      headers({ "x-vercel-forwarded-for": sourceIp.toLowerCase() }),
    ),
  );
});

test("Vercelヘッダーがなければ単一のIPv4またはIPv6を使う", () => {
  const ipv4 = requestNetworkHash(
    headers({ "x-forwarded-for": "198.51.100.10" }),
  );
  const differentIpv4 = requestNetworkHash(
    headers({ "x-forwarded-for": "198.51.100.11" }),
  );
  const ipv6 = requestNetworkHash(
    headers({ "x-forwarded-for": "2001:db8:abcd:1::10" }),
  );
  const differentIpv6 = requestNetworkHash(
    headers({ "x-forwarded-for": "2001:db8:abcd:1::11" }),
  );

  assert.notEqual(ipv4, differentIpv4);
  assert.notEqual(ipv6, differentIpv6);
});

test("Google Load BalancerのIPv4ペアからクライアントIPだけを使う", () => {
  const clientIp = "203.0.113.24";

  assert.equal(
    requestNetworkHash(
      headers({
        "x-forwarded-for": `${clientIp}, 198.51.100.80`,
      }),
    ),
    requestNetworkHash(headers({ "x-forwarded-for": clientIp })),
  );
  assert.notEqual(
    requestNetworkHash(
      headers({
        "x-forwarded-for": `${clientIp}, 198.51.100.80`,
      }),
    ),
    requestNetworkHash(
      headers({
        "x-forwarded-for": "203.0.113.25, 198.51.100.80",
      }),
    ),
  );
});

test("Google Load BalancerのIPv6ペアからクライアントIPだけを使う", () => {
  const clientIp = "2001:DB8:ABCD:1::1234";

  assert.equal(
    requestNetworkHash(
      headers({
        "x-forwarded-for": `${clientIp}, 2001:db8:ffff::80`,
      }),
    ),
    requestNetworkHash(
      headers({ "x-forwarded-for": clientIp.toLowerCase() }),
    ),
  );
});

test("クライアントが付加した転送チェーンはunknownに閉じる", () => {
  const unknown = requestNetworkHash(headers({}));

  assert.equal(
    requestNetworkHash(
      headers({
        "x-forwarded-for":
          "192.0.2.99, 203.0.113.24, 198.51.100.80",
      }),
    ),
    unknown,
  );
});

test("欠落・不正なIP・壊れたLBペアはunknownに閉じる", () => {
  const unknown = requestNetworkHash(headers({}));

  for (const forwardedFor of [
    "",
    "not-an-ip",
    "203.0.113.24, not-an-ip",
    "not-an-ip, 198.51.100.80",
    "203.0.113.24,",
    ",198.51.100.80",
  ]) {
    assert.equal(
      requestNetworkHash(headers({ "x-forwarded-for": forwardedFor })),
      unknown,
    );
  }
});

test("不正なVercelヘッダーがあればx-forwarded-forへフォールバックしない", () => {
  const unknown = requestNetworkHash(headers({}));

  assert.equal(
    requestNetworkHash(
      headers({
        "x-vercel-forwarded-for": "not-an-ip",
        "x-forwarded-for": "203.0.113.5",
      }),
    ),
    unknown,
  );
  assert.equal(
    requestNetworkHash(
      headers({
        "x-vercel-forwarded-for": "203.0.113.1, 198.51.100.2",
        "x-forwarded-for": "203.0.113.5, 198.51.100.80",
      }),
    ),
    unknown,
  );
});
