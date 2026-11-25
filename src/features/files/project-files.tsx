"use client";

import * as React from "react";
import { CheckCircle2, Download, FileX, MoreHorizontal, RotateCcw, Trash2, Upload } from "lucide-react";
import { getDataSource, type ProjectFile, type Role } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/menu-slider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { FileRow } from "@/components/file-row";
import { ProgressBar } from "@/components/status";
import { UploadDropzone } from "@/components/upload-dropzone";
import { useToast } from "@/components/toast";
import { useErrorHandler, useLoad } from "@/features/shared/use-portal";
import { VersionHistoryDialog } from "./version-history-dialog";
import { useUpload } from "./use-upload";
import { ALLOWED_EXTENSIONS } from "@/lib/validation";
import { de } from "@/i18n/de";

type Pending =
  | { kind: "approve"; file: ProjectFile }
  | { kind: "revert"; file: ProjectFile }
  | { kind: "delete"; file: ProjectFile }
  | null;

const SCAN_POLL_MS = 1000;

export function ProjectFiles({ projectId, role, readOnly, onChanged }: { projectId: string; role: Role; readOnly: boolean; onChanged?: () => void }) {
  const toast = useToast();
  const handleError = useErrorHandler();
  const { data: files, loading, reload, setData } = useLoad(`files:${projectId}`, () => getDataSource().listFiles(projectId));
  const [pending, setPending] = React.useState<Pending>(null);
  const versionInput = React.useRef<HTMLInputElement>(null);
  const [versionTarget, setVersionTarget] = React.useState<ProjectFile | null>(null);

  const onUploaded = React.useCallback(() => {
    void reload();
    onChanged?.();
  }, [reload, onChanged]);
  const { upload, uploadMany, inFlight } = useUpload(projectId, onUploaded);

  // Poll while a scan is running (reads do not extend the idle session).
  const scanning = (files ?? []).some((f) => f.scanStatus === "pending" || f.scanStatus === "scanning");
  React.useEffect(() => {
    if (!scanning) return;
    const t = setInterval(() => void reload(), SCAN_POLL_MS);
    return () => clearInterval(t);
  }, [scanning, reload]);

  const replace = (updated: ProjectFile) => setData((xs) => xs?.map((f) => (f.id === updated.id ? updated : f)));

  async function download(fileId: string) {
    try {
      const link = await getDataSource().getDownloadUrl(fileId);
      const a = document.createElement("a");
      a.href = link.url;
      a.download = link.fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      handleError(err);
    }
  }

  async function runPending() {
    if (!pending) return;
    const ds = getDataSource();
    try {
      if (pending.kind === "approve") {
        replace(await ds.approveFile(pending.file.id));
        toast.success(de.files.approved);
      } else if (pending.kind === "revert") {
        replace(await ds.revertFile(pending.file.id));
        toast.success(de.files.reverted);
      } else {
        await ds.deleteFile(pending.file.groupId);
        setData((xs) => xs?.filter((f) => f.groupId !== pending.file.groupId));
        toast.success(de.files.deleted);
        onChanged?.();
      }
    } catch (err) {
      handleError(err);
      void reload();
      throw err;
    }
  }

  const isAdmin = role === "admin";

  return (
    <div className="grid gap-4">
      {isAdmin ? (
        <UploadDropzone onFiles={uploadMany} disabled={readOnly} disabledReason={de.upload.disabledArchived} />
      ) : null}

      {inFlight.length > 0 ? (
        <ul className="grid gap-2" aria-label={de.upload.dropzoneLabel}>
          {inFlight.map((u) => (
            <li key={u.key} className="rounded-xl border border-border p-3 text-sm">
              <p className="mb-2 truncate">{de.upload.uploading(u.name)}</p>
              <ProgressBar value={u.percent} label={de.upload.progressLabel(u.name)} />
            </li>
          ))}
        </ul>
      ) : null}

      {loading && !files ? (
        <div className="grid gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (files ?? []).length === 0 ? (
        <EmptyState icon={FileX} title={de.project.filesEmpty} description={isAdmin ? undefined : de.project.filesEmptyClient} />
      ) : (
        <ul className="grid gap-2" aria-label={de.project.files}>
          {(files ?? []).map((file) => {
            const clean = file.scanStatus === "clean";
            return (
              <FileRow
                key={file.id}
                file={file}
                actions={
                  <>
                    <VersionHistoryDialog file={file} onDownload={download} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => download(file.id)}
                      disabled={!clean}
                      aria-label={de.files.downloadLabel(file.name)}
                      title={clean ? undefined : de.files.blockedByScan}
                    >
                      <Download aria-hidden="true" />
                      <span className="hidden sm:inline">{de.files.download}</span>
                    </Button>
                    {!isAdmin && file.status === "pending" ? (
                      <Button
                        size="sm"
                        onClick={() => setPending({ kind: "approve", file })}
                        disabled={!clean || readOnly}
                        aria-label={de.files.approveLabel(file.name)}
                        title={clean ? undefined : de.files.blockedByScan}
                      >
                        <CheckCircle2 aria-hidden="true" />
                        {de.files.approve}
                      </Button>
                    ) : null}
                    {isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={de.files.moreActions(file.name)} disabled={readOnly}>
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setVersionTarget(file);
                              versionInput.current?.click();
                            }}
                          >
                            <Upload aria-hidden="true" />
                            {de.files.newVersion}
                          </DropdownMenuItem>
                          {file.status === "approved" ? (
                            <DropdownMenuItem onSelect={() => setPending({ kind: "revert", file })}>
                              <RotateCcw aria-hidden="true" />
                              {de.files.revert}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem className="text-destructive" onSelect={() => setPending({ kind: "delete", file })}>
                            <Trash2 aria-hidden="true" />
                            {de.files.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {de.files.blockedByScan} {isAdmin ? de.files.quarantineNote : null}
      </p>

      {isAdmin ? (
        <input
          ref={versionInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="version-input"
          accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && versionTarget) void upload(f, versionTarget.groupId);
            e.target.value = "";
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={
          pending?.kind === "approve" ? de.files.approveTitle : pending?.kind === "revert" ? de.files.revertTitle : de.files.deleteTitle
        }
        description={
          pending?.kind === "approve"
            ? de.files.approveText(pending.file.name, pending.file.version)
            : pending?.kind === "revert"
              ? de.files.revertText(pending.file.name)
              : pending
                ? de.files.deleteText(pending.file.name, pending.file.versionCount)
                : ""
        }
        confirmLabel={pending?.kind === "approve" ? de.files.approve : pending?.kind === "revert" ? de.files.revert : de.files.delete}
        destructive={pending?.kind === "delete"}
        onConfirm={runPending}
      />
    </div>
  );
}
