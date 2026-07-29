import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { formatServiceStatusUpdatedAt } from "@/lib/serviceStatus";
import type { ServiceStatus } from "@/types/train";

interface ServiceStatusBarProps {
  serviceStatus: ServiceStatus | null;
}

const SEVERITY_STYLE: Record<
  ServiceStatus["severity"],
  { border: string; accent: string; icon: typeof Info }
> = {
  normal: {
    border: "border-emerald-500/60",
    accent: "text-emerald-300",
    icon: CheckCircle2,
  },
  minor: {
    border: "border-amber-500/60",
    accent: "text-amber-300",
    icon: AlertTriangle,
  },
  major: {
    border: "border-red-500/70",
    accent: "text-red-300",
    icon: AlertTriangle,
  },
};

/**
 * 路線の運行情報を簡潔に表示するバー。
 * 明るい地図の上でも読めるよう、不透明なダークカード + 重要度色のアクセントで表示する。
 */
export function ServiceStatusBar({ serviceStatus }: ServiceStatusBarProps) {
  if (!serviceStatus) return null;
  const style = SEVERITY_STYLE[serviceStatus.severity];
  const Icon = style.icon;
  const normal = serviceStatus.severity === "normal";
  const sourceLabel =
    serviceStatus.provenance === "community"
      ? "みんなの情報"
      : serviceStatus.provenance === "mock" ||
          serviceStatus.dataAccuracy === "mock"
        ? "参考表示（モック）"
        : "公式運行情報";

  return (
    <div
      role="status"
      className={`app-material pointer-events-auto flex max-w-full items-start gap-2 border px-3 py-2 text-xs font-medium text-rail-text ${
        normal ? "self-start rounded-full" : "w-full rounded-xl"
      } ${style.border}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.accent}`} aria-hidden />
      <div className="min-w-0 leading-snug">
        <span className="mb-0.5 inline-flex rounded-full border border-white/15 bg-black/20 px-1.5 py-px text-[9px] font-bold tracking-wide text-rail-muted">
          {sourceLabel}
        </span>
        <p>
          <span className={`font-bold ${style.accent}`}>{serviceStatus.lineName}</span>
          <span className="mx-1 text-rail-muted" aria-hidden>
            ｜
          </span>
          {serviceStatus.message}
        </p>
        <time
          dateTime={serviceStatus.updatedAt}
          className="mt-1 block text-[9px] tabular-nums text-rail-muted"
        >
          更新 {formatServiceStatusUpdatedAt(serviceStatus.updatedAt)}
        </time>
      </div>
    </div>
  );
}
