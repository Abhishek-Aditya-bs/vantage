/**
 * Tiny dropdown menu — no Radix. Click to open, closes on outside-click,
 * Escape, or item activation. Used by the theme toggle.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownItem {
  label: string;
  onSelect: () => void;
  selected?: boolean;
  icon?: ReactNode;
}

interface DropdownMenuProps {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    id: string;
  }) => ReactNode;
  items: DropdownItem[];
  align?: "start" | "end";
  label?: string;
}

export function DropdownMenu({
  trigger,
  items,
  align = "end",
  label,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v), id: menuId })}
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={cn(
              "absolute top-full z-50 mt-2 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitemradio"
                aria-checked={item.selected}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-sm outline-none hover:bg-secondary focus-visible:bg-secondary"
              >
                {item.icon && (
                  <span className="text-muted-foreground">{item.icon}</span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.selected && <Check className="size-3.5 text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
