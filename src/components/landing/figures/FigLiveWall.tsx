/**
 * FIG_002 — THE LIVE WALL (isometric contact sheet)
 * A receding grid plane is the shared surface; each rhombus is one photo tile,
 * tagged with its author and timestamp. Two incoming frames are floated above
 * their empty slots on dashed registration lines — the wall assembling itself,
 * drawn as a static exploded view (no motion).
 */
import { Label, Leader, Reg, Hatch, INK } from "./primitives";

const VB_W = 720;
const VB_H = 460;
const S = 62; // cell size
const OX = 360;
const OY = 96;
const K = 0.866;

function iso(i: number, j: number) {
  return { x: OX + (i - j) * K * S, y: OY + (i + j) * 0.5 * S };
}

function rhombus(i: number, j: number) {
  const a = iso(i, j);
  const b = iso(i + 1, j);
  const c = iso(i + 1, j + 1);
  const d = iso(i, j + 1);
  return `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)} ${d.x.toFixed(1)},${d.y.toFixed(1)}`;
}

/** photo tile: outline + hatch + author-tag corner + timestamp tick */
function Tile({ i, j, dy = 0, ghost = false }: { i: number; j: number; dy?: number; ghost?: boolean }) {
  const a = iso(i, j);
  const c = iso(i + 1, j + 1);
  const mid = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 + dy };
  return (
    <g transform={`translate(0 ${dy})`} stroke={INK} fill="none">
      <polygon
        points={rhombus(i, j)}
        strokeWidth={ghost ? 1 : 1.3}
        strokeDasharray={ghost ? "4 4" : undefined}
        fill={ghost ? "none" : "url(#lw-hatch)"}
        opacity={ghost ? 0.6 : 1}
      />
      {!ghost && (
        <>
          {/* author tag — small filled lozenge at the near corner */}
          <circle cx={mid.x} cy={mid.y - 2} r={3.4} fill={INK} stroke="none" opacity={0.8} />
          <line x1={mid.x + 9} y1={mid.y - 2} x2={mid.x + 24} y2={mid.y - 2} strokeWidth={1.2} opacity={0.55} />
        </>
      )}
    </g>
  );
}

export function FigLiveWall() {
  // 4 wide (i:0..3) × 3 deep (j:0..2); leave two slots empty for incoming frames
  const empties = new Set(["3,0", "0,2"]);
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) cells.push([i, j]);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" className="block h-auto w-full text-foreground">
      <defs>
        <Hatch id="lw-hatch" gap={6} opacity={0.16} />
      </defs>

      {/* grid surface — faint full lattice under the tiles */}
      <g stroke={INK} opacity={0.28}>
        {Array.from({ length: 5 }).map((_, i) => {
          const a = iso(i, 0);
          const b = iso(i, 3);
          return <line key={`gi${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1} strokeDasharray="2 4" />;
        })}
        {Array.from({ length: 4 }).map((_, j) => {
          const a = iso(0, j);
          const b = iso(4, j);
          return <line key={`gj${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1} strokeDasharray="2 4" />;
        })}
      </g>

      {/* placed tiles */}
      {cells.map(([i, j]) =>
        empties.has(`${i},${j}`) ? (
          <polygon key={`e${i}${j}`} points={rhombus(i, j)} stroke={INK} strokeWidth={1} opacity={0.3} fill="none" />
        ) : (
          <Tile key={`t${i}${j}`} i={i} j={j} />
        ),
      )}

      {/* two incoming frames floated above their empty slots */}
      {(["3,0", "0,2"] as const).map((key, idx) => {
        const [i, j] = key.split(",").map(Number);
        const lift = idx === 0 ? -78 : -104;
        const a = iso(i, j);
        const c = iso(i + 1, j + 1);
        return (
          <g key={`in${key}`}>
            <Reg x1={a.x} y1={a.y} x2={a.x} y2={a.y + lift} opacity={0.4} />
            <Reg x1={c.x} y1={c.y} x2={c.x} y2={c.y + lift} opacity={0.4} />
            <Tile i={i} j={j} dy={lift} />
          </g>
        );
      })}

      {/* labels */}
      <Leader x1={150} y1={118} x2={iso(0.5, 0.5).x - 6} y2={iso(0.5, 0.5).y} opacity={0.7} />
      <Label x={146} y={114} anchor="end" size={11}>
        TILE
      </Label>
      <Label x={146} y={130} anchor="end" size={9} dim>
        ONE PHOTO
      </Label>

      <Leader x1={iso(2.5, 2.5).x + 40} y1={iso(2.5, 2.5).y + 40} x2={iso(2.5, 2.5).x} y2={iso(2.5, 2.5).y} opacity={0.7} />
      <Label x={iso(2.5, 2.5).x + 46} y={iso(2.5, 2.5).y + 44} size={11}>
        WALL&nbsp;SURFACE
      </Label>

      {/* incoming-frame callouts */}
      <Leader x1={iso(3.5, 0).x + 70} y1={iso(3.5, 0).y - 86} x2={iso(3.5, 0.5).x + 4} y2={iso(3.5, 0.5).y - 78} opacity={0.7} />
      <Label x={iso(3.5, 0).x + 76} y={iso(3.5, 0).y - 90} size={11}>
        → WS&nbsp;STREAM
      </Label>
      <Label x={iso(3.5, 0).x + 76} y={iso(3.5, 0).y - 74} size={9} dim>
        LANDS LIVE
      </Label>

      <Leader x1={70} y1={iso(0, 2).y - 96} x2={iso(0.5, 2.5).x - 6} y2={iso(0.5, 2.5).y - 104} opacity={0.7} />
      <Label x={66} y={iso(0, 2).y - 100} anchor="end" size={10}>
        AUTHOR&nbsp;+&nbsp;TIME
      </Label>
    </svg>
  );
}
