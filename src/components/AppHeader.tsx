/**
 * Persistent top bar — logo + theme toggle. Sticky, hairline bottom rule.
 * `minimal` drops the border for immersive routes (e.g. the live Space).
 */
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AppHeaderProps {
  children?: ReactNode;
  className?: string;
  bordered?: boolean;
}

export function AppHeader({ children, className, bordered = true }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-background/85 backdrop-blur-sm",
        bordered && "border-b border-border",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <Logo />
        <div className="flex items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
