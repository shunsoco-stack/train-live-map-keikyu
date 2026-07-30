"use client";

import { AlertOctagon, RefreshCw } from "lucide-react";

interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
}

/** データ取得失敗時に表示する通知。画面が真っ白にならないようにする。 */
export function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <div
      role="alert"
      className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-red-500/45 bg-red-50/95 px-3 py-2 text-sm text-red-950 shadow-[0_8px_24px_rgba(72,37,46,0.12)]"
    >
      <AlertOctagon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="pressable flex min-h-11 items-center gap-1 rounded-xl border border-red-400/50 px-3 py-1 font-bold hover:bg-red-100 focus-visible:outline-none"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          再取得
        </button>
      )}
    </div>
  );
}
