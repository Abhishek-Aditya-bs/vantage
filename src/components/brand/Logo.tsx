/**
 * Wordmark lockup — pixel mascot + "Vantage" in Bricolage display.
 * Renders as a link to home unless `asLink={false}`.
 */
import { Link } from "react-router-dom";
import { Mascot } from "./Mascot";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  asLink?: boolean;
  /** keep the mascot shutter still inside dense headers */
  still?: boolean;
}

export function Logo({
  className,
  size = 30,
  asLink = true,
  still = true,
}: LogoProps) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mascot size={size} still={still} title="Vantage" />
      <span className="font-display text-xl font-bold tracking-tight">
        Vantage
      </span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link
      to="/"
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Vantage — home"
    >
      {inner}
    </Link>
  );
}
