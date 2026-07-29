"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdSenseBanner } from "@/components/AdSenseBanner";
import { AppHeader } from "@/components/AppHeader";
import { BrowserGuidance } from "@/components/BrowserGuidance";
import { DataSourceNotice } from "@/components/DataSourceNotice";
import { ErrorNotice } from "@/components/ErrorNotice";
import { defaultVisibleRailwayIds } from "@/data/railwayCatalog";
import { CommunityReportSheet } from "@/features/community/CommunityReportSheet";
import { MapPanel } from "@/features/map/MapPanel";
import { RailwayFilterSheet } from "@/features/railways/RailwayFilterSheet";
import { useRailwayNetwork } from "@/features/railways/useRailwayNetwork";
import { ServiceStatusBar } from "@/features/service-status/ServiceStatusBar";
import { TrainDetailPanel } from "@/features/trains/TrainDetailPanel";
import { TrainFilterBar } from "@/features/trains/TrainFilterBar";
import { useTrainData } from "@/features/trains/useTrainData";
import { useNow } from "@/lib/useNow";
import { serviceStatusesForVisibleLines } from "@/lib/serviceStatus";
import {
  restoreVisibleRailwayIds,
  SELECTION_DEFAULT_VERSION,
  SELECTION_DEFAULT_VERSION_KEY,
  VISIBLE_LINES_STORAGE_KEY,
} from "@/lib/railwayPreferences";
import {
  matchesFilter,
  TRAIN_FILTERS,
  type TrainFilterKey,
} from "@/lib/trainStatus";

/**
 * アプリ全体を束ねるクライアントコンポーネント。
 * データ取得・状態管理・レイアウトを担う。
 */
export function TrainDashboard() {
  const {
    trains,
    serviceStatuses,
    source,
    fallback,
    notice,
    loading,
    error,
    lastUpdatedAt,
    dataUpdatedAt,
    refresh,
  } = useTrainData();
  const {
    lines: railwayLines,
    options: railwayOptions,
    loading: railwayLoading,
  } = useRailwayNetwork();
  const now = useNow(1000);

  const [filter, setFilter] = useState<TrainFilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleLineIds, setVisibleLineIds] = useState<Set<string>>(
    () => new Set(),
  );
  const railwaySelectionReady = useRef(false);

  useEffect(() => {
    if (railwayLoading || railwaySelectionReady.current) return;
    const availableIds = new Set(
      railwayOptions
        .filter((option) => option.available)
        .map((option) => option.id),
    );
    const defaultIds = defaultVisibleRailwayIds(railwayOptions);

    let next = new Set(defaultIds);
    try {
      const stored = window.localStorage.getItem(VISIBLE_LINES_STORAGE_KEY);
      next = restoreVisibleRailwayIds({
        stored,
        storedDefaultVersion: window.localStorage.getItem(
          SELECTION_DEFAULT_VERSION_KEY,
        ),
        availableIds,
        defaultIds,
      });
      window.localStorage.setItem(
        SELECTION_DEFAULT_VERSION_KEY,
        SELECTION_DEFAULT_VERSION,
      );
    } catch {
      // 保存値が壊れている場合は、各方面の先頭路線で開始する。
    }

    setVisibleLineIds(next);
    railwaySelectionReady.current = true;
  }, [railwayLoading, railwayOptions]);

  useEffect(() => {
    if (!railwaySelectionReady.current) return;
    try {
      window.localStorage.setItem(
        VISIBLE_LINES_STORAGE_KEY,
        JSON.stringify([...visibleLineIds]),
      );
    } catch {
      // Storage can be blocked in private or embedded browsing contexts.
    }
  }, [visibleLineIds]);

  const trainsOnVisibleLines = useMemo(
    () => trains.filter((train) => visibleLineIds.has(train.lineId)),
    [trains, visibleLineIds],
  );

  const counts = useMemo(() => {
    const result = {} as Record<TrainFilterKey, number>;
    for (const f of TRAIN_FILTERS) {
      result[f.key] = trainsOnVisibleLines.filter((t) =>
        matchesFilter(t, f.key, now),
      ).length;
    }
    return result;
  }, [trainsOnVisibleLines, now]);

  const filteredTrains = useMemo(
    () => trainsOnVisibleLines.filter((t) => matchesFilter(t, filter, now)),
    [trainsOnVisibleLines, filter, now],
  );

  const visibleServiceStatuses = useMemo(
    () =>
      serviceStatusesForVisibleLines(
        serviceStatuses,
        visibleLineIds,
      ),
    [serviceStatuses, visibleLineIds],
  );

  const selectedTrain = useMemo(
    () => trains.find((t) => t.id === selectedId) ?? null,
    [trains, selectedId],
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-rail-bg">
      <AppHeader
        lastUpdatedAt={lastUpdatedAt}
        dataUpdatedAt={dataUpdatedAt}
        source={source}
      />

      <main className="relative flex-1">
        {/* 地図(画面の中心) */}
        <MapPanel
          trains={filteredTrains}
          railwayLines={railwayLines}
          visibleLineIds={visibleLineIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          now={now}
        />

        <RailwayFilterSheet
          options={railwayOptions}
          visibleIds={visibleLineIds}
          onChange={setVisibleLineIds}
          loading={railwayLoading}
        />

        <CommunityReportSheet
          options={railwayOptions}
          visibleLineIds={visibleLineIds}
        />

        {/* 上部オーバーレイ: 運行情報・エラー */}
        <div className="safe-inline pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 py-3">
          <div className="flex max-h-[30dvh] flex-col gap-2 overflow-y-auto">
            {visibleServiceStatuses.map((status) => (
              <ServiceStatusBar
                key={status.lineId}
                serviceStatus={status}
              />
            ))}
          </div>
          <div className="app-material pointer-events-auto self-start rounded-full border border-[#ff6481]/45 px-2.5 py-1 text-[10px] font-bold text-[#ffdbe2] shadow-lg">
            品川〜泉岳寺はデータ提供対象外・列車非表示
          </div>
          <DataSourceNotice notice={notice} fallback={fallback} />
          {error && <ErrorNotice message={error} onRetry={refresh} />}
        </div>

        {/* 下部オーバーレイ: フィルター */}
        <div className="safe-bottom safe-inline pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 py-3">
          <TrainFilterBar value={filter} onChange={setFilter} counts={counts} />
        </div>

        <BrowserGuidance
          hideSafariInstallGuidance={loading || selectedTrain !== null}
        />

        {/* 初回ロード表示 */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-rail-bg/80">
            <div className="flex items-center gap-2 text-rail-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-sm font-bold">京急線の列車情報を読み込み中…</span>
            </div>
          </div>
        )}
      </main>

      <AdSenseBanner />

      {/* 詳細ボトムシート */}
      <TrainDetailPanel train={selectedTrain} onClose={() => setSelectedId(null)} />
    </div>
  );
}
