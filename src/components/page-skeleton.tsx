import { Skeleton } from "@/components/ui/primitives";
import { de } from "@/i18n/de";

export function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label={de.common.loading}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
