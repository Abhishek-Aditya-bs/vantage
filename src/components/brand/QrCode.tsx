/**
 * Themed QR code. qrcode.react needs concrete colors, so we resolve the brand
 * tokens to computed values and re-resolve when the theme changes.
 */
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

function resolveVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function QrCode({ value, size = 200, className }: QrCodeProps) {
  const { theme } = useTheme();
  const [colors, setColors] = useState({ fg: "#1a1410", bg: "#ffffff" });

  useEffect(() => {
    // resolve on the next frame so the .dark class is applied first
    const id = requestAnimationFrame(() => {
      setColors({
        fg: resolveVar("--foreground", "#1a1410"),
        bg: resolveVar("--card", "#ffffff"),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [theme]);

  return (
    <div
      className={cn(
        "inline-grid place-items-center rounded-md border border-border bg-card p-3",
        className,
      )}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={2}
        fgColor={colors.fg}
        bgColor={colors.bg}
        title="Join QR code"
      />
    </div>
  );
}
