import Link from "next/link";
import { Archive, FileText, Users } from "lucide-react";
import type { Project } from "@/lib/data";
import { Card } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/primitives";
import { ProgressBar } from "@/components/status";
import { formatDate } from "@/lib/format";
import { de } from "@/i18n/de";

export function ProjectCard({ project, href, showMembers = true }: { project: Project; href: string; showMembers?: boolean }) {
  return (
    <Card className="group relative flex flex-col gap-4 p-5 transition-colors hover:border-primary/40" data-testid="project-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base leading-snug font-semibold">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none group-focus-within:underline">
            {project.title}
          </Link>
        </h2>
        {project.archived ? (
          <Badge variant="neutral">
            <Archive aria-hidden="true" />
            {de.project.archived}
          </Badge>
        ) : null}
      </div>
      {project.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p> : null}
      <ProgressBar value={project.progress} label={`${de.project.progress}: ${project.title}`} />
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileText className="size-3.5" aria-hidden="true" />
          {de.dashboard.files(project.fileCount)}
        </span>
        {showMembers ? (
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            {de.dashboard.members(project.memberCount)}
          </span>
        ) : null}
        <span>{de.dashboard.updated(formatDate(project.updatedAt))}</span>
      </div>
    </Card>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
