"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, MapPinOff } from "lucide-react";
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
  const [serviceStatusExpanded, setServiceStatusExpanded] = useState(false);
  const [visibleLineIds, setVisibleLineIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [railwaySelectionReady, setRailwaySelectionReady] = useState(false);
  const railwaySelectionInitializedRef = useRef(false);

  useEffect(() => {
    if (railwayLoading || railwaySelectionInitializedRef.current) return;
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
    railwaySelectionInitializedRef.current = true;
    setRailwaySelectionReady(true);
  }, [railwayLoading, railwayOptions]);

  useEffect(() => {
    if (!railwaySelectionInitializedRef.current) return;
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
  const statusCards = useMemo(() => {
    const abnormal = visibleServiceStatuses.filter(
      (status) => status.severity !== "normal",
    );
    return abnormal.length > 0
      ? abnormal
      : visibleServiceStatuses.slice(0, 1);
  }, [visibleServiceStatuses]);
  const visibleStatusCards = serviceStatusExpanded
    ? statusCards
    : statusCards.slice(0, 1);
  const hiddenStatusCount = Math.max(
    0,
    statusCards.length - visibleStatusCards.length,
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#ebe6e8]">
      <AppHeader
        lastUpdatedAt={lastUpdatedAt}
        dataUpdatedAt={dataUpdatedAt}
        source={source}
      />

      <main className="relative flex-1">
        {/* 地図を画面の主役として、操作面は上下に一枚ずつだけ重ねる。 */}
        <MapPanel
          trains={filteredTrains}
          railwayLines={railwayLines}
          visibleLineIds={visibleLineIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          now={now}
        />

        {/* 上部: 最重要の運行状況と信頼情報だけを表示する。 */}
        <div className="safe-inline pointer-events-none absolute inset-x-0 top-0 z-10 flex max-h-[42dvh] flex-col gap-2 py-3">
          <div className="flex flex-col gap-2 overflow-y-auto">
            {visibleStatusCards.map((status) => (
              <ServiceStatusBar
                key={status.lineId}
                serviceStatus={status}
              />
            ))}
            {statusCards.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setServiceStatusExpanded((current) => !current)
                }
                className="app-material pressable pointer-events-auto inline-flex min-h-11 self-start items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-rail-text focus-visible:outline-none"
                aria-expanded={serviceStatusExpanded}
              >
                {serviceStatusExpanded
                  ? "運行情報を閉じる"
                  : `ほか${hiddenStatusCount}件の運行情報`}
                {serviceStatusExpanded ? (
                  <ChevronUp className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                )}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="app-material pointer-events-auto inline-flex min-h-9 items-center gap-1.5 self-start rounded-full border px-3 text-xs font-bold text-[#6f1830]">
              <MapPinOff className="h-3.5 w-3.5 text-rail-accent" aria-hidden />
              <span>品川〜泉岳寺</span>
              <span className="font-semibold text-rail-muted">対象外・列車非表示</span>
            </div>
            {fallback && (
              <DataSourceNotice notice={notice} fallback={fallback} />
            )}
          </div>
          {error && <ErrorNotice message={error} onRetry={refresh} />}
        </div>

        {/* 下部: 絞り込みと主要操作を一つのコントロールアイランドへ統合。 */}
        <div className="safe-bottom safe-inline pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-0">
          <div className="app-material map-control-dock pointer-events-auto mx-auto max-w-lg">
            <TrainFilterBar value={filter} onChange={setFilter} counts={counts} />
            <div className="map-control-divider mt-2 grid grid-cols-2 gap-2 pt-2">
              <CommunityReportSheet
                options={railwayOptions}
                visibleLineIds={visibleLineIds}
              />
              <RailwayFilterSheet
                options={railwayOptions}
                visibleIds={visibleLineIds}
                onChange={setVisibleLineIds}
                loading={railwayLoading}
              />
            </div>
          </div>
        </div>

        {!railwayLoading &&
          railwaySelectionReady &&
          visibleLineIds.size === 0 && (
            <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center px-6 pb-32 pt-24">
              <div className="app-material max-w-xs rounded-3xl border p-5 text-center">
                <MapPinOff
                  className="mx-auto h-7 w-7 text-rail-accent"
                  aria-hidden
                />
                <p className="mt-2 text-base font-extrabold text-rail-text">
                  表示する路線がありません
                </p>
                <p className="mt-1 text-sm leading-6 text-rail-muted">
                  下の「路線」から、地図に表示する路線を選んでください。
                </p>
              </div>
            </div>
          )}

        <BrowserGuidance
          hideSafariInstallGuidance={loading || selectedTrain !== null}
        />

        {/* 初回ロード表示 */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/75 backdrop-blur-sm">
            <div className="app-material flex items-center gap-2 rounded-full border px-4 py-3 text-rail-muted">
              <Loader2 className="h-5 w-5 animate-spin text-rail-accent" aria-hidden />
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
