"use client";

import { RefreshCw } from "lucide-react";
import { formatTimeJa } from "@/lib/time";

interface UpdateStatusProps {
  /** クライアントが API の取得に成功した時刻。次回更新表示に使用。 */
  lastUpdatedAt: Date | null;
  /** ODPT の dc:date をもとにした、表示中データ自体の時刻。 */
  dataUpdatedAt: Date | null;
}

/** データ時刻を、通勤中でも一目で読める短い形で表示する。 */
export function UpdateStatus({
  lastUpdatedAt,
  dataUpdatedAt,
}: UpdateStatusProps) {
  const updatedAt = dataUpdatedAt ?? lastUpdatedAt;

  return (
    <div
      className="flex min-w-0 items-center gap-2 text-xs font-bold tracking-[0.01em] text-rail-muted"
      role="status"
      aria-live="off"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff0f3] text-rail-accent">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="truncate">
        <time className="tabular-nums text-rail-text">
          {updatedAt ? formatTimeJa(null, updatedAt) : "--:--:--"}
        </time>{" "}
        更新
      </span>
    </div>
  );
}
