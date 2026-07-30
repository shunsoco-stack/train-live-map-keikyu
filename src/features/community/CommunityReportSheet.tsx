"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Clock3,
  Loader2,
  OctagonX,
  Send,
  Smartphone,
  UsersRound,
  X,
} from "lucide-react";
import { AccessibleSheet } from "@/components/AccessibleSheet";
import { useCommunityReports } from "@/features/community/useCommunityReports";
import { usePushNotifications } from "@/features/community/usePushNotifications";
import type {
  CommunityReportStatus,
  CommunityReportSummary,
} from "@/types/community";
import type { RailwayFilterOption } from "@/types/railway";

const DELAY_OPTIONS = [1, 3, 5, 10, 15, 20, 30, 45, 60];

interface CommunityReportSheetProps {
  options: RailwayFilterOption[];
  visibleLineIds: ReadonlySet<string>;
}

function summaryLabel(summary: CommunityReportSummary): string {
  if (summary.status === "suspended") {
    return "運転見合わせの投稿";
  }
  if (summary.status === "delayed") {
    return summary.delayMinutes === null
      ? "遅延の投稿（分数情報なし）"
      : `約${summary.delayMinutes}分遅れの投稿`;
  }
  return "平常運転の投稿";
}

function summaryTone(summary: CommunityReportSummary): string {
  if (summary.status === "suspended") {
    return "border-red-500/50 bg-red-50 text-red-900";
  }
  if (summary.status === "delayed") {
    return "border-amber-500/50 bg-amber-50 text-amber-950";
  }
  return "border-emerald-500/40 bg-emerald-50 text-emerald-900";
}

function pushDescription(
  status: ReturnType<typeof usePushNotifications>["status"],
  subscribed: boolean,
  lineName: string,
): string {
  if (status === "checking") {
    return "この端末でPush通知を利用できるか確認しています。";
  }
  if (status === "disabled") {
    return "Push通知は未設定です。PWAのService Worker登録には影響しません。";
  }
  if (status === "unsupported") {
    return "このブラウザーはWeb Push通知に対応していません。";
  }
  if (status === "ios-install-required") {
    return "iPhone・iPadではホーム画面へ追加し、アイコンから起動すると設定できます。";
  }
  if (status === "denied") {
    return "Push通知が拒否されています。端末またはブラウザーの設定を確認してください。";
  }
  if (status === "error") {
    return "Push通知を準備できませんでした。";
  }
  return subscribed
    ? `${lineName}のみんなの情報通知を受信中です。`
    : `${lineName}で見合わせ投稿が急増した場合に通知します。`;
}

