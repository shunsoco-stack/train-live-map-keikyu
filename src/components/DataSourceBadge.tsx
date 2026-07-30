import { FlaskConical, Radio } from "lucide-react";
import type { ProviderSource } from "@/types/train";

/**
 * データ取得元(実データ ODPT / モック)を示すバッジ。
 * モック時は「モックデータ使用中」、実データ時は
 * 「ODPTライブ／位置は駅間推定」を常に省略せず表示する。
 */
export function DataSourceBadge({
  source,
  className = "",
}: {
  source: ProviderSource;
  className?: string;
}) {
  if (source === "odpt") {
    return (
      <span
        className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#efadba] bg-[#fff0f3]/90 px-2 text-xs font-bold leading-[1.15] text-[#8d102a] ${className}`}
        title="ODPT の実データを表示中。位置は駅間からの推定を含みます。"
        aria-label="ODPTライブ。位置は駅間推定です"
      >
        <Radio className="h-3.5 w-3.5 text-rail-accent" aria-hidden />
        <span className="flex flex-col">
          <span>ODPTライブ</span>
          <span className="text-[0.6875rem] font-semibold text-[#725a61]">
            位置は駅間推定
          </span>
        </span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-50/90 px-2 text-xs font-bold leading-[1.15] text-amber-950 ${className}`}
      title="表示中の列車位置はモック(擬似)データです"
      aria-label="表示中の列車位置はモックデータです"
    >
      <FlaskConical className="h-3.5 w-3.5 text-amber-700" aria-hidden />
      <span className="flex flex-col">
        <span>モックデータ</span>
        <span className="text-[0.6875rem] font-semibold text-amber-800">
          非ライブ
        </span>
      </span>
    </span>
  );
}
