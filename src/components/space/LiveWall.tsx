/**
 * Live wall — a responsive masonry (CSS columns) of media tiles. New tiles
 * animate "landing on the surface": they enter from a random edge with a slight
 * rotation that settles to 0, staggered. Each tile shows uploader + relative
 * time in mono. Empty state uses the mascot.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { MediaMeta } from "@shared/protocol";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { hashSeed } from "@/lib/pixel";
import { Mascot } from "@/components/brand/Mascot";

interface LiveWallProps {
  code: string;
  wall: MediaMeta[];
  onOpen: (media: MediaMeta) => void;
}

const EDGES = [
  { x: 0, y: -48 },
  { x: 48, y: 0 },
  { x: 0, y: 48 },
  { x: -48, y: 0 },
];

export function LiveWall({ code, wall, onOpen }: LiveWallProps) {
  // a slow "now" tick so relative timestamps stay fresh
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  if (wall.length === 0) {
    return <EmptyWall />;
  }

  return (
    <div className="[column-fill:_balance] columns-2 gap-2 sm:columns-3 lg:columns-4 [&>*]:mb-2">
      <AnimatePresence initial={false}>
        {wall.map((m, i) => (
          <WallTile
            key={m.id}
            media={m}
            code={code}
            index={i}
            now={now}
            onOpen={onOpen}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function WallTile({
  media,
  code,
  index,
  now,
  onOpen,
}: {
  media: MediaMeta;
  code: string;
  index: number;
  now: number;
  onOpen: (m: MediaMeta) => void;
}) {
  // deterministic per-tile entrance so re-renders don't re-randomize
  const { edge, rot } = useMemo(() => {
    const h = hashSeed(media.id);
    return {
      edge: EDGES[h % EDGES.length],
      rot: ((h >> 3) % 9) - 4, // -4..4 deg
    };
  }, [media.id]);

  const isOptimistic = media.id.startsWith("temp:");
  const aspect =
    media.width && media.height ? media.width / media.height : 1;

  return (
    <motion.button
      type="button"
      layout
      onClick={() => !isOptimistic && onOpen(media)}
      initial={{
        opacity: 0,
        x: edge.x,
        y: edge.y,
        rotate: rot * 2.2,
        scale: 0.92,
      }}
      animate={{ opacity: isOptimistic ? 0.7 : 1, x: 0, y: 0, rotate: rot, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{
        duration: 0.38,
        ease: "easeOut",
        delay: Math.min(index * 0.015, 0.15),
      }}
      className="group relative block w-full overflow-hidden rounded-md border border-border bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Photo by ${media.displayName}`}
    >
      {/* keep layout stable using the known aspect ratio */}
      <div style={{ aspectRatio: aspect }} className="w-full bg-secondary">
        {!isOptimistic && (
          <img
            src={api.mediaUrl(code, media.id)}
            alt={`by ${media.displayName}`}
            loading="lazy"
            decoding="async"
            width={media.width}
            height={media.height}
            className="h-full w-full object-cover"
          />
        )}
        {isOptimistic && (
          <div className="grid h-full w-full place-items-center">
            <span className="font-mono text-[0.65rem] text-muted-foreground">
              uploading…
            </span>
          </div>
        )}
      </div>

      {media.kind === "moment" && (
        <span className="absolute left-1.5 top-1.5 rounded-sm bg-moment px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-moment-foreground">
          moment
        </span>
      )}

      {/* caption bar */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className="truncate font-mono text-[0.7rem] text-foreground">
          {media.displayName}
        </span>
        <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">
          {relativeTime(media.createdAt, now)}
        </span>
      </div>
    </motion.button>
  );
}

function EmptyWall() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <Mascot size={88} />
      <div>
        <h2 className="font-display text-xl font-semibold">The wall is empty</h2>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Tap the camera to take the first photo — it&rsquo;ll land here for
          everyone, instantly.
        </p>
      </div>
      <pre
        aria-hidden="true"
        className="font-mono text-[0.65rem] leading-tight text-muted-foreground"
      >{`░░░░░░░░░░░░
░  waiting ░
░░░░░░░░░░░░`}</pre>
    </div>
  );
}
