"use client";

import { Info, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-rail-border bg-rail-bg/55 px-2 py-1 text-[10px] font-bold text-rail-muted hover:border-[#ff6481]/70 hover:text-rail-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6481]"
        aria-haspopup="dialog"
      >
        <Info className="h-3 w-3" aria-hidden />
        データ利用について
      </button>

      {open &&
        createPortal(
          <div
            className="animate-scrim-enter fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="data-usage-title"
              className="app-sheet animate-sheet-enter safe-bottom max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border p-5 sm:rounded-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-[#ff8ba0]">
                    公共交通オープンデータチャレンジ2026
                  </p>
                  <h2
                    id="data-usage-title"
                    className="mt-1 text-lg font-bold text-rail-text"
                  >
                    データ利用について
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full text-rail-muted hover:bg-rail-bg hover:text-rail-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6481]"
                  aria-label="データ利用についての案内を閉じる"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-rail-muted">
                <p>
                  {source === "odpt"
                    ? "表示中の公共交通データ"
                    : "ODPTライブ表示時の公共交通データ"}
                  は、公共交通オープンデータセンターが提供する
                  「公共交通オープンデータチャレンジ2026」限定データです。
                  限定ライセンスの適用範囲と特定利用条件を確認のうえ利用し、
                  利用期間終了後はライブ取得を自動停止します。
                </p>

                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                  <p className="font-bold text-amber-100">利用条件の確認状況</p>
                  <p className="mt-1">
                    2026年7月29日時点で京急向け特定利用条件の公開場所を確認できないため、
                    ODPT事務局への確認が完了するまで本番環境ではライブデータを有効化しません。
                  </p>
                </div>

                <div className="rounded-xl border border-[#ff6481]/35 bg-[#e6002d]/10 px-3 py-2">
                  <p className="font-bold text-[#ffdbe2]">データ提供範囲</p>
                  <p className="mt-1">
                    公式データでは品川〜泉岳寺間が提供対象外です。この区間に列車を表示せず、
                    モックや推測でも補完しません。直通列車も、京急線内で取得できる範囲だけを表示します。
                  </p>
                </div>

                <div className="rounded-xl border border-rail-border bg-black/15 px-3 py-2">
                  <p className="font-bold text-rail-text">公式データ</p>
                  <p className="mt-1">
                    列車位置は fromStation・toStation・駅順・路線形状を使って、
                    駅間の線路上へ推定しています。GPSによる実測位置や実測軌跡ではありません。
                    データの正確性・完全性は保証されません。
                  </p>
                </div>

                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                  <p className="font-bold text-amber-100">みんなの情報</p>
                  <p className="mt-1">
                    利用者による匿名の参考投稿であり、京急電鉄の公式情報ではありません。
                    端末内のランダムIDと、接続元IPを保存せずサーバー側で秘密鍵付きハッシュに変換した
                    ネットワーク識別子は、連続投稿の防止と直近30分の集計にだけ使います。
                    投稿急増による通知も公式発表ではありません。
                  </p>
                </div>

                <p>
                  本アプリは京急電鉄の公式サービスではありません。アプリの内容について、
                  京急電鉄へ直接問い合わせないでください。データ利用条件はODPT事務局へ確認します。
                </p>
              </div>

              <div className="mt-5 rounded-xl border border-rail-border bg-rail-bg/70 p-3">
                <p className="text-xs font-semibold text-rail-muted">
                  アプリに関するお問い合わせ
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-1 inline-flex items-center gap-2 break-all text-sm font-bold text-[#ff8ba0] underline decoration-[#a80d30] underline-offset-4 hover:text-[#ffc2cd]"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  {CONTACT_EMAIL}
                </a>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
