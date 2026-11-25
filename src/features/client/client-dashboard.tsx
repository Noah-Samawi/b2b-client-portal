"use client";

import { FolderKanban } from "lucide-react";
import { getDataSource } from "@/lib/data";
import { Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, ProjectCard } from "@/components/project-card";
import { useRequiredUser } from "@/features/auth/session-context";
import { useLoad } from "@/features/shared/use-portal";
import { de } from "@/i18n/de";

export function ClientDashboard() {
  const user = useRequiredUser();
  const { data: projects, loading } = useLoad("projects", () => getDataSource().listProjectsForUser());

  return (
    <>
      <PageHeader title={de.dashboard.clientTitle} description={de.dashboard.clientDescription(user.company)} />
      {loading && !projects ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : (projects ?? []).length === 0 ? (
        <EmptyState icon={FolderKanban} title={de.dashboard.emptyTitle} description={de.dashboard.emptyClient} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(projects ?? []).map((p) => (
            <ProjectCard key={p.id} project={p} href={`/client/projects/${p.id}`} showMembers={false} />
          ))}
        </div>
      )}
    </>
  );
}
