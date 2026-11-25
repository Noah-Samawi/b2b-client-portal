"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { de } from "@/i18n/de";

type ToastVariant = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = React.useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-3), { id, message, variant }]);
      setTimeout(() => dismiss(id), variant === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  const api = React.useMemo<ToastApi>(
    () => ({ show, success: (m) => show(m, "success"), error: (m) => show(m, "error") }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2">
        {items.map((t) => {
          const Icon = t.variant === "success" ? CheckCircle2 : t.variant === "error" ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.variant === "error" ? "alert" : "status"}
              data-testid="toast"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-3 text-sm shadow-lg",
                t.variant === "success" && "border-primary/40",
                t.variant === "error" && "border-destructive/50",
                t.variant === "info" && "border-border",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  t.variant === "success" && "text-primary",
                  t.variant === "error" && "text-destructive",
                  t.variant === "info" && "text-info",
                )}
              />
              <p className="flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-lg p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={de.common.close}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
