export interface RedisConfiguration {
  url: string;
  token: string;
}

interface RedisResponse<T> {
  result: T;
}

export function redisConfiguration(): RedisConfiguration | null {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;

  try {
    const parsed = new URL(url);
    const localHttp =
      parsed.protocol === "http:" &&
      /^(localhost|127\.0\.0\.1)$/.test(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return null;
    if (parsed.username || parsed.password) return null;
  } catch {
    return null;
  }

  return { url: url.replace(/\/$/, ""), token };
}

export async function redisCommand<T>(
  config: RedisConfiguration,
  command: Array<string | number>,
): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Redis request failed (${response.status})`);
  }
  const data = (await response.json()) as RedisResponse<T>;
  return data.result;
}
