"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ProviderSource } from "@/types/train";

interface Presence {
  present: number;
  total: number;
}

interface DebugResponse {
  snapshot: {
    odptConfigured: boolean;
    operatorId: string;
    operatorConfirmed: boolean;
    baseUrl: string;
    activeSource: ProviderSource;
    success: boolean;
    count: number;
    durationMs: number | null;
    fetchedAt: string;
    error: string | null;
    rawSample: unknown;
    probes: Array<{
      key: string;
      label: string;
      success: boolean;
      count: number;
      durationMs: number | null;
      error: string | null;
    }>;
    availableRailways: string[];
    railways: Array<{
      odptId: string;
      title: string;
      identifiedLineId: string | null;
      identifiedLineName: string | null;
      stationCount: number;
      stationNames: string[];
      hasRegion: boolean;
      geometryType: string | null;
      ascendingRailDirection: string | null;
      descendingRailDirection: string | null;
    }>;
    missingExpectedLines: string[];
    trainFieldPresence: Record<string, Presence>;
    informationFieldPresence: Record<string, Presence>;
    stationFieldPresence: Record<string, Presence>;
    observedRailDirections: string[];
    observedTrainTypes: string[];
    observedDestinations: string[];
  };
  service: {
    trains: {
      source: ProviderSource;
      isMock: boolean;
      fallback: boolean;
      notice: string | null;
      count: number;
    };
    serviceStatus: {
      source: ProviderSource;
      isMock: boolean;
      fallback: boolean;
      severity: string;
      message: string;
    };
  };
  totalDurationMs: number;
}

export function DebugView() {
  const [data, setData] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dev/debug", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as DebugResponse);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "取得に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 text-rail-text">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            Train Live Map｜京急線版 — Debug
          </h1>
          <p className="text-xs text-rail-muted">
            チャレンジ2026 ODPT フィールド確認（開発時のみ）
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="pressable flex min-h-11 items-center gap-1.5 rounded-xl border border-rail-border bg-rail-surface px-3 text-sm font-bold hover:border-rail-accent focus-visible:outline-none"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden
          />
          再取得
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/50 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-4">
          <Section title="接続概要">
            <Row
              label="ODPT 設定済み"
              value={data.snapshot.odptConfigured ? "はい" : "いいえ"}
            />
            <Row label="operator ID" value={data.snapshot.operatorId} />
            <Row
              label="operator 応答確認"
              value={data.snapshot.operatorConfirmed ? "✅ 確認" : "❌ 未確認"}
              danger={!data.snapshot.operatorConfirmed}
            />
            <Row label="ベース URL" value={data.snapshot.baseUrl} />
            <Row label="odpt:Train" value={`${data.snapshot.count} 件`} />
            <Row
              label="通信時間"
              value={
                data.snapshot.durationMs === null
                  ? "—"
                  : `${data.snapshot.durationMs} ms`
              }
            />
            <Row label="使用中 Provider" value={data.snapshot.activeSource} />
            {data.snapshot.error && (
              <Row label="エラー" value={data.snapshot.error} danger />
            )}
          </Section>

          <Section title="API 取得可否">
            {data.snapshot.probes.map((probe) => (
              <div
                key={probe.key}
                className="border-b border-rail-border/50 py-1.5 text-sm last:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="break-all text-rail-muted">
                    {probe.label}
                  </span>
                  <span className="shrink-0">
                    {probe.success
                      ? `✅ ${probe.count}件 / ${probe.durationMs ?? "—"}ms`
                      : "❌ 失敗"}
                  </span>
                </div>
                {probe.error && (
                  <p className="mt-1 break-all text-xs text-red-800">
                    {probe.error}
                  </p>
                )}
              </div>
            ))}
          </Section>

          <Section title="路線 ID・駅順・線形・上下方向">
            {data.snapshot.railways.map((railway) => (
              <div
                key={railway.odptId}
                className="border-b border-rail-border/50 py-2 text-xs last:border-0"
              >
                <p className="font-semibold">
                  {railway.identifiedLineName ?? "対象外"} / {railway.title}
                </p>
                <p className="break-all text-rail-muted">{railway.odptId}</p>
                <p>
                  駅 {railway.stationCount}件 / ug:region{" "}
                  {railway.hasRegion
                    ? `あり (${railway.geometryType})`
                    : "なし"}
                </p>
                <p className="break-all">
                  上り: {railway.ascendingRailDirection ?? "—"} / 下り:{" "}
                  {railway.descendingRailDirection ?? "—"}
                </p>
                <p className="mt-1 break-all text-rail-muted">
                  {railway.stationNames.join(" → ") || "駅順なし"}
                </p>
              </div>
            ))}
            {data.snapshot.missingExpectedLines.length > 0 && (
              <p className="mt-2 text-sm text-red-800">
                未識別: {data.snapshot.missingExpectedLines.join(", ")}
              </p>
            )}
          </Section>

          <Section title="主要フィールドの有無">
            <PresenceRows
              prefix="Train"
              values={data.snapshot.trainFieldPresence}
            />
            <PresenceRows
              prefix="TrainInformation"
              values={data.snapshot.informationFieldPresence}
            />
            <PresenceRows
              prefix="Station"
              values={data.snapshot.stationFieldPresence}
            />
          </Section>

          <Section title="観測値（推測なし）">
            <Row
              label="上下方向 ID"
              value={data.snapshot.observedRailDirections.join(", ") || "—"}
            />
            <Row
              label="列車種別 ID"
              value={data.snapshot.observedTrainTypes.join(", ") || "—"}
            />
            <Row
              label="行先駅 ID"
              value={data.snapshot.observedDestinations.join(", ") || "—"}
            />
          </Section>

          <Section title="サービス層（フォールバック込み）">
            <Row label="列車 source" value={data.service.trains.source} />
            <Row
              label="列車 fallback"
              value={String(data.service.trains.fallback)}
            />
            <Row label="列車 件数" value={String(data.service.trains.count)} />
            <Row label="notice" value={data.service.trains.notice ?? "—"} />
            <Row
              label="運行情報 source"
              value={data.service.serviceStatus.source}
            />
            <Row
              label="運行情報 severity"
              value={data.service.serviceStatus.severity}
            />
            <Row
              label="合計処理時間"
              value={`${data.totalDurationMs} ms`}
            />
          </Section>

          <Section title="生レスポンス（先頭3件、トークン非表示）">
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-100">
              {JSON.stringify(data.snapshot.rawSample, null, 2)}
            </pre>
          </Section>
        </div>
      )}
    </main>
  );
}

function PresenceRows({
  prefix,
  values,
}: {
  prefix: string;
  values: Record<string, Presence>;
}) {
  return Object.entries(values).map(([field, presence]) => (
    <Row
      key={`${prefix}:${field}`}
      label={`${prefix}.${field}`}
      value={`${presence.present} / ${presence.total}`}
    />
  ));
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-rail-border bg-rail-surface p-4 shadow-[0_8px_24px_rgba(72,37,46,0.08)]">
      <h2 className="mb-2 text-sm font-bold text-rail-accent">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-rail-border/50 py-1 text-sm last:border-0">
      <span className="shrink-0 text-rail-muted">{label}</span>
      <span
        className={`break-all text-right ${
          danger ? "text-red-800" : "text-rail-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
