/**
 * Space — the live room. Wires the socket hook to the wall, presence, capture,
 * the synchronized Moment flow, and the recap reel.
 *
 * Token resolution: prefer ?t= in the URL (from create/join), persisting it to
 * sessionStorage; fall back to any previously-stored token for this code. If
 * neither exists, bounce to the Join screen.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Camera, Clapperboard, LogOut } from "lucide-react";
import type { MediaMeta } from "@shared/protocol";
import { api, getToken, setToken } from "@/lib/api";
import { getSpace, touchSpace } from "@/lib/spaces";
import { useSpaceSocket } from "@/lib/useSpaceSocket";
import type { CapturedFrame } from "@/lib/capture";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IrisShutter } from "@/components/brand/IrisShutter";
import { Mascot } from "@/components/brand/Mascot";
import { PresenceBar } from "@/components/space/PresenceBar";
import { LiveWall } from "@/components/space/LiveWall";
import { CaptureSheet } from "@/components/space/CaptureSheet";
import { MomentControl } from "@/components/space/MomentControl";
import { MomentCountdown } from "@/components/space/MomentCountdown";
import { MomentViewer } from "@/components/space/MomentViewer";
import { RecapReel } from "@/components/space/RecapReel";
import { ShareDialog } from "@/components/space/ShareDialog";
import { ImageLightbox } from "@/components/space/ImageLightbox";

export default function Space() {
  const { code = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // resolve + persist the capability token
  const [token, setTokenState] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    const fromUrl = search.get("t");
    if (fromUrl) {
      setToken(code, fromUrl);
      setTokenState(fromUrl);
      // strip the token from the visible URL for hygiene
      window.history.replaceState(null, "", `/s/${code}`);
    } else {
      // prefer the per-tab session token; fall back to a saved space (rejoin
      // after closing the tab), hydrating the session for this code.
      const session = getToken(code);
      const stored = getSpace(code)?.token ?? null;
      const resolved = session ?? stored;
      if (!session && stored) setToken(code, stored);
      setTokenState(resolved);
    }
    setAuthResolved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const sock = useSpaceSocket(code, token);

  // keep this space at the top of "Your spaces" and sync its latest name
  useEffect(() => {
    if (sock.space) touchSpace(code, { name: sock.space.name });
  }, [sock.space, code]);

  // local UI state
  const [captureOpen, setCaptureOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [viewer, setViewer] = useState<MediaMeta[] | null>(null);
  const [lightbox, setLightbox] = useState<MediaMeta | null>(null);
  const [countdownDone, setCountdownDone] = useState<string | null>(null);

  const joinUrl = useMemo(() => {
    if (sock.space) return `${location.origin}/join/${sock.space.code}`;
    return `${location.origin}/join/${code}`;
  }, [sock.space, code]);

  /* ---------------------------------------------------------- uploads */

  const uploadFrame = useCallback(
    async (
      frame: CapturedFrame,
      kind: "wall" | "moment",
      momentId?: string,
    ) => {
      if (!sock.you) return;
      // optimistic placeholder on the wall
      const tempId = `temp:${crypto.randomUUID()}`;
      const optimistic: MediaMeta = {
        id: tempId,
        kind,
        momentId,
        memberId: sock.you.memberId,
        displayName: sock.you.displayName,
        contentType: frame.blob.type || "image/webp",
        width: frame.width,
        height: frame.height,
        createdAt: Date.now(),
      };
      if (kind === "wall") sock.pushOptimistic(optimistic);
      try {
        await api.uploadMedia(code, frame.blob, {
          kind,
          width: frame.width,
          height: frame.height,
          momentId,
        });
        // server will broadcast media_added, which replaces the placeholder
      } catch {
        toast({
          title: "Upload failed",
          description: "That photo didn't make it to the wall.",
          tone: "error",
        });
      }
    },
    [code, sock, toast],
  );

  const onWallCapture = useCallback(
    (frame: CapturedFrame) => uploadFrame(frame, "wall"),
    [uploadFrame],
  );

  /* ---------------------------------------------------------- moment */

  const onTrigger = useCallback(async () => {
    setTriggering(true);
    try {
      await sock.triggerMoment();
    } catch {
      toast({
        title: "Couldn't start a Moment",
        description: "Try again in a few seconds.",
        tone: "error",
      });
    } finally {
      setTriggering(false);
    }
  }, [sock, toast]);

  const onMomentCapture = useCallback(
    (frame: CapturedFrame) => {
      const id = sock.moment?.momentId;
      if (id) return uploadFrame(frame, "moment", id);
    },
    [sock.moment, uploadFrame],
  );

  // open the multi-angle viewer when a moment completes
  useEffect(() => {
    if (sock.moment?.phase === "complete" && sock.moment.media) {
      setViewer(sock.moment.media);
    }
  }, [sock.moment]);

  const activeMoment = sock.moment;
  const showCountdown =
    activeMoment &&
    (activeMoment.phase === "scheduled" || activeMoment.phase === "collecting") &&
    activeMoment.captureAtServer != null &&
    countdownDone !== activeMoment.momentId;

  /* ---------------------------------------------------------- guards */

  if (authResolved && !token) {
    return (
      <Gate
        title="Join required"
        body="You need an invite to enter this space."
        cta={{ to: `/join/${code}`, label: "Go to join" }}
      />
    );
  }

  if (sock.status === "error") {
    return (
      <Gate
        title="Couldn't connect"
        body="Your invite may have expired. Try rejoining the space."
        cta={{ to: `/join/${code}`, label: "Rejoin" }}
      />
    );
  }

  const connecting = !sock.space && sock.status !== "closed";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* compact immersive header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur-sm">
        <Logo size={26} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="font-mono text-xs"
            aria-label="Leave this space"
          >
            <LogOut />
            <span className="hidden sm:inline">Leave</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <PresenceBar
        space={sock.space}
        members={sock.members}
        activeIds={sock.activeIds}
        you={sock.you}
        status={sock.status}
        onShare={() => setShareOpen(true)}
      />

      {/* host moment control bar */}
      {sock.you?.role === "host" && (
        <div className="border-b border-border bg-card/40 px-4 py-3">
          <MomentControl
            onTrigger={onTrigger}
            busy={triggering}
            disabled={
              !!activeMoment && activeMoment.phase !== "complete"
            }
          />
        </div>
      )}

      {/* wall */}
      <main id="main" className="relative flex-1 px-3 py-4 sm:px-4">
        {connecting ? (
          <div className="flex flex-col items-center gap-4 py-24">
            <IrisShutter size={88} ariaLabel="Connecting to space" />
            <p className="font-mono text-sm text-muted-foreground">
              connecting to the wall…
            </p>
          </div>
        ) : (
          <LiveWall code={code} wall={sock.wall} onOpen={setLightbox} />
        )}
      </main>

      {/* floating actions */}
      <div className="pointer-events-none sticky bottom-0 z-20 flex items-center justify-between gap-3 p-4">
        <Button
          variant="outline"
          size="lg"
          onClick={() => setRecapOpen(true)}
          disabled={sock.wall.length === 0}
          className="pointer-events-auto shadow-lg"
        >
          <Clapperboard className="size-5" />
          <span className="hidden sm:inline">Play recap</span>
        </Button>

        {/* camera FAB */}
        <button
          type="button"
          onClick={() => setCaptureOpen(true)}
          aria-label="Take a photo"
          className="pointer-events-auto grid size-16 place-items-center rounded-full border-2 border-foreground/15 bg-primary text-primary-foreground shadow-xl outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Camera className="size-7" />
        </button>
      </div>

      {/* ----------------------------------------------------- overlays */}

      <CaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={onWallCapture}
      />

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        code={sock.space?.code ?? code}
        joinUrl={joinUrl}
      />

      {showCountdown && activeMoment?.captureAtServer != null && (
        <MomentCountdown
          momentId={activeMoment.momentId}
          captureAtServer={activeMoment.captureAtServer}
          triggeredBy={activeMoment.triggeredBy}
          serverTimeToLocal={sock.serverTimeToLocal}
          onCapture={onMomentCapture}
          onDone={() => setCountdownDone(activeMoment.momentId)}
        />
      )}

      {viewer && (
        <MomentViewer
          code={code}
          momentId={activeMoment?.momentId ?? "moment"}
          media={viewer}
          onClose={() => {
            setViewer(null);
            sock.dismissMoment();
          }}
        />
      )}

      {recapOpen && (
        <RecapReel
          code={code}
          spaceName={sock.space?.name ?? "Vantage"}
          media={sock.wall}
          onClose={() => setRecapOpen(false)}
        />
      )}

      {lightbox && (
        <ImageLightbox
          code={code}
          media={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

/** Full-page gate used for auth/connection failures. */
function Gate({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { to: string; label: string };
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <Mascot size={80} />
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>
        <Button asChild>
          <Link to={cta.to}>{cta.label}</Link>
        </Button>
      </div>
    </div>
  );
}
