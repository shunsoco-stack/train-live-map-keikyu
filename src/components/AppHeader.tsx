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
    <header className="app-header safe-inline safe-top pointer-events-auto relative z-20 border-b pb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/icons/train-live-map-keikyu-192.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-[0.7rem] shadow-[0_5px_14px_rgba(104,32,49,0.2)]"
            aria-hidden
          />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[1.0625rem] font-extrabold leading-[1.15] tracking-[-0.02em] text-rail-text">
              Train Live Map
            </h1>
            <p className="mt-0.5 truncate text-xs font-bold tracking-[0.01em] text-rail-accent">
              京急線版（非公式）
            </p>
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex min-h-11 items-center justify-between gap-2 rounded-xl border border-rail-border/70 bg-white/55 pl-3 pr-1">
        <DataSourceBadge source={source} />
        <div className="flex min-w-0 items-center gap-1">
          <UpdateStatus
            lastUpdatedAt={lastUpdatedAt}
            dataUpdatedAt={dataUpdatedAt}
          />
          <DataUsageNotice source={source} />
        </div>
      </div>
    </header>
  );
}
