import { Suspense } from "react";
import { ClientProjectDetail } from "@/features/client/client-project-detail";
import { PageSkeleton } from "@/components/page-skeleton";

export default function ClientProjectPage({ params }: PageProps<"/client/projects/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientProjectDetail params={params} />
    </Suspense>
  );
}
