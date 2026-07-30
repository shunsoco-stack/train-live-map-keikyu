import assert from "node:assert/strict";
import test from "node:test";
import { resolveProviderValue } from "./providerFallback.ts";
import { providerNotice } from "./trainLocationServicePolicy.ts";

test("ODPT応答成功で表示可能列車0件なら実データの空状態として扱う", async () => {
  let mockCalled = false;
  const result = await resolveProviderValue(
    async () => [] as string[],
    async () => {
      mockCalled = true;
      return ["mock"];
    },
    (trains) => trains.length === 0,
  );

  assert.deepEqual(result.value, []);
  assert.equal(result.source, "odpt");
  assert.equal(result.source === "mock", false);
  assert.equal(result.fallback, false);
  assert.equal(mockCalled, false);
  assert.match(
    providerNotice(result.reason, () => "未設定"),
    /現在表示できる列車がありません/,
  );
});

test("ODPT通信失敗時は従来どおりモックとフォールバック通知を返す", async () => {
  const result = await resolveProviderValue(
    async () => {
      throw new Error("API failed");
    },
    async () => ["mock"],
  );

  assert.deepEqual(result.value, ["mock"]);
  assert.equal(result.source, "mock");
  assert.equal(result.fallback, true);
  assert.match(
    providerNotice(result.reason, () => "未設定"),
    /モックデータ/,
  );
});
