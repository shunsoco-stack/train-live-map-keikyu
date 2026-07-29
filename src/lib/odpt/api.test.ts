import assert from "node:assert/strict";
import test from "node:test";
import { fetchOdptTrainsForOperator, OdptApiError } from "./api.ts";
import {
  KEIKYU_OPERATOR_ID,
  ODPT_CHALLENGE_API_BASE_URL,
  ODPT_CHALLENGE_LICENSE_CUTOFF_MS,
  type OdptConfig,
} from "./config.ts";

const CONFIG: OdptConfig = {
  baseUrl: ODPT_CHALLENGE_API_BASE_URL,
  accessToken: "test-token",
  liveDataApproved: true,
  operator: KEIKYU_OPERATOR_ID,
  timeoutMs: 1_000,
  retries: 0,
};

test("トークンがあっても特定利用条件の承認ゲートがfalseなら通信しない", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response("[]", { status: 200 });
  };

  try {
    await assert.rejects(
      fetchOdptTrainsForOperator(KEIKYU_OPERATOR_ID, {
        ...CONFIG,
        liveDataApproved: false,
      }),
      (error: unknown) =>
        error instanceof OdptApiError &&
        error.kind === "config" &&
        /特定利用条件/.test(error.message),
    );
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("期限前に開始したAPI応答でも期限後はアプリへ返さない", async () => {
  const originalNow = Date.now;
  const originalFetch = globalThis.fetch;
  let nowMs = ODPT_CHALLENGE_LICENSE_CUTOFF_MS - 1;
  let fetchCalls = 0;

  Date.now = () => nowMs;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    nowMs = ODPT_CHALLENGE_LICENSE_CUTOFF_MS;
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await assert.rejects(
      fetchOdptTrainsForOperator(KEIKYU_OPERATOR_ID, CONFIG),
      (error: unknown) =>
        error instanceof OdptApiError &&
        error.kind === "config" &&
        /2027年3月14日/.test(error.message),
    );
    assert.equal(fetchCalls, 1);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});
