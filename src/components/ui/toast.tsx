/**
 * Minimal toast system — context + hook + a fixed viewport rendered via portal.
 * Toasts auto-dismiss; errors stay a little longer. Motion slides them in from
 * the bottom edge (like a print sliding out of a camera).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "info" | "success" | "error";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (t: {
    title: string;
    description?: string;
    tone?: ToastTone;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_META: Record<
  ToastTone,
  { icon: typeof Info; className: string; ms: number }
> = {
  info: { icon: Info, className: "text-accent", ms: 3200 },
  success: { icon: CheckCircle2, className: "text-live", ms: 3200 },
  error: { icon: AlertTriangle, className: "text-moment", ms: 5200 },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, tone = "info" }) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), TONE_META[tone].ms);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
          role="region"
          aria-label="Notifications"
        >
          <AnimatePresence>
            {toasts.map((t) => {
              const meta = TONE_META[t.tone];
              const Icon = meta.icon;
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-border bg-card p-3.5 shadow-lg"
                  role={t.tone === "error" ? "alert" : "status"}
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{t.title}</p>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
