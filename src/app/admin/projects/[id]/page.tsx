import { Suspense } from "react";
import { AdminProjectDetail } from "@/features/admin/admin-project-detail";
import { PageSkeleton } from "@/components/page-skeleton";

export default function AdminProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminProjectDetail params={params} />
    </Suspense>
  );
}