export function CommunityReportSheet({
  options,
  visibleLineIds,
}: CommunityReportSheetProps) {
  const [open, setOpen] = useState(false);
  const [preferredLineId, setSelectedLineId] = useState("");
  const [status, setStatus] =
    useState<CommunityReportStatus>("on-time");
  const [delayMinutes, setDelayMinutes] = useState(5);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const {
    summaries,
    loading,
    submitting,
    error,
    success,
    persistent,
    votingEnabled,
    windowMinutes,
    cooldownSeconds,
    submit,
  } = useCommunityReports();
  const push = usePushNotifications();

  const visibleOptions = useMemo(
    () =>
      options.filter(
        (option) =>
          option.available && visibleLineIds.has(option.id),
      ),
    [options, visibleLineIds],
  );
  const selectedLineId = visibleOptions.some(
    (option) => option.id === preferredLineId,
  )
    ? preferredLineId
    : (visibleOptions[0]?.id ?? "");

  const summary = summaries.find(
    (item) => item.lineId === selectedLineId,
  );
  const visibleVoteCount = summaries
    .filter((item) => visibleLineIds.has(item.lineId))
    .reduce((total, item) => total + item.voteCount, 0);
  const selectedLine = visibleOptions.find(
    (option) => option.id === selectedLineId,
  );
  const pushSubscribed =
    selectedLineId !== "" && push.isSubscribed(selectedLineId);

  const submitVote = async () => {
    if (!selectedLineId || !votingEnabled) return;
    await submit({
      lineId: selectedLineId,
      status,
      delayMinutes: status === "delayed" ? delayMinutes : null,
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="pressable pointer-events-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e7a7b4] bg-[#fff0f3] px-2 text-sm font-bold text-[#8d102a] hover:bg-[#ffe5ea] focus-visible:outline-none"
        aria-label={`みんなの情報を開く。表示路線に${visibleVoteCount}件の投稿`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="community-report-dialog"
      >
        <UsersRound className="h-4 w-4 text-rail-accent" aria-hidden />
        <span className="max-[359px]:hidden">みんなの情報</span>
        <span className="hidden max-[359px]:inline">みんな</span>
        {visibleVoteCount > 0 && (
          <span className="min-w-6 rounded-full bg-rail-accent px-1.5 py-0.5 text-center text-xs tabular-nums text-white">
            {visibleVoteCount > 99 ? "99+" : visibleVoteCount}
          </span>
        )}
      </button>

      <AccessibleSheet
        id="community-report-dialog"
        open={open}
        onOpenChange={setOpen}
        labelledBy="community-report-title"
        describedBy="community-report-description"
        returnFocusRef={triggerRef}
        initialFocusRef={closeRef}
        className="app-dialog"
        surfaceClassName="app-dialog-card app-sheet safe-bottom relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border sm:rounded-3xl"
        bodyClassName="flex min-h-0 flex-col"
      >
              <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-5">
                <div>
                  <p className="text-xs font-bold text-rail-accent">
                    直近{windowMinutes}分・利用者投稿
                  </p>
                  <h2
                    id="community-report-title"
                    className="mt-0.5 text-xl font-extrabold tracking-[-0.02em] text-rail-text"
                  >
                    みんなの情報
                  </h2>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="閉じる"
                  className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-rail-muted hover:bg-black/5 focus-visible:outline-none"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="overflow-y-auto border-t border-rail-border px-4 pb-6 pt-4">
                <div id="community-report-description" className="flex gap-2 rounded-2xl border border-amber-400/45 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden
                  />
                  <p>
                    これは利用者投稿で、京急電鉄の公式運行情報ではありません。
                    安全に関わる判断には使用せず、必ず公式情報も確認してください。
                  </p>
                </div>

                {visibleOptions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-rail-muted">
                    先に路線一覧から表示する路線を選んでください。
                  </p>
                ) : (
                  <>
                    <label className="mt-4 block text-xs font-bold text-rail-muted">
                      投稿する表示中の路線
                      <select
                        value={selectedLineId}
                        onChange={(event) =>
                          setSelectedLineId(event.target.value)
                        }
                        className="mt-1.5 h-11 w-full rounded-xl border border-rail-border bg-rail-bg px-3 text-sm font-semibold text-rail-text outline-none focus:border-red-300 focus:ring-2 focus:ring-red-300/25"
                      >
                        {visibleOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div
                      className={`mt-3 rounded-2xl border p-3 ${
                        summary
                          ? summaryTone(summary)
                          : "border-rail-border bg-white/70 text-rail-muted"
                      }`}
                      aria-live="polite"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                selectedLine?.color ?? "#94a3b8",
                            }}
                            aria-hidden
                          />
                          <p className="truncate text-sm font-bold">
                            {selectedLine?.name}
                          </p>
                        </div>
                        {summary && (
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {summary.voteCount}票
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-base font-bold">
                        {loading
                          ? "みんなの情報を確認中…"
                          : summary
                            ? summaryLabel(summary)
                            : "まだ利用者投稿はありません"}
                      </p>
                      {summary && (
                        <p className="mt-1 text-xs opacity-80">
                          平常 {summary.counts.onTime}・遅延{" "}
                          {summary.counts.delayed}・見合わせ{" "}
                          {summary.counts.suspended}
                        </p>
                      )}
                    </div>

                    {selectedLine && (
                      <details className="mt-3 rounded-2xl border border-[#e7a7b4] bg-[#fff7f8] p-3">
                        <summary className="pressable flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-extrabold text-[#8d102a] focus-visible:outline-none">
                          <Bell className="h-4 w-4" aria-hidden />
                          みんなの情報・急増通知
                        </summary>
                        <div className="mt-2 border-t border-[#ead5da] pt-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f3] text-rail-accent">
                            {pushSubscribed ? (
                              <BellRing className="h-5 w-5" aria-hidden />
                            ) : push.status === "denied" ? (
                              <BellOff className="h-5 w-5" aria-hidden />
                            ) : push.status ===
                              "ios-install-required" ? (
                              <Smartphone
                                className="h-5 w-5"
                                aria-hidden
                              />
                            ) : (
                              <Bell className="h-5 w-5" aria-hidden />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-rail-text">
                              みんなの情報・急増通知
                            </p>
                            <p className="mt-1 text-xs leading-5 text-rail-muted">
                              {pushDescription(
                                push.status,
                                pushSubscribed,
                                selectedLine.name,
                              )}
                            </p>

                            {push.status === "available" && (
                              <button
                                type="button"
                                aria-pressed={pushSubscribed}
                                disabled={push.busy}
                                onClick={() =>
                                  void push.toggleLine(selectedLine.id)
                                }
                                className={`pressable mt-2 min-h-11 w-full rounded-xl border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50 ${
                                  pushSubscribed
                                    ? "border-[#e7a7b4] bg-[#fff0f3] text-[#8d102a]"
                                    : "border-rail-border bg-white text-rail-text"
                                }`}
                              >
                                {push.busy
                                  ? "Push通知を更新中…"
                                  : pushSubscribed
                                    ? "この路線の通知を停止"
                                    : "この路線の急増通知を受け取る"}
                              </button>
                            )}

                            {push.error && (
                              <p
                                role="alert"
                                className="mt-2 text-xs leading-5 text-red-800"
                              >
                                {push.error}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-rail-muted">
                          通知は利用者投稿から推定した可能性情報です。
                          京急電鉄の公式発表ではありません。
                        </p>
                        </div>
                      </details>
                    )}

                    {!votingEnabled && (
                      <div className="mt-3 rounded-xl border border-orange-400/50 bg-orange-50 p-3 text-xs leading-5 text-orange-950">
                        京急版専用KVが未設定のため閲覧のみ利用できます。
                        新しい投稿は受け付けていません。
                      </div>
                    )}

                    <fieldset
                      className="mt-4"
                      disabled={!votingEnabled || submitting}
                    >
                      <legend className="text-xs font-bold text-rail-muted">
                        現在の様子（みんなの情報）
                      </legend>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          {
                            value: "on-time" as const,
                            label: "平常",
                            icon: CheckCircle2,
                            active:
                              "border-emerald-500/50 bg-emerald-50 text-emerald-900",
                          },
                          {
                            value: "delayed" as const,
                            label: "遅延",
                            icon: Clock3,
                            active:
                              "border-amber-500/50 bg-amber-50 text-amber-950",
                          },
                          {
                            value: "suspended" as const,
                            label: "見合わせ",
                            icon: OctagonX,
                            active:
                              "border-red-500/50 bg-red-50 text-red-900",
                          },
                        ].map((item) => {
                          const Icon = item.icon;
                          const selected = status === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setStatus(item.value)}
                              className={`pressable flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 sm:px-2 sm:text-xs ${
                                selected
                                  ? item.active
                                  : "border-rail-border bg-white/70 text-rail-muted"
                              }`}
                            >
                              <Icon className="h-5 w-5" aria-hidden />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    {status === "delayed" && (
                      <fieldset
                        className="mt-4"
                        disabled={!votingEnabled || submitting}
                      >
                        <legend className="text-xs font-bold text-rail-muted">
                          体感で何分ほど遅れていますか？
                        </legend>
                        <div className="scrollbar-none mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
                          {DELAY_OPTIONS.map((minutes) => (
                            <button
                              key={minutes}
                              type="button"
                              aria-pressed={delayMinutes === minutes}
                              onClick={() => setDelayMinutes(minutes)}
                              className={`pressable min-h-11 min-w-[3.75rem] shrink-0 snap-start rounded-xl border px-2 text-xs font-bold tabular-nums focus-visible:outline-none ${
                                delayMinutes === minutes
                                  ? "border-amber-500/50 bg-amber-50 text-amber-950"
                                  : "border-rail-border bg-white/70 text-rail-muted"
                              }`}
                            >
                              {minutes}分
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    )}

                    {error && (
                      <p
                        role="alert"
                        className="mt-3 rounded-xl border border-red-400/50 bg-red-50 p-3 text-xs text-red-900"
                      >
                        {error}
                      </p>
                    )}
                    {success && (
                      <p
                        role="status"
                        className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-50 p-3 text-xs text-emerald-900"
                      >
                        {success}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={
                        !selectedLineId ||
                        !votingEnabled ||
                        submitting
                      }
                      onClick={() => void submitVote()}
                      className="pressable mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rail-accent px-4 text-sm font-bold text-white shadow-[0_8px_18px_rgba(184,0,36,0.2)] hover:bg-[#b80024] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {submitting ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden />
                      )}
                      {submitting ? "投稿中…" : "みんなの情報へ投稿"}
                    </button>

                    <p className="mt-2 text-center text-xs leading-5 text-rail-muted">
                      同じ路線は{cooldownSeconds}秒後に更新できます。
                      投稿は{windowMinutes}分で集計から外れます。
                      {!persistent && votingEnabled
                        ? " 現在は開発用の一時保存です。"
                        : ""}
                    </p>
                  </>
                )}
              </div>
      </AccessibleSheet>
    </>
  );
}
