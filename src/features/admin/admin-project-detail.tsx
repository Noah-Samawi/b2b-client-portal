"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeft, FolderX, Users } from "lucide-react";
import { getDataSource, type Project } from "@/lib/data";
import { fieldErrors, progressSchema, projectUpdateSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, Skeleton, Textarea } from "@/components/ui/primitives";
import { Slider } from "@/components/ui/menu-slider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { InviteDialog } from "@/components/invite-dialog";
import { PageSkeleton } from "@/components/page-skeleton";
import { ProgressBar } from "@/components/status";
import { useToast } from "@/components/toast";
import { ProjectFiles } from "@/features/files/project-files";
import { useErrorHandler, useLoad } from "@/features/shared/use-portal";
import { DeletionDialog } from "./deletion-dialog";
import { formatDate } from "@/lib/format";
import { de } from "@/i18n/de";

export function AdminProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { data: project, loading, error, setData, reload } = useLoad(`project:${id}`, () => getDataSource().getProject(id));

  if (loading && !project) return <PageSkeleton />;
  if (error || !project) {
    return (
      <EmptyState
        icon={FolderX}
        title={de.errors.projectNotFound}
        action={
          <Button asChild variant="outline">
            <Link href="/admin">{de.project.backToOverview}</Link>
          </Button>
        }
      />
    );
  }

  const readOnly = project.archived;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link href="/admin" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {de.project.backToOverview}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="project-title">
            {project.title}
          </h1>
          {project.archived ? (
            <Badge variant="neutral">
              <Archive aria-hidden="true" />
              {de.project.archived}
            </Badge>
          ) : null}
        </div>
        {readOnly ? (
          <p role="status" className="rounded-xl border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
            {de.project.archivedNotice}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-6">
          <DetailsForm project={project} readOnly={readOnly} onSaved={(p) => setData(() => p)} key={`details-${project.title}|${project.description}`} />
          <Card>
            <CardHeader>
              <CardTitle>{de.project.files}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectFiles projectId={project.id} role="admin" readOnly={readOnly} onChanged={() => void reload()} />
            </CardContent>
          </Card>
        </div>
        <div className="grid content-start gap-6">
          <ProgressControl key={`progress-${project.progress}`} project={project} readOnly={readOnly} onSaved={(p) => setData(() => p)} />
          <MembersCard projectId={project.id} readOnly={readOnly} onChanged={() => void reload()} />
          <LifecycleCard project={project} onChanged={(p) => (p ? setData(() => p) : void reload())} />
        </div>
      </div>
    </div>
  );
}

function DetailsForm({ project, readOnly, onSaved }: { project: Project; readOnly: boolean; onSaved: (p: Project) => void }) {
  const toast = useToast();
  const handleError = useErrorHandler();
  const [title, setTitle] = React.useState(project.title);
  const [description, setDescription] = React.useState(project.description);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const dirty = title !== project.title || description !== project.description;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const patch: Record<string, string> = {};
    if (title !== project.title) patch.title = title;
    if (description !== project.description) patch.description = description;
    const parsed = projectUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      onSaved(await getDataSource().updateProject(project.id, parsed.data));
      setErrors({});
      toast.success(de.project.detailsSaved);
    } catch (err) {
      const pe = handleError(err, { silent: true });
      if (pe.details?.fields) setErrors(pe.details.fields);
      else handleError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{de.project.details}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField id="project-title-input" label={de.project.title} error={errors.title}>
            {(aria) => <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} {...aria} />}
          </FormField>
          <FormField id="project-description" label={de.project.description} error={errors.description}>
            {(aria) => <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} {...aria} />}
          </FormField>
          <div>
            <Button type="submit" disabled={readOnly || !dirty || busy}>
              {busy ? de.common.saving : de.project.saveDetails}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProgressControl({ project, readOnly, onSaved }: { project: Project; readOnly: boolean; onSaved: (p: Project) => void }) {
  const toast = useToast();
  const handleError = useErrorHandler();
  const [value, setValue] = React.useState<string>(String(project.progress));
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const numeric = value.trim() === "" ? Number.NaN : Number(value);
  const sliderValue = Number.isFinite(numeric) ? Math.min(100, Math.max(0, Math.round(numeric))) : project.progress;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = progressSchema.safeParse(numeric);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const updated = await getDataSource().setProgress(project.id, parsed.data);
      onSaved(updated);
      toast.success(de.project.progressSaved(updated.progress));
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{de.project.progress}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4" noValidate>
          <ProgressBar value={project.progress} label={de.project.progressLabel} />
          <Slider
            aria-label={de.project.progressLabel}
            min={0}
            max={100}
            step={1}
            value={[sliderValue]}
            onValueChange={([v]) => setValue(String(v ?? 0))}
            disabled={readOnly}
          />
          <FormField id="progress-input" label={de.project.progressInput} error={error}>
            {(aria) => (
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={readOnly}
                {...aria}
              />
            )}
          </FormField>
          <Button type="submit" disabled={readOnly || busy || numeric === project.progress}>
            {busy ? de.common.saving : de.project.progressSave}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MembersCard({ projectId, readOnly, onChanged }: { projectId: string; readOnly: boolean; onChanged: () => void }) {
  const { data: members, loading, setData } = useLoad(`members:${projectId}`, () => getDataSource().listMembers(projectId));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>{de.project.members}</CardTitle>
        <InviteDialog
          projectId={projectId}
          disabled={readOnly}
          onInvited={(m) => {
            setData((xs) => [...(xs ?? []), m]);
            onChanged();
          }}
        />
      </CardHeader>
      <CardContent>
        {loading && !members ? (
          <Skeleton className="h-16 w-full" />
        ) : (members ?? []).length === 0 ? (
          <EmptyState icon={Users} title={de.project.membersEmpty} className="p-6" />
        ) : (
          <ul className="grid gap-2" aria-label={de.project.members} data-testid="member-list">
            {(members ?? []).map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <Badge variant={m.state === "active" ? "success" : "info"}>
                  {m.state === "active" ? de.project.memberActive : de.project.memberInvited}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LifecycleCard({ project, onChanged }: { project: Project; onChanged: (p?: Project) => void }) {
  const toast = useToast();
  const handleError = useErrorHandler();
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function unarchive() {
    setBusy(true);
    try {
      onChanged(await getDataSource().unarchiveProject(project.id));
      toast.success(de.project.unarchivedToast);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{de.project.lifecycle}</CardTitle>
        <CardDescription>{de.project.lifecycleDescription}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {project.archived ? (
          <>
            {project.archivedAt ? (
              <p className="text-xs text-muted-foreground">
                {de.project.archived}: {formatDate(project.archivedAt)}
              </p>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void unarchive()} disabled={busy}>
              <ArchiveRestore aria-hidden="true" />
              {de.project.unarchive}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
            <Archive aria-hidden="true" />
            {de.project.archive}
          </Button>
        )}
        <DeletionDialog
          targetLabel={project.title}
          triggerLabel={de.project.requestDeletion}
          onSubmit={async (input) => {
            const request = await getDataSource().requestProjectDeletion(project.id, input);
            toast.success(de.project.deletionRequested);
            onChanged();
            return request;
          }}
        />
        <ConfirmDialog
          open={confirmArchive}
          onOpenChange={setConfirmArchive}
          title={de.project.archiveConfirmTitle}
          description={de.project.archiveConfirmText}
          confirmLabel={de.project.archive}
          onConfirm={async () => {
            try {
              onChanged(await getDataSource().archiveProject(project.id));
              toast.success(de.project.archivedToast);
            } catch (err) {
              handleError(err);
              throw err;
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
