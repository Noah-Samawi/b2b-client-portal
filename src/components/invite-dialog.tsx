"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { getDataSource, type Member } from "@/lib/data";
import { fieldErrors, inviteSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/toast";
import { useErrorHandler } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

export function InviteDialog({ projectId, disabled, onInvited }: { projectId: string; disabled?: boolean; onInvited: (m: Member) => void }) {
  const [open, setOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const handleError = useErrorHandler();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = inviteSchema.safeParse({ email: form.get("email"), fullName: form.get("fullName") });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      const member = await getDataSource().inviteMember(projectId, parsed.data);
      toast.success(de.invite.success(member.email));
      onInvited(member);
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
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <UserPlus aria-hidden="true" />
          {de.project.invite}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{de.invite.title}</DialogTitle>
          <DialogDescription>{de.invite.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id="invite-name" label={de.invite.name} error={errors.fullName}>
            {(aria) => <Input name="fullName" autoComplete="name" {...aria} />}
          </FormField>
          <FormField id="invite-email" label={de.invite.email} error={errors.email}>
            {(aria) => <Input name="email" type="email" autoComplete="email" {...aria} />}
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {de.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? de.common.saving : de.invite.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
