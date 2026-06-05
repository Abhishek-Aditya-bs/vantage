/**
 * Presence bar — pixel avatars (active ones pulse teal), live member count,
 * space name + code, connection status, and a share button.
 */
import { Share2, Wifi, WifiOff } from "lucide-react";
import type { Member, SpacePublic } from "@shared/protocol";
import type { SocketStatus } from "@/lib/useSpaceSocket";
import { PixelAvatar } from "@/components/brand/PixelAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCode } from "@/lib/format";

interface PresenceBarProps {
  space: SpacePublic | null;
  members: Member[];
  activeIds: Set<string>;
  you: Member | null;
  status: SocketStatus;
  onShare: () => void;
}

export function PresenceBar({
  space,
  members,
  activeIds,
  you,
  status,
  onShare,
}: PresenceBarProps) {
  const activeCount = members.filter((m) => activeIds.has(m.memberId)).length;
  // sort active members first, then cap the visible stack
  const ordered = [...members].sort(
    (a, b) => Number(activeIds.has(b.memberId)) - Number(activeIds.has(a.memberId)),
  );
  const visible = ordered.slice(0, 7);
  const overflow = members.length - visible.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-base font-semibold leading-tight">
            {space?.name ?? "Space"}
          </h1>
          {space && (
            <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
              {formatCode(space.code)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[0.7rem] text-muted-foreground">
          <ConnectionDot status={status} />
          <span>
            <span className="text-live">{activeCount}</span> live ·{" "}
            {members.length} joined
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* avatar stack */}
        <div className="flex -space-x-1.5">
          {visible.map((m) => (
            <div
              key={m.memberId}
              className="rounded-sm ring-2 ring-card"
              title={`${m.displayName}${m.memberId === you?.memberId ? " (you)" : ""}`}
            >
              <PixelAvatar
                seed={m.avatarSeed}
                size={28}
                active={activeIds.has(m.memberId)}
              />
            </div>
          ))}
          {overflow > 0 && (
            <span className="grid size-7 place-items-center rounded-sm bg-secondary font-mono text-[0.65rem] text-muted-foreground ring-2 ring-card">
              +{overflow}
            </span>
          )}
        </div>

        {you?.role === "host" && <Badge variant="primary">host</Badge>}

        <Button
          variant="outline"
          size="sm"
          onClick={onShare}
          aria-label="Share this space"
        >
          <Share2 className="size-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </div>
    </div>
  );
}

function ConnectionDot({ status }: { status: SocketStatus }) {
  if (status === "open") {
    return (
      <span className="flex items-center gap-1 text-live">
        <Wifi className="size-3" /> connected
      </span>
    );
  }
  if (status === "reconnecting" || status === "connecting") {
    return (
      <span className="flex items-center gap-1 text-primary">
        <Wifi className="size-3 animate-pulse" /> connecting…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <WifiOff className="size-3" /> offline
    </span>
  );
}
