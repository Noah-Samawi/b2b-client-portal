"use client";

import * as React from "react";
import { Download, History } from "lucide-react";
import { getDataSource, type ProjectFile } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge, Skeleton } from "@/components/ui/primitives";
import { ScanBadge, StatusBadge } from "@/components/status";
import { formatBytes, formatDateTime } from "@/lib/format";
import { useLoad } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

export function VersionHistoryDialog({ file, onDownload }: { file: ProjectFile; onDownload: (fileId: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={de.files.historyLabel(file.name)}>
          <History aria-hidden="true" />
          <span className="hidden md:inline">{de.files.history}</span>
          <span className="tabular-nums text-muted-foreground">({file.versionCount})</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{de.files.historyLabel(file.name)}</DialogTitle>
          <DialogDescription>{de.files.historyDescription}</DialogDescription>
        </DialogHeader>
        {open ? <VersionList groupId={file.groupId} onDownload={onDownload} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function VersionList({ groupId, onDownload }: { groupId: string; onDownload: (fileId: string) => void }) {
  const { data, loading } = useLoad(`versions:${groupId}`, () => getDataSource().listFileVersions(groupId));
  if (loading && !data) return <Skeleton className="h-24 w-full" />;
  return (
    <ol className="grid gap-2" data-testid="version-list">
      {(data ?? []).map((v) => (
        <li key={v.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-medium">
              {de.files.version(v.version)}
              {v.isCurrent ? <Badge variant="success">{de.files.current}</Badge> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(v.sizeBytes)} · {de.files.uploadedAt(formatDateTime(v.createdAt))}
              {v.approvedAt ? ` · ${de.files.approvedAt(formatDateTime(v.approvedAt))}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge status={v.status} />
              <ScanBadge status={v.scanStatus} />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={v.scanStatus !== "clean"}
            onClick={() => onDownload(v.id)}
            aria-label={`${de.files.downloadLabel(v.name)} (${de.files.version(v.version)})`}
          >
            <Download aria-hidden="true" />
            {de.files.download}
          </Button>
        </li>
      ))}
    </ol>
  );
}
