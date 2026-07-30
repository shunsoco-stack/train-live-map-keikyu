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
    border: "border-emerald-600/30",
    accent: "text-emerald-800",
    icon: CheckCircle2,
  },
  minor: {
    border: "border-amber-500/45",
    accent: "text-amber-900",
    icon: AlertTriangle,
  },
  major: {
    border: "border-red-600/50",
    accent: "text-red-800",
    icon: AlertTriangle,
  },
};

/**
 * 路線の運行情報を簡潔に表示するバー。
 * 明るい地図の上で、素材面と重要度色を使って一目で読める形にする。
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
      className={`app-material pointer-events-auto flex max-w-full items-start gap-2 border py-2.5 pl-3 pr-14 text-sm font-medium text-rail-text sm:px-3 ${
        normal ? "self-start rounded-2xl" : "w-full rounded-2xl"
      } ${style.border}`}
    >
      <Icon className={`mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 ${style.accent}`} aria-hidden />
      <div className="min-w-0 leading-snug">
        <span className="mb-1 inline-flex rounded-full border border-rail-border bg-white/70 px-2 py-0.5 text-[0.6875rem] font-bold tracking-wide text-rail-muted">
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
          className="mt-1 block text-xs tabular-nums text-rail-muted"
        >
          更新 {formatServiceStatusUpdatedAt(serviceStatus.updatedAt)}
        </time>
      </div>
    </div>
  );
}
