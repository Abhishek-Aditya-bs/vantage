/**
 * FIG_004 — EDGE TOPOLOGY
 * A blueprint schematic of the runtime: phone → edge worker → per-space Durable
 * Object → SQLite, with a per-IP rate-limiter DO and a hibernating websocket.
 * No origin server, one accent-free technical drawing of the whole stack.
 */
import { Label, Leader, INK } from "./primitives";

const VB_W = 720;
const VB_H = 470;
const CX = 286;

function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  strong = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} stroke={INK} fill="none" strokeWidth={strong ? 1.6 : 1.2} />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 7 : y + h / 2}
        fill={INK}
        stroke="none"
        fontFamily="var(--font-mono)"
        fontSize={12}
        letterSpacing={0.6}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ textTransform: "uppercase" }}
      >
        {title}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 9}
          fill={INK}
          stroke="none"
          fontFamily="var(--font-mono)"
          fontSize={9}
          letterSpacing={0.4}
          textAnchor="middle"
          dominantBaseline="middle"
          opacity={0.55}
          style={{ textTransform: "uppercase" }}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

export function FigArchitecture() {
  const client = { x: CX - 92, y: 28, w: 184, h: 54 };
  const worker = { x: CX - 92, y: 152, w: 184, h: 54 };
  const dox = { x: CX - 110, y: 276, w: 220, h: 62 };
  const sqlite = { x: CX - 72, y: 396, w: 144, h: 46 };
  const limiter = { x: 506, y: 152, w: 160, h: 54 };

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" className="block h-auto w-full text-foreground">
      {/* spine connections */}
      <Leader x1={CX} y1={client.y + client.h} x2={CX} y2={worker.y - 2} opacity={0.7} head={7} />
      <Leader x1={CX} y1={worker.y + worker.h} x2={CX} y2={dox.y - 2} opacity={0.7} head={7} />
      <Leader x1={CX} y1={dox.y + dox.h} x2={CX} y2={sqlite.y - 2} opacity={0.7} head={7} />

      {/* connection labels */}
      <Label x={CX + 10} y={(client.y + client.h + worker.y) / 2} size={9} dim>
        SCAN QR · JWT
      </Label>
      <Label x={CX + 10} y={(worker.y + worker.h + dox.y) / 2} size={9} dim>
        ROUTE BY SPACE
      </Label>
      <Label x={CX + 10} y={(dox.y + dox.h + sqlite.y) / 2} size={9} dim>
        PERSIST
      </Label>

      {/* worker ↔ rate limiter */}
      <Leader x1={worker.x + worker.w} y1={worker.y + worker.h / 2} x2={limiter.x - 2} y2={limiter.y + limiter.h / 2} opacity={0.7} head={7} />
      <Label x={(worker.x + worker.w + limiter.x) / 2} y={worker.y + worker.h / 2 - 8} anchor="middle" size={9} dim>
        CHECK
      </Label>

      {/* hibernating websocket — client down to DO, on the right */}
      <path
        d={`M ${client.x + client.w} ${client.y + client.h / 2}
            C 470 110, 470 300, ${dox.x + dox.w} ${dox.y + 18}`}
        stroke={INK}
        fill="none"
        strokeWidth={1.2}
        strokeDasharray="5 4"
        opacity={0.6}
      />
      <Label x={478} y={208} size={9} dim>
        WEBSOCKET
      </Label>
      <Label x={478} y={222} size={9} dim>
        (HIBERNATED)
      </Label>

      {/* boxes */}
      <Box {...client} title="PHONE · PWA" sub="ANY BROWSER" />
      <Box {...worker} title="EDGE WORKER" sub="300+ CITIES" />
      <Box {...dox} title="DURABLE OBJECT" sub="SPACEROOM · 1 / SPACE" strong />
      <Box {...sqlite} title="SQLITE" sub="PHOTOS + STATE" />
      <Box {...limiter} title="RATE LIMITER DO" sub="PER-IP QUOTA" />

      {/* footnote */}
      <Leader x1={150} y1={dox.y + 30} x2={dox.x - 2} y2={dox.y + 30} opacity={0.7} />
      <Label x={146} y={dox.y + 26} anchor="end" size={10}>
        NO ORIGIN
      </Label>
      <Label x={146} y={dox.y + 42} anchor="end" size={9} dim>
        SERVER · $0
      </Label>
    </svg>
  );
}
