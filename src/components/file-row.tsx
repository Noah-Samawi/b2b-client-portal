import * as React from "react";
import { FileText } from "lucide-react";
import type { ProjectFile } from "@/lib/data";
import { ScanBadge, StatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/primitives";
import { formatBytes, formatDateTime } from "@/lib/format";
import { de } from "@/i18n/de";

/** Presentational row for the current version of a file. Actions are injected by the feature layer. */
export function FileRow({ file, actions }: { file: ProjectFile; actions?: React.ReactNode }) {
  return (
    <li
      data-testid="file-row"
      data-file-name={file.name}
      className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {de.files.versionShort(file.version)} · {formatBytes(file.sizeBytes)} · {de.files.uploadedAt(formatDateTime(file.createdAt))}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={file.status} />
            <ScanBadge status={file.scanStatus} />
            {file.versionCount > 1 ? <Badge variant="neutral">{de.files.version(file.version)}</Badge> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </li>
  );
}
