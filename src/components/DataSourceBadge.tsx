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
        className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-xl border border-[#ff6481]/60 bg-[#e6002d]/15 px-2 py-0.5 text-[10px] font-bold leading-[1.1] text-[#ffdbe2] shadow-sm ${className}`}
        title="ODPT の実データを表示中。位置は駅間からの推定を含みます。"
        aria-label="ODPTライブ。位置は駅間推定です"
      >
        <Radio className="h-3 w-3" aria-hidden />
        <span className="flex flex-col">
          <span>ODPTライブ</span>
          <span className="font-semibold text-[#ffafbe]">／位置は駅間推定</span>
        </span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-xl border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold leading-tight text-amber-200 shadow-sm ${className}`}
      title="表示中の列車位置はモック(擬似)データです"
      aria-label="表示中の列車位置はモックデータです"
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      <span className="flex flex-col">
        <span className="max-[359px]:hidden">モックデータ</span>
        <span className="hidden max-[359px]:block">モック</span>
        <span className="font-semibold text-amber-100/80 max-[359px]:hidden">
          ライブ情報ではありません
        </span>
        <span className="hidden font-semibold text-amber-100/80 max-[359px]:block">
          非ライブ
        </span>
      </span>
    </span>
  );
}
