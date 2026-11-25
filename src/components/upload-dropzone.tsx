"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALLOWED_EXTENSIONS } from "@/lib/validation";
import { de } from "@/i18n/de";

export function UploadDropzone({ onFiles, disabled, disabledReason }: { onFiles: (files: File[]) => void; disabled?: boolean; disabledReason?: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const hintId = React.useId();

  function emit(list: FileList | null) {
    if (!list || list.length === 0 || disabled) return;
    onFiles(Array.from(list));
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          emit(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center transition-colors",
          "hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
          dragging && "border-primary bg-primary/10",
        )}
      >
        <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">{de.upload.dropzoneTitle}</span>
        <span id={hintId} className="text-xs text-muted-foreground">
          {disabled && disabledReason ? disabledReason : de.upload.dropzoneHint}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="upload-input"
        accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
