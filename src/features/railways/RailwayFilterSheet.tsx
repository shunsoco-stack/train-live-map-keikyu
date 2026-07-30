"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Layers3,
  Loader2,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { defaultVisibleRailwayIds } from "@/data/railwayCatalog";
import { AccessibleSheet } from "@/components/AccessibleSheet";
import {
  FAVORITE_LINES_STORAGE_KEY,
  filterRailwayOptions,
  parseStoredRailwayIds,
  toggleRailwayId,
} from "@/lib/railwayPreferences";
import type { RailwayFilterOption } from "@/types/railway";

interface RailwayFilterSheetProps {
  options: RailwayFilterOption[];
  visibleIds: ReadonlySet<string>;
  onChange: (ids: Set<string>) => void;
  loading: boolean;
}

export function RailwayFilterSheet({
  options,
  visibleIds,
  onChange,
  loading,
}: RailwayFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let restored = new Set<string>();
    try {
      const stored = window.localStorage.getItem(FAVORITE_LINES_STORAGE_KEY);
      restored =
        parseStoredRailwayIds(
          stored,
          new Set(options.map((option) => option.id)),
        ) ?? new Set();
    } catch {
      // 保存値が壊れている場合は、お気に入りなしで開始する。
    }
    const frame = window.requestAnimationFrame(() => {
      setFavoriteIds(restored);
      setFavoritesLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [options]);

  useEffect(() => {
    if (!favoritesLoaded) return;
    try {
      window.localStorage.setItem(
        FAVORITE_LINES_STORAGE_KEY,
        JSON.stringify([...favoriteIds]),
      );
    } catch {
      // Storage can be blocked in private or embedded browsing contexts.
    }
  }, [favoriteIds, favoritesLoaded]);

  const availableOptions = useMemo(
    () => options.filter((option) => option.available),
    [options],
  );
  const selectedCount = availableOptions.filter((option) =>
    visibleIds.has(option.id),
  ).length;

  const grouped = useMemo(() => {
    const filtered = filterRailwayOptions(
      options,
      query,
      favoritesOnly,
      favoriteIds,
    );
    const groups = new Map<string, RailwayFilterOption[]>();
    for (const option of filtered) {
      const group = groups.get(option.category) ?? [];
      group.push(option);
      groups.set(option.category, group);
    }
    return [...groups.entries()];
  }, [favoriteIds, favoritesOnly, options, query]);

  const toggle = (id: string) => {
    onChange(toggleRailwayId(visibleIds, id));
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => toggleRailwayId(current, id));
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="pressable pointer-events-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rail-accent px-3 text-sm font-bold text-white shadow-[0_6px_14px_rgba(184,0,36,0.18)] hover:bg-[#b80024] focus-visible:outline-none"
        aria-label={`表示路線を選ぶ。${selectedCount}路線を表示中`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="railway-filter-dialog"
      >
        <Layers3 className="h-4 w-4" aria-hidden />
        <span>路線</span>
        <span className="min-w-6 rounded-full bg-black/20 px-1.5 py-0.5 text-center text-xs tabular-nums text-white">
          {selectedCount}
        </span>
      </button>

      <AccessibleSheet
        id="railway-filter-dialog"
        open={open}
        onOpenChange={setOpen}
        labelledBy="railway-filter-title"
        describedBy="railway-filter-summary"
        returnFocusRef={triggerRef}
        initialFocusRef={closeRef}
        className="app-dialog"
        surfaceClassName="app-dialog-card app-sheet safe-bottom relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border sm:rounded-3xl"
        bodyClassName="flex min-h-0 flex-col"
      >
            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-5">
              <div>
                <h2 id="railway-filter-title" className="text-xl font-extrabold tracking-[-0.02em] text-rail-text">
                  表示する路線
                </h2>
                <p id="railway-filter-summary" className="mt-0.5 text-xs font-semibold text-rail-muted">
                  {selectedCount} / {availableOptions.length} 路線を表示中
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="pressable flex h-11 w-11 items-center justify-center rounded-full text-rail-muted hover:bg-black/5 focus-visible:outline-none"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="px-4 pb-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rail-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="路線名を検索"
                  className="h-11 w-full rounded-xl border border-rail-border bg-white/80 pl-9 pr-3 text-sm text-rail-text outline-none placeholder:text-rail-muted focus:border-rail-accent focus:ring-2 focus:ring-[#e6002d]/20"
                />
              </div>

              <button
                type="button"
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly((current) => !current)}
                className={`pressable mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 ${
                  favoritesOnly
                    ? "border-yellow-500/50 bg-yellow-50 text-yellow-900"
                    : "border-rail-border bg-white/70 text-rail-muted hover:border-yellow-500/50"
                }`}
              >
                <Star
                  className="h-4 w-4"
                  fill={favoritesOnly ? "currentColor" : "none"}
                  aria-hidden
                />
                <span>お気に入り</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs tabular-nums">
                  {favoriteIds.size}
                </span>
              </button>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onChange(defaultVisibleRailwayIds(options))}
                  className="pressable flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#e7a7b4] bg-[#fff0f3] px-2 text-xs font-bold text-[#8d102a] focus-visible:outline-none"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  おすすめ
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange(new Set(availableOptions.map((option) => option.id)))
                  }
                  className="pressable min-h-11 rounded-xl border border-rail-border bg-white/70 px-2 text-xs font-bold text-rail-muted hover:border-[#e7a7b4] hover:text-rail-text focus-visible:outline-none"
                >
                  すべて
                </button>
                <button
                  type="button"
                  onClick={() => onChange(new Set())}
                  className="pressable min-h-11 rounded-xl border border-rail-border bg-white/70 px-2 text-xs font-bold text-rail-muted hover:border-[#e7a7b4] hover:text-rail-text focus-visible:outline-none"
                >
                  隠す
                </button>
              </div>
            </div>

            <div className="overflow-y-auto border-t border-rail-border px-4 pb-5">
              {loading && (
                <div className="flex items-center gap-2 py-3 text-xs text-rail-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  利用可能な路線を確認中…
                </div>
              )}

              {grouped.map(([category, categoryOptions]) => (
                <div key={category} className="pt-4">
                  <h3 className="mb-2 text-xs font-extrabold text-rail-accent">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {categoryOptions.map((option) => {
                      const selected = visibleIds.has(option.id);
                      const favorite = favoriteIds.has(option.id);
                      const unavailable = !option.available;
                      const note =
                        option.coverageNote ??
                        (unavailable ? "現在は位置情報を取得できません" : null);

                      return (
                        <div
                          key={option.id}
                          className={`flex min-h-12 overflow-hidden rounded-xl border transition-colors ${
                            selected
                              ? "border-[#e7a7b4] bg-[#fff0f3]"
                              : "border-rail-border bg-white/70"
                          } hover:border-[#dc91a0]`}
                        >
                          <button
                            type="button"
                            disabled={unavailable}
                            aria-pressed={selected}
                            onClick={() => toggle(option.id)}
                            className={`pressable flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e6002d] ${
                              unavailable
                                ? "cursor-not-allowed opacity-45"
                                : ""
                            }`}
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-black/15"
                              style={{ backgroundColor: option.color }}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-rail-text">
                                {option.name}
                              </span>
                              {note && (
                                <span className="mt-0.5 block text-[0.6875rem] leading-tight text-rail-muted">
                                  {note}
                                </span>
                              )}
                            </span>
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                selected
                                  ? "border-[#ff9bae] bg-rail-accent text-white"
                                  : "border-rail-border text-transparent"
                              }`}
                              aria-hidden
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-pressed={favorite}
                            aria-label={`${option.name}をお気に入り${
                              favorite ? "から解除" : "に登録"
                            }`}
                            onClick={() => toggleFavorite(option.id)}
                            className={`pressable flex w-12 shrink-0 items-center justify-center border-l focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-200 ${
                              favorite
                                ? "border-yellow-500/30 bg-yellow-50 text-yellow-700"
                                : "border-rail-border text-rail-muted hover:bg-black/5 hover:text-yellow-700"
                            }`}
                          >
                            <Star
                              className="h-5 w-5"
                              fill={favorite ? "currentColor" : "none"}
                              aria-hidden
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {grouped.length === 0 && (
                <p className="py-8 text-center text-sm text-rail-muted">
                  {favoritesOnly && favoriteIds.size === 0
                    ? "路線右端の☆からお気に入りを登録できます。"
                    : "該当する路線がありません。"}
                </p>
              )}
            </div>
      </AccessibleSheet>
    </>
  );
}
