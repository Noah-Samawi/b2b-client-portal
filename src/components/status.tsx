import { CheckCircle2, Clock, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { FileStatus, ScanStatus } from "@/lib/data";
import { Badge } from "@/components/ui/primitives";
import { clampPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { de } from "@/i18n/de";

export function ProgressBar({ value, label, className, showValue = true }: { value: number; label: string; className?: string; showValue?: boolean }) {
  const pct = clampPercent(value);
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} data-testid="progress-fill" />
      </div>
      {showValue ? <span className="text-xs text-muted-foreground tabular-nums">{pct} %</span> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: FileStatus }) {
  return status === "approved" ? (
    <Badge variant="success" data-testid="status-badge">
      <CheckCircle2 aria-hidden="true" />
      {de.files.status.approved}
    </Badge>
  ) : (
    <Badge variant="warning" data-testid="status-badge">
      <Clock aria-hidden="true" />
      {de.files.status.pending}
    </Badge>
  );
}

export function ScanBadge({ status }: { status: ScanStatus }) {
  const label = de.files.scan[status];
  switch (status) {
    case "clean":
      return (
        <Badge variant="neutral" data-testid="scan-badge" title={de.files.scanSimulated}>
          <ShieldCheck aria-hidden="true" className="text-primary" />
          {label}
        </Badge>
      );
    case "infected":
      return (
        <Badge variant="danger" data-testid="scan-badge" title={de.files.scanSimulated}>
          <ShieldAlert aria-hidden="true" />
          {label}
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="danger" data-testid="scan-badge" title={de.files.scanSimulated}>
          <ShieldQuestion aria-hidden="true" />
          {label}
        </Badge>
      );
    default:
      return (
        <Badge variant="info" data-testid="scan-badge" title={de.files.scanSimulated}>
          <Loader2 aria-hidden="true" className="animate-spin" />
          {label}
        </Badge>
      );
  }
}
