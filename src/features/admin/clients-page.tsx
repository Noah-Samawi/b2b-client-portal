"use client";

import * as React from "react";
import { Inbox, Users } from "lucide-react";
import { getDataSource, type DeletionRequest } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/project-card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { useErrorHandler, useLoad } from "@/features/shared/use-portal";
import { DeletionDialog } from "./deletion-dialog";
import { formatDate, formatDateTime } from "@/lib/format";
import { de } from "@/i18n/de";

export function ClientsPage() {
  const toast = useToast();
  const handleError = useErrorHandler();
  const clients = useLoad("clients", () => getDataSource().listClients());
  const requests = useLoad("deletion-requests", () => getDataSource().listDeletionRequests());
  const [cancelTarget, setCancelTarget] = React.useState<DeletionRequest | null>(null);

  const refreshAll = () => {
    void clients.reload();
    void requests.reload();
  };

  return (
    <>
      <PageHeader title={de.clients.title} description={de.clients.description} />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{de.clients.tableClients}</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.loading && !clients.data ? (
              <Skeleton className="h-32 w-full" />
            ) : (clients.data ?? []).length === 0 ? (
              <EmptyState icon={Users} title={de.clients.tableClients} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <caption className="sr-only">{de.clients.tableClients}</caption>
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 pr-3 font-medium">{de.clients.name}</th>
                      <th scope="col" className="py-2 pr-3 font-medium">{de.clients.company}</th>
                      <th scope="col" className="py-2 pr-3 font-medium">{de.clients.projects}</th>
                      <th scope="col" className="py-2 pr-3 font-medium">{de.clients.status}</th>
                      <th scope="col" className="py-2 font-medium"><span className="sr-only">{de.common.actions}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(clients.data ?? []).map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0" data-testid="client-row">
                        <td className="py-3 pr-3">
                          <p className="font-medium">{c.fullName}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </td>
                        <td className="py-3 pr-3">{c.company ?? "–"}</td>
                        <td className="py-3 pr-3 tabular-nums">{c.projectCount}</td>
                        <td className="py-3 pr-3">
                          {c.pendingDeletion ? (
                            <Badge variant="danger">{de.clients.pendingDeletion}</Badge>
                          ) : (
                            <Badge variant="success">{de.clients.active}</Badge>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <DeletionDialog
                            targetLabel={`${c.fullName} (${c.email})`}
                            triggerLabel={de.clients.requestDeletion}
                            triggerAriaLabel={de.clients.requestDeletionFor(c.fullName)}
                            disabled={c.pendingDeletion}
                            onSubmit={async (input) => {
                              const r = await getDataSource().requestClientDeletion(c.id, input);
                              toast.success(de.project.deletionRequested);
                              refreshAll();
                              return r;
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{de.clients.requestsTitle}</CardTitle>
            <CardDescription>{de.clients.phase2Note}</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.loading && !requests.data ? (
              <Skeleton className="h-24 w-full" />
            ) : (requests.data ?? []).length === 0 ? (
              <EmptyState icon={Inbox} title={de.clients.requestsEmpty} />
            ) : (
              <ul className="grid gap-2" data-testid="deletion-requests">
                {(requests.data ?? []).map((r) => (
                  <li key={r.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <Badge variant="neutral">{r.targetType === "client" ? de.clients.typeClient : de.clients.typeProject}</Badge>
                        <span className="truncate">{r.targetLabel}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {de.clients.reason}: {r.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {de.clients.requested} {formatDateTime(r.createdAt)} · {de.clients.scheduled} {formatDate(r.scheduledFor)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "requested" ? "warning" : "neutral"}>{de.clients.requestStatus[r.status]}</Badge>
                      {r.status === "requested" ? (
                        <Button variant="outline" size="sm" onClick={() => setCancelTarget(r)}>
                          {de.clients.cancel}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title={de.clients.cancel}
        description={cancelTarget?.targetLabel ?? ""}
        confirmLabel={de.clients.cancel}
        onConfirm={async () => {
          if (!cancelTarget) return;
          try {
            await getDataSource().cancelDeletionRequest(cancelTarget.id);
            toast.success(de.clients.cancelled);
            refreshAll();
          } catch (err) {
            handleError(err);
            throw err;
          }
        }}
      />
    </>
  );
}
