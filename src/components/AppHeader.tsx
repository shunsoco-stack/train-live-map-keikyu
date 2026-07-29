import Image from "next/image";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { DataUsageNotice } from "@/components/DataUsageNotice";
import { UpdateStatus } from "@/components/UpdateStatus";
import type { ProviderSource } from "@/types/train";

interface AppHeaderProps {
  lastUpdatedAt: Date | null;
  dataUpdatedAt: Date | null;
  source: ProviderSource;
}

/** アプリ上部のヘッダー(アプリ名・サブタイトル・データ元・更新状況)。 */
export function AppHeader({
  lastUpdatedAt,
  dataUpdatedAt,
  source,
}: AppHeaderProps) {
  return (
    <header className="app-material safe-inline safe-top pointer-events-auto relative z-20 border-b border-rail-border/70 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/icons/train-live-map-keikyu-192.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-[0.65rem] shadow-[0_4px_12px_rgba(83,0,19,0.4)]"
            aria-hidden
          />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[0.95rem] font-extrabold tracking-[-0.015em] text-rail-text">
              Train Live Map
            </h1>
            <p className="truncate text-[0.6875rem] font-bold tracking-[0.015em] text-[#ffb0bf]">
              京急線版（非公式）
            </p>
          </div>
        </div>
        <DataSourceBadge source={source} />
      </div>
      <div className="mt-1 flex min-h-9 items-center justify-between gap-1.5">
        <UpdateStatus
          lastUpdatedAt={lastUpdatedAt}
          dataUpdatedAt={dataUpdatedAt}
        />
        <DataUsageNotice source={source} />
      </div>
    </header>
  );
}
