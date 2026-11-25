"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus, Search } from "lucide-react";
import { getDataSource } from "@/lib/data";
import { fieldErrors, projectCreateSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField, Input, Skeleton, Textarea } from "@/components/ui/primitives";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, ProjectCard } from "@/components/project-card";
import { useToast } from "@/components/toast";
import { useErrorHandler, useLoad } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

export function AdminDashboard() {
  const [query, setQuery] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const { data: projects, loading } = useLoad(`projects:archived=${showArchived}`, () =>
    getDataSource().listProjectsForUser({ includeArchived: showArchived }),
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects ?? [];
    return (projects ?? []).filter((p) => `${p.title} ${p.description}`.toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <>
      <PageHeader title={de.dashboard.adminTitle} description={de.dashboard.adminDescription} actions={<CreateProjectDialog />} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="project-search" className="sr-only">
            {de.dashboard.searchLabel}
          </label>
          <Input
            id="project-search"
            type="search"
            placeholder={de.dashboard.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="size-4 rounded accent-[var(--color-primary)]"
          />
          {de.dashboard.showArchived}
        </label>
      </div>

      {loading && !projects ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (projects ?? []).length === 0 ? (
        <EmptyState icon={FolderKanban} title={de.dashboard.emptyTitle} description={de.dashboard.emptyAdmin} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title={de.dashboard.noResults} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} href={`/admin/projects/${p.id}`} />
          ))}
        </div>
      )}
    </>
  );
}

function CreateProjectDialog() {
  const router = useRouter();
  const toast = useToast();
  const handleError = useErrorHandler();
  const [open, setOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = projectCreateSchema.safeParse({ title: form.get("title"), description: form.get("description") ?? "" });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      const project = await getDataSource().createProject(parsed.data);
      toast.success(de.project.created);
      setOpen(false);
      router.push(`/admin/projects/${project.id}`);
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
        <Button>
          <Plus aria-hidden="true" />
          {de.dashboard.newProject}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{de.project.createTitle}</DialogTitle>
          <DialogDescription>{de.project.createDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id="new-title" label={de.project.title} error={errors.title}>
            {(aria) => <Input name="title" {...aria} />}
          </FormField>
          <FormField id="new-description" label={`${de.project.description} (${de.common.optional})`} error={errors.description}>
            {(aria) => <Textarea name="description" {...aria} />}
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {de.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? de.common.saving : de.project.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
