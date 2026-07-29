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

test("Vercelヘッダーがなければ単一のx-forwarded-forを使う", () => {
  const forwarded = requestNetworkHash(
    headers({ "x-forwarded-for": "198.51.100.10" }),
  );
  const different = requestNetworkHash(
    headers({ "x-forwarded-for": "198.51.100.11" }),
  );

  assert.notEqual(forwarded, different);
});

test("欠落・不正値・転送チェーンは共通のunknownバケットに閉じる", () => {
  const unknown = requestNetworkHash(headers({}));

  assert.equal(
    requestNetworkHash(
      headers({ "x-forwarded-for": "203.0.113.1, 198.51.100.2" }),
    ),
    unknown,
  );
  assert.equal(
    requestNetworkHash(
      headers({
        "x-vercel-forwarded-for": "not-an-ip",
        "x-forwarded-for": "203.0.113.5",
      }),
    ),
    unknown,
  );
});
