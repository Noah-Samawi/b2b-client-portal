"use client";

import * as React from "react";
import { FlaskConical, QrCode, ShieldCheck, ShieldOff } from "lucide-react";
import { getDataSource, getDevLoginHints, type MfaEnrollment } from "@/lib/data";
import { fieldErrors, mfaCodeSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input } from "@/components/ui/primitives";
import { PageHeader } from "@/components/project-card";
import { useToast } from "@/components/toast";
import { useRequiredUser, useSession } from "@/features/auth/session-context";
import { useErrorHandler } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

export function SecurityPage() {
  const user = useRequiredUser();
  const { refresh } = useSession();
  const toast = useToast();
  const handleError = useErrorHandler();
  const [enrollment, setEnrollment] = React.useState<MfaEnrollment | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);
  const demoCode = getDevLoginHints().mfaCode;

  async function start() {
    setBusy(true);
    try {
      setEnrollment(await getDataSource().enrollMfa());
      setConfirmed(false);
      setCode("");
      setError(undefined);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    const parsed = mfaCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).code);
      return;
    }
    setBusy(true);
    try {
      await getDataSource().confirmMfaEnrollment(enrollment.factorId, parsed.data.code);
      setConfirmed(true);
      setError(undefined);
      toast.success(de.security.confirmed);
      await refresh();
    } catch (err) {
      const pe = handleError(err, { silent: true });
      setError(de.errors.codes[pe.code]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={de.security.title} description={de.security.description} />
      <div className="grid max-w-3xl gap-6">
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-warning/40 bg-warning/5 p-3 text-sm text-warning">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{de.security.simulationNote}</p>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="grid gap-1.5">
              <CardTitle>TOTP</CardTitle>
              <CardDescription>{user.role === "admin" ? de.security.adminRequired : de.security.description}</CardDescription>
            </div>
            {user.mfaEnrolled ? (
              <Badge variant="success">
                <ShieldCheck aria-hidden="true" />
                {de.security.statusEnrolled}
              </Badge>
            ) : (
              <Badge variant="warning">
                <ShieldOff aria-hidden="true" />
                {de.security.statusNotEnrolled}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <Button onClick={() => void start()} disabled={busy} variant={user.mfaEnrolled ? "outline" : "default"}>
              {user.mfaEnrolled ? de.security.restart : de.security.start}
            </Button>
          </CardContent>
        </Card>

        {enrollment ? (
          <Card data-testid="mfa-enrollment">
            <CardContent className="grid gap-6 pt-5">
              <section className="grid gap-3" aria-labelledby="mfa-step1">
                <h2 id="mfa-step1" className="font-medium">{de.security.step1}</h2>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div
                    role="img"
                    aria-label={de.security.qrPlaceholder}
                    className="flex size-40 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/50 text-xs text-muted-foreground"
                  >
                    <QrCode className="size-10" aria-hidden="true" />
                    {de.security.qrPlaceholder}
                  </div>
                  <div className="grid min-w-0 gap-1">
                    <p className="text-sm text-muted-foreground">{de.security.secretLabel}</p>
                    <code className="rounded-xl bg-secondary px-3 py-2 font-mono text-sm break-all" data-testid="mfa-secret">
                      {enrollment.secret.match(/.{1,4}/g)?.join(" ")}
                    </code>
                  </div>
                </div>
              </section>

              <section className="grid gap-3" aria-labelledby="mfa-step2">
                <h2 id="mfa-step2" className="font-medium">{de.security.step2}</h2>
                <form onSubmit={confirm} className="grid max-w-sm gap-3" noValidate>
                  <FormField id="enroll-code" label={de.security.codeLabel} error={error}>
                    {(aria) => (
                      <Input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        disabled={confirmed}
                        {...aria}
                      />
                    )}
                  </FormField>
                  {demoCode ? <p className="text-xs text-warning">{de.login.mfaDemoHint(demoCode)}</p> : null}
                  <Button type="submit" disabled={busy || confirmed}>
                    {de.security.confirm}
                  </Button>
                </form>
              </section>

              <section className="grid gap-3" aria-labelledby="mfa-step3">
                <h2 id="mfa-step3" className="font-medium">{de.security.step3}</h2>
                <p className="text-sm text-muted-foreground">{de.security.backupHint}</p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="backup-codes">
                  {enrollment.backupCodes.map((c) => (
                    <li key={c} className="rounded-xl bg-secondary px-3 py-2 text-center font-mono text-sm tabular-nums">
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
