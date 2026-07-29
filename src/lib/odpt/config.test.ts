import assert from "node:assert/strict";
import test from "node:test";
import {
  getOdptAvailability,
  isOdptConfigured,
  KEIKYU_OPERATOR_ID,
  ODPT_CHALLENGE_API_BASE_URL,
  ODPT_CHALLENGE_LICENSE_CUTOFF_MS,
  odptAvailabilityReasonText,
  type OdptConfig,
} from "./config.ts";

const TOKEN_CONFIG: OdptConfig = {
  baseUrl: ODPT_CHALLENGE_API_BASE_URL,
  accessToken: "test-token",
  liveDataApproved: true,
  operator: KEIKYU_OPERATOR_ID,
  timeoutMs: 8_000,
  retries: 0,
};

test("2027-03-14 JST の終了まではトークン設定時にODPTを利用できる", () => {
  const lastMillisecond = ODPT_CHALLENGE_LICENSE_CUTOFF_MS - 1;
  assert.deepEqual(getOdptAvailability(TOKEN_CONFIG, lastMillisecond), {
    available: true,
    reason: "available",
  });
  assert.equal(isOdptConfigured(TOKEN_CONFIG, lastMillisecond), true);
});

test("2027-03-15 00:00 JST 以降はトークンが残っていてもmock-onlyにする", () => {
  assert.deepEqual(
    getOdptAvailability(
      TOKEN_CONFIG,
      ODPT_CHALLENGE_LICENSE_CUTOFF_MS,
    ),
    {
      available: false,
      reason: "challenge-license-ended",
    },
  );
  assert.equal(
    isOdptConfigured(
      TOKEN_CONFIG,
      ODPT_CHALLENGE_LICENSE_CUTOFF_MS + 86_400_000,
    ),
    false,
  );
});

test("期限内でもトークンが無ければ未設定理由を返す", () => {
  const availability = getOdptAvailability(
    { ...TOKEN_CONFIG, accessToken: "" },
    ODPT_CHALLENGE_LICENSE_CUTOFF_MS - 1,
  );
  assert.deepEqual(availability, {
    available: false,
    reason: "token-missing",
  });
});

test("トークンがあっても特定利用条件の確認記録がなければODPTを呼ばない", () => {
  const availability = getOdptAvailability(
    { ...TOKEN_CONFIG, liveDataApproved: false },
    ODPT_CHALLENGE_LICENSE_CUTOFF_MS - 1,
  );
  assert.deepEqual(availability, {
    available: false,
    reason: "terms-not-approved",
  });
  assert.equal(
    odptAvailabilityReasonText(availability.reason)?.includes(
      "特定利用条件",
    ),
    true,
  );
});

test("期限終了理由はデバッグに表示できる安全な説明文を持つ", () => {
  const message = odptAvailabilityReasonText(
    "challenge-license-ended",
  );
  assert.match(message ?? "", /2027年3月14日/);
  assert.match(message ?? "", /モック動作中/);
  assert.equal(message?.includes("test-token"), false);
});
