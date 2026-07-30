"use client";

import { useEffect, useRef } from "react";
import {
  adsenseBannerSlotId,
  adsenseClientId,
  isAdsenseBannerEnabled,
} from "@/lib/adsense";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

/**
 * 地図を覆わない、画面下部の小さな AdSense ディスプレイ広告枠。
 * 設定済みのときだけ高さを確保し、未設定環境では地図へ領域を返す。
 */
export function AdSenseBanner() {
  const adRef = useRef<HTMLModElement | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (
      !isAdsenseBannerEnabled ||
      requestedRef.current ||
      adRef.current?.dataset.adsbygoogleStatus
    ) {
      return;
    }

    requestedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      requestedRef.current = false;
    }
  }, []);

  const liveAdEnabled =
    isAdsenseBannerEnabled &&
    adsenseClientId !== null &&
    adsenseBannerSlotId !== null;

  if (!liveAdEnabled) return null;

  return (
    <aside
      aria-label="広告"
      className="safe-inline shrink-0 border-t border-rail-border bg-rail-surface/95 py-1"
    >
      <div className="mx-auto w-[320px] max-w-full">
        <span className="block h-2.5 text-[8px] leading-2.5 text-rail-muted">
          広告
        </span>
        <ins
          ref={adRef}
          className="adsbygoogle block overflow-hidden rounded-md"
          style={{
            display: "inline-block",
            width: "320px",
            maxWidth: "100%",
            height: "50px",
          }}
          data-ad-client={adsenseClientId}
          data-ad-slot={adsenseBannerSlotId}
        />
      </div>
    </aside>
  );
}
