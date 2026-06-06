/**
 * FIG_001 — SYNCHRONIZED CAPTURE
 * Three phones, fanned at different angles, all sight the same point; every
 * shutter fires at one server instant (T0). The diagram unifies the two ideas:
 * angles converge in space (sightlines) and in time (the clock axis below).
 */
import { Label, Leader, Reg, Hatch, Tick, INK } from "./primitives";

const VB_W = 760;
const VB_H = 470;

/** Bottom-centre (lens) point of a phone after it is rotated `tilt°`. */
function lensPoint(cx: number, cy: number, tilt: number, h: number) {
  const t = (tilt * Math.PI) / 180;
  return { x: cx - (h / 2) * Math.sin(t), y: cy + (h / 2) * Math.cos(t) };
}

function Phone({
  cx,
  cy,
  tilt,
  label,
  detail = false,
}: {
  cx: number;
  cy: number;
  tilt: number;
  label: string;
  detail?: boolean;
}) {
  const w = 66;
  const h = 120;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`} stroke={INK} fill="none">
      {/* body */}
      <rect x={x} y={y} width={w} height={h} rx={11} strokeWidth={1.4} />
      {/* screen */}
      <rect x={x + 6} y={y + 10} width={w - 12} height={h - 20} rx={5} strokeWidth={1} fill="url(#sc-hatch)" />
      {/* speaker / notch */}
      <line x1={cx - 9} y1={y + 5} x2={cx + 9} y2={y + 5} strokeWidth={2} strokeLinecap="round" />
      {/* lens (faces the subject) */}
      <circle cx={cx} cy={y + h - 9} r={6.5} strokeWidth={1.2} />
      <circle cx={cx} cy={y + h - 9} r={2.6} strokeWidth={1} />
      {/* side shutter key */}
      <line x1={x + w} y1={cy - 8} x2={x + w} y2={cy + 8} strokeWidth={2.4} strokeLinecap="round" />
      {/* angle tag inside */}
      <text
        x={cx}
        y={cy + 2}
        fill={INK}
        stroke="none"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing={1}
        textAnchor="middle"
        dominantBaseline="middle"
        opacity={0.8}
      >
        {label}
      </text>
      {detail && (
        <>
          {/* internal callout anchors used by leaders (in local space) */}
        </>
      )}
    </g>
  );
}

export function FigSyncCapture() {
  // subject / convergence node — the single instant
  const N = { x: VB_W / 2, y: 300 };
  const phones = [
    { cx: 156, cy: 96, tilt: -14, label: "A" },
    { cx: 380, cy: 74, tilt: 0, label: "B" },
    { cx: 604, cy: 96, tilt: 14, label: "C" },
  ];
  const axisY = 432;
  const axisX0 = 150;
  const axisX1 = 610;
  const t0x = N.x; // T0 sits directly under the convergence node

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" className="block h-auto w-full text-foreground">
      <defs>
        <Hatch id="sc-hatch" gap={6} opacity={0.18} />
      </defs>

      {/* sightlines: each lens → the single instant */}
      {phones.map((p) => {
        const L = lensPoint(p.cx, p.cy, p.tilt, 120);
        return <Leader key={`s${p.label}`} x1={L.x} y1={L.y} x2={N.x} y2={N.y - 22} dashed opacity={0.5} head={7} />;
      })}

      {/* phones */}
      {phones.map((p) => (
        <Phone key={p.label} cx={p.cx} cy={p.cy} tilt={p.tilt} label={p.label} detail={p.label === "C"} />
      ))}

      {/* angle labels */}
      <Label x={156} y={172} anchor="middle" size={11} dim>
        ANGLE&nbsp;A
      </Label>
      <Label x={380} y={150} anchor="middle" size={11} dim>
        ANGLE&nbsp;B
      </Label>
      <Label x={604} y={172} anchor="middle" size={11} dim>
        ANGLE&nbsp;C
      </Label>

      {/* callouts on phone C */}
      <Leader x1={690} y1={70} x2={636} y2={150} head={6} opacity={0.7} />
      <Label x={694} y={70} size={10}>
        SHUTTER
      </Label>
      <Leader x1={690} y1={132} x2={612} y2={150} head={6} opacity={0.7} />
      <Label x={694} y={132} size={10}>
        LENS
      </Label>

      {/* the convergence node — ONE INSTANT */}
      <g stroke={INK} fill="none">
        <circle cx={N.x} cy={N.y} r={30} strokeWidth={1} opacity={0.35} strokeDasharray="3 4" />
        <circle cx={N.x} cy={N.y} r={15} strokeWidth={1.4} />
        <circle cx={N.x} cy={N.y} r={3} fill={INK} stroke="none" />
        <line x1={N.x - 26} y1={N.y} x2={N.x - 18} y2={N.y} strokeWidth={1} />
        <line x1={N.x + 18} y1={N.y} x2={N.x + 26} y2={N.y} strokeWidth={1} />
        <line x1={N.x} y1={N.y - 26} x2={N.x} y2={N.y - 18} strokeWidth={1} />
        <line x1={N.x} y1={N.y + 18} x2={N.x} y2={N.y + 26} strokeWidth={1} />
      </g>
      <Leader x1={N.x + 96} y1={N.y - 6} x2={N.x + 32} y2={N.y - 6} head={6} opacity={0.7} />
      <Label x={N.x + 100} y={N.y - 12} size={11}>
        ONE&nbsp;INSTANT
      </Label>
      <Label x={N.x + 100} y={N.y + 4} size={9} dim>
        T0 · ALL ANGLES
      </Label>
      <Leader x1={N.x - 96} y1={N.y + 6} x2={N.x - 32} y2={N.y + 6} head={6} opacity={0.7} />
      <Label x={N.x - 100} y={N.y} anchor="end" size={11}>
        SUBJECT
      </Label>

      {/* drop from the instant down to the clock axis */}
      <Reg x1={N.x} y1={N.y + 30} x2={t0x} y2={axisY - 10} opacity={0.5} />

      {/* clock / server-time axis */}
      <g>
        <line x1={axisX0} y1={axisY} x2={axisX1} y2={axisY} stroke={INK} strokeWidth={1.2} />
        {Array.from({ length: 11 }).map((_, i) => {
          const x = axisX0 + ((axisX1 - axisX0) / 10) * i;
          return <Tick key={i} x={x} y={axisY} len={x === t0x ? 8 : 4} opacity={x === t0x ? 0.9 : 0.45} />;
        })}
        {/* the three shutters all land exactly on T0 */}
        <circle cx={t0x} cy={axisY - 8} r={3} fill={INK} stroke="none" />
        <Label x={t0x} y={axisY + 20} anchor="middle" size={11}>
          T0
        </Label>
        <Label x={axisX0 - 6} y={axisY} anchor="end" size={11} dim>
          T
        </Label>
        <Label x={axisX1 + 6} y={axisY} anchor="start" size={9} dim>
          SERVER&nbsp;CLOCK
        </Label>
      </g>

      {/* sync annotation */}
      <Label x={axisX0} y={axisY - 22} size={10} dim>
        Δt = 0 · CLOCKS SYNCED OVER THE SOCKET
      </Label>
    </svg>
  );
}
