"use client";

import { Database, Info, Mail, MapPinned, ShieldCheck, UsersRound, X } from "lucide-react";
import { useRef, useState } from "react";
import { AccessibleSheet } from "@/components/AccessibleSheet";
import type { ProviderSource } from "@/types/train";

const CONTACT_EMAIL = "train-live-map-support@gmail.com";

interface DataUsageNoticeProps {
  source: ProviderSource;
}

/**
 * Challenge 2026 データの利用条件、提供範囲、推定位置、
 * 公式情報と利用者投稿の違いを、ヘッダーからいつでも確認できるようにする。
 */
export function DataUsageNotice({ source }: DataUsageNoticeProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="pressable inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-rail-accent hover:bg-[#fff0f3] focus-visible:outline-none"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="data-usage-dialog"
      >
        <Info className="h-4 w-4" aria-hidden />
        <span className="max-[374px]:sr-only">データ利用</span>
      </button>

      <AccessibleSheet
        id="data-usage-dialog"
        open={open}
        onOpenChange={setOpen}
        labelledBy="data-usage-title"
        describedBy="data-usage-summary"
        returnFocusRef={triggerRef}
        initialFocusRef={closeRef}
        className="app-dialog"
        surfaceClassName="app-dialog-card app-sheet safe-bottom flex max-h-[90dvh] flex-col rounded-t-3xl border sm:rounded-3xl"
        headerClassName="flex items-start justify-between gap-4 px-5 pb-3 pt-5"
        headerContentClassName="min-w-0"
        actionClassName="shrink-0"
        bodyClassName="overflow-y-auto px-5 pb-5"
        header={
          <>
            <p className="text-xs font-bold text-rail-accent">
              公共交通オープンデータチャレンジ2026
            </p>
            <h2
              id="data-usage-title"
              className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-rail-text"
            >
              データ利用について
            </h2>
          </>
        }
        action={
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className="pressable grid h-11 w-11 place-items-center rounded-full text-rail-muted hover:bg-black/5 focus-visible:outline-none"
            aria-label="データ利用についての案内を閉じる"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        }
      >
        <p
          id="data-usage-summary"
          className="border-t border-rail-border pt-4 text-[0.9375rem] leading-7 text-rail-muted"
        >
          {source === "odpt"
            ? "表示中の公共交通データ"
            : "ODPTライブ表示時の公共交通データ"}
          は、公共交通オープンデータセンターが提供する限定データです。
          列車位置は京急線内の提供範囲だけを、線路上へ推定して表示します。
        </p>

        <div className="mt-4 space-y-3">
          <NoticeSection
            icon={MapPinned}
            title="データ提供範囲"
            tone="red"
          >
            公式データでは品川〜泉岳寺間が提供対象外です。この区間に列車を表示せず、
            モックや推測でも補完しません。直通列車も、京急線内で取得できる範囲だけを表示します。
          </NoticeSection>

          <NoticeSection icon={Database} title="位置精度" tone="neutral">
            fromStation・toStation・駅順・路線形状を使い、駅間の線路上へ推定しています。
            GPSによる実測位置や実測軌跡ではありません。データの正確性・完全性は保証されません。
          </NoticeSection>

          <NoticeSection icon={UsersRound} title="みんなの情報" tone="amber">
            利用者による匿名の参考投稿であり、京急電鉄の公式情報ではありません。
            端末内のランダムIDと、接続元IPを保存せず秘密鍵付きハッシュに変換した識別子は、
            連続投稿の防止と直近30分の集計にだけ使います。投稿急増の通知も公式発表ではありません。
          </NoticeSection>

          <NoticeSection
            icon={ShieldCheck}
            title="ライセンスと利用条件"
            tone="neutral"
          >
            公共交通オープンデータチャレンジ2026限定ライセンスの適用範囲と
            京急向け特定利用条件を確認して利用します。2026年7月29日時点で特定利用条件の
            公開場所を確認できないため、ODPT事務局への確認完了まで本番のライブデータを
            有効化しません。利用期間終了後はライブ取得を自動停止します。
          </NoticeSection>
        </div>

        <p className="mt-4 text-sm leading-6 text-rail-muted">
          本アプリは京急電鉄の公式サービスではありません。アプリの内容について、
          京急電鉄へ直接問い合わせないでください。データ利用条件はODPT事務局へ確認します。
        </p>

        <div className="mt-5 rounded-2xl border border-rail-border bg-white/70 p-4">
          <p className="text-xs font-bold text-rail-muted">
            アプリに関するお問い合わせ
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-1 inline-flex min-h-11 items-center gap-2 break-all text-sm font-bold text-rail-accent underline decoration-[#dc91a0] underline-offset-4 hover:text-[#b80024]"
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            {CONTACT_EMAIL}
          </a>
        </div>
      </AccessibleSheet>
    </>
  );
}

interface NoticeSectionProps {
  icon: typeof Info;
  title: string;
  tone: "red" | "amber" | "neutral";
  children: React.ReactNode;
}

function NoticeSection({
  icon: Icon,
  title,
  tone,
  children,
}: NoticeSectionProps) {
  const toneClass =
    tone === "red"
      ? "border-[#e7a7b4] bg-[#fff0f3] text-[#6f1830]"
      : tone === "amber"
        ? "border-amber-300/70 bg-amber-50 text-amber-950"
        : "border-rail-border bg-white/75 text-rail-text";

  return (
    <section className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <h3 className="text-sm font-extrabold">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-rail-muted">{children}</p>
    </section>
  );
}
