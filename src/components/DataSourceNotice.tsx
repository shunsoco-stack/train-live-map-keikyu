import { Info } from "lucide-react";

/**
 * データ取得元に関する注意書きバナー。
 * 「現在モックデータを表示しています」などをユーザーに明示する。
 */
export function DataSourceNotice({
  notice,
  fallback,
}: {
  notice: string | null;
  fallback: boolean;
}) {
  if (!notice) return null;
  const accent = fallback
    ? "border-red-500/40 bg-red-50/90 text-red-900"
    : "border-amber-500/40 bg-amber-50/90 text-amber-950";
  return (
    <div
      role="status"
      className={`pointer-events-auto flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold shadow-[0_8px_22px_rgba(72,37,46,0.1)] backdrop-blur ${accent}`}
    >
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{notice}</span>
    </div>
  );
}
