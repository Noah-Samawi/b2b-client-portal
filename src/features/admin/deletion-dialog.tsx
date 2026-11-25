"use client";

import * as React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { getDataSource, type DeletionRequest } from "@/lib/data";
import { DELETION_CONFIRMATION_WORD, deletionRequestSchema, fieldErrors, type DeletionRequestInput } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField, Input, Textarea } from "@/components/ui/primitives";
import { useErrorHandler, useLoad } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

/** Explicit, typed confirmation for deletion requests. Shows the configured retention period. */
export function DeletionDialog({
  targetLabel,
  triggerLabel,
  triggerAriaLabel,
  disabled,
  onSubmit,
}: {
  targetLabel: string;
  triggerLabel: string;
  triggerAriaLabel?: string;
  disabled?: boolean;
  onSubmit: (input: DeletionRequestInput) => Promise<DeletionRequest>;
}) {
  const [open, setOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const handleError = useErrorHandler();
  const { data: policy } = useLoad("retention", () => getDataSource().getRetentionPolicy());

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = deletionRequestSchema.safeParse({ reason: form.get("reason"), confirmation: form.get("confirmation") });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      await onSubmit(parsed.data);
      setErrors({});
      setOpen(false);
    } catch (err) {
      const pe = handleError(err, { silent: true });
      if (pe.details?.fields) setErrors(pe.details.fields);
      else handleError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); if (!o) setErrors({}); } }}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled} aria-label={triggerAriaLabel}>
          <Trash2 aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{de.deletion.title}</DialogTitle>
          <DialogDescription>{de.deletion.description(targetLabel)}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning" data-testid="retention-notice">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{policy ? de.deletion.retention(policy.retentionDays) : de.common.loading}</p>
        </div>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField id="deletion-reason" label={de.deletion.reason} error={errors.reason}>
            {(aria) => <Textarea name="reason" placeholder={de.deletion.reasonPlaceholder} {...aria} />}
          </FormField>
          <FormField id="deletion-confirm" label={de.deletion.confirmLabel(DELETION_CONFIRMATION_WORD)} error={errors.confirmation}>
            {(aria) => <Input name="confirmation" autoComplete="off" {...aria} />}
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {de.common.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? de.confirmDialog.working : de.deletion.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
