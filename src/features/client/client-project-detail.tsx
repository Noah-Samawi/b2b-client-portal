"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, FolderX } from "lucide-react";
import { getDataSource } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/page-skeleton";
import { ProgressBar } from "@/components/status";
import { ProjectFiles } from "@/features/files/project-files";
import { useLoad } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

export function ClientProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { data: project, loading, error } = useLoad(`project:${id}`, () => getDataSource().getProject(id));

  if (loading && !project) return <PageSkeleton />;
  if (error || !project) {
    return (
      <EmptyState
        icon={FolderX}
        title={de.errors.projectNotFound}
        action={
          <Button asChild variant="outline">
            <Link href="/client">{de.project.backToOverview}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link href="/client" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {de.project.backToOverview}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="project-title">
          {project.title}
        </h1>
        {project.description ? <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p> : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{de.project.progress}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressBar value={project.progress} label={de.project.progressLabel} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{de.project.files}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectFiles projectId={project.id} role="client" readOnly={project.archived} />
        </CardContent>
      </Card>
    </div>
  );
}
