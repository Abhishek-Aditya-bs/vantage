/**
 * Persistent theme toggle — a dropdown offering Light / Dark / System with
 * sun/moon/monitor lucide icons. The trigger shows the currently-resolved theme.
 */
import { Sun, Moon, Monitor } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, mode, setMode } = useTheme();

  return (
    <DropdownMenu
      label="Color theme"
      items={[
        {
          label: "Light",
          icon: <Sun className="size-4" />,
          selected: mode === "light",
          onSelect: () => setMode("light"),
        },
        {
          label: "Dark",
          icon: <Moon className="size-4" />,
          selected: mode === "dark",
          onSelect: () => setMode("dark"),
        },
        {
          label: "System",
          icon: <Monitor className="size-4" />,
          selected: mode === "system",
          onSelect: () => setMode("system"),
        },
      ]}
      trigger={({ toggle, open, id }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`Color theme: ${mode}`}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-md border border-border bg-card text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {theme === "dark" ? (
            <Moon className="size-[1.1rem]" />
          ) : (
            <Sun className="size-[1.1rem]" />
          )}
        </button>
      )}
    />
  );
}
