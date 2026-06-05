import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Label = forwardRef<
  HTMLLabelElement,
  LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground select-none",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
