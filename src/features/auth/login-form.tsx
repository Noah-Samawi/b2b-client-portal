"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical, Info, KeyRound } from "lucide-react";
import { getDataSource, getDevLoginHints, toPortalError, type User } from "@/lib/data";
import { fieldErrors, loginSchema, mfaCodeSchema } from "@/lib/validation";
import { homeFor } from "@/lib/session/route-cookie";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, Label } from "@/components/ui/primitives";
import { useSession } from "./session-context";
import { errorMessage } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

type Step = { kind: "credentials" } | { kind: "mfa"; user: User };

const REASONS = ["idle", "expired", "signedOut", "required"] as const;
type Reason = (typeof REASONS)[number];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { completeSignIn, refresh } = useSession();
  const hints = React.useMemo(() => getDevLoginHints(), []);
  const [step, setStep] = React.useState<Step>({ kind: "credentials" });
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reasonParam = params.get("reason");
  const reason = (REASONS as readonly string[]).includes(reasonParam ?? "") ? (reasonParam as Reason) : null;

  // Already signed in (aal sufficient)? Go straight to the right area.
  React.useEffect(() => {
    void refresh().then((s) => {
      if (s.status === "signed-in") router.replace(homeFor(s.session.user.role));
    });
  }, [refresh, router]);

  function applyDemo(value: string) {
    const account = hints.accounts.find((a) => a.email === value);
    setEmail(account?.email ?? "");
    setPassword(account?.password ?? "");
    setErrors({});
    setFormError(null);
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await getDataSource().signIn(parsed.data);
      if (result.status === "mfa_required") setStep({ kind: "mfa", user: result.user });
      else completeSignIn(result.user);
    } catch (err) {
      const pe = toPortalError(err);
      if (pe.details?.fields) setErrors(pe.details.fields);
      setFormError(errorMessage(pe));
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = mfaCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const user = await getDataSource().verifyMfa(parsed.data.code);
      completeSignIn(user);
    } catch (err) {
      setFormError(errorMessage(toPortalError(err)));
    } finally {
      setBusy(false);
    }
  }

  async function backToCredentials() {
    await getDataSource().signOut();
    setStep({ kind: "credentials" });
    setCode("");
    setErrors({});
    setFormError(null);
  }

  return (
    <div className="grid w-full max-w-md gap-4">
      {reason && step.kind === "credentials" ? (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-info/30 bg-info/10 p-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {de.login.reasons[reason]}
        </div>
      ) : null}

      <Card>
        {step.kind === "credentials" ? (
          <>
            <CardHeader>
              <CardTitle className="text-xl">{de.login.title}</CardTitle>
              <CardDescription>{de.login.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitCredentials} className="grid gap-4" noValidate aria-label={de.login.title}>
                {hints.accounts.length > 0 ? (
                  <fieldset className="grid gap-2 rounded-xl border border-dashed border-warning/40 bg-warning/5 p-3">
                    <legend className="flex items-center gap-1.5 px-1 text-xs font-medium text-warning">
                      <FlaskConical className="size-3.5" aria-hidden="true" />
                      {de.login.devSwitchTitle}
                    </legend>
                    <Label htmlFor="dev-role">{de.login.devSwitchLabel}</Label>
                    <select
                      id="dev-role"
                      data-testid="dev-role"
                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                      defaultValue=""
                      onChange={(e) => applyDemo(e.target.value)}
                    >
                      <option value="">{de.login.devSwitchNone}</option>
                      {hints.accounts.map((a) => (
                        <option key={a.email} value={a.email}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">{de.login.devSwitchHint}</p>
                  </fieldset>
                ) : null}

                <FormField id="email" label={de.login.email} error={errors.email}>
                  {(aria) => (
                    <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} {...aria} />
                  )}
                </FormField>
                <FormField id="password" label={de.login.password} error={errors.password}>
                  {(aria) => (
                    <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} {...aria} />
                  )}
                </FormField>
                {formError ? (
                  <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {formError}
                  </p>
                ) : null}
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? de.login.submitting : de.login.submit}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <KeyRound className="size-5 text-primary" aria-hidden="true" />
                {de.login.mfaTitle}
              </CardTitle>
              <CardDescription>{de.login.mfaDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitMfa} className="grid gap-4" noValidate aria-label={de.login.mfaTitle}>
                <p className="text-sm text-muted-foreground">{step.user.email}</p>
                <FormField id="mfa-code" label={de.login.mfaCode} error={errors.code}>
                  {(aria) => (
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                      className="tracking-[0.3em] tabular-nums"
                      {...aria}
                    />
                  )}
                </FormField>
                {hints.mfaCode ? (
                  <p className="rounded-xl border border-dashed border-warning/40 bg-warning/5 p-2 text-xs text-warning">
                    {de.login.mfaDemoHint(hints.mfaCode)}
                  </p>
                ) : null}
                {formError ? (
                  <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {formError}
                  </p>
                ) : null}
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? de.login.submitting : de.login.mfaSubmit}
                </Button>
                <Button variant="link" onClick={() => void backToCredentials()}>
                  {de.login.mfaBack}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
      <p className="text-center text-xs text-muted-foreground">{de.app.simulationNotice}</p>
    </div>
  );
}
