"use client";

import * as React from "react";
import { getDataSource, type ProjectFile } from "@/lib/data";
import { fieldErrors, fileUploadMetaSchema } from "@/lib/validation";
import { guessMimeType } from "@/lib/format";
import { useToast } from "@/components/toast";
import { errorMessage, useErrorHandler } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

export interface UploadProgress {
  key: string;
  name: string;
  percent: number;
}

/**
 * Upload flow shared by Phase 1 and Phase 2:
 * 1. validate metadata (Zod) → 2. requestUploadUrl → 3. transfer binary → 4. confirmUpload.
 * Phase 1 simulates step 3 with a timer; Phase 2 PUTs the file to the signed Storage URL.
 */
export function useUpload(projectId: string, onUploaded: (file: ProjectFile) => void) {
  const toast = useToast();
  const handleError = useErrorHandler();
  const [inFlight, setInFlight] = React.useState<UploadProgress[]>([]);

  const upload = React.useCallback(
    async (file: File, groupId?: string) => {
      const meta = { name: file.name, mimeType: guessMimeType(file.name, file.type), sizeBytes: file.size };
      const parsed = fileUploadMetaSchema.safeParse(meta);
      if (!parsed.success) {
        const msgs = Object.values(fieldErrors(parsed.error));
        toast.error(`${file.name}: ${msgs[0] ?? de.errors.codes.VALIDATION}`);
        return;
      }
      const key = `${file.name}-${Math.random().toString(36).slice(2)}`;
      const setPct = (percent: number) =>
        setInFlight((xs) => xs.map((x) => (x.key === key ? { ...x, percent } : x)));
      setInFlight((xs) => [...xs, { key, name: file.name, percent: 0 }]);
      try {
        const ds = getDataSource();
        const ticket = await ds.requestUploadUrl(projectId, parsed.data, groupId);
        for (const pct of [20, 45, 70, 90, 100]) {
          await new Promise((r) => setTimeout(r, 120)); // simulated transfer (PHASE 1)
          setPct(pct);
        }
        const created = await ds.confirmUpload(ticket.uploadId);
        onUploaded(created);
        toast.success(groupId ? de.files.newVersionUploaded(created.name, created.version) : de.upload.uploaded(created.name));
      } catch (err) {
        const pe = handleError(err, { silent: true });
        const field = pe.details?.fields ? Object.values(pe.details.fields)[0] : undefined;
        toast.error(`${de.upload.failed(file.name)} ${field ?? errorMessage(pe)}`);
      } finally {
        setInFlight((xs) => xs.filter((x) => x.key !== key));
      }
    },
    [projectId, onUploaded, toast, handleError],
  );

  const uploadMany = React.useCallback((files: File[]) => files.forEach((f) => void upload(f)), [upload]);

  return { upload, uploadMany, inFlight };
}
