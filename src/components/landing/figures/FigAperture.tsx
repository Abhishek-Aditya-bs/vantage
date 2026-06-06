/**
 * FIG_003 — THE MOMENT MECHANISM (exploded)
 * The iris/aperture rendered as an exploded mechanical stack — lens ring, six
 * iris blades, the T-minus countdown ring, and the sensor plane — floated apart
 * on dashed registration lines, like a patent drawing of a shutter assembly.
 */
import { Label, Leader, Reg, Hatch, INK } from "./primitives";

const VB_W = 600;
const VB_H = 600;
const CX = 270;
const RX = 132;
const RY = 46;

function pt(cx: number, cy: number, rx: number, ry: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
}

/** A floated disk (tilted ellipse). */
function Disk({ cy, children }: { cy: number; children?: React.ReactNode }) {
  return (
    <g stroke={INK} fill="none">
      <ellipse cx={CX} cy={cy} rx={RX} ry={RY} strokeWidth={1.4} />
      {children}
    </g>
  );
}

export function FigAperture() {
  const layers = { lens: 92, iris: 232, count: 372, sensor: 512 };

  // iris hexagon opening + blades
  const hexR = 52;
  const hexRy = (hexR * RY) / RX;
  const hex = Array.from({ length: 6 }, (_, i) => pt(CX, layers.iris, hexR, hexRy, i * 60 - 30));

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" className="block h-auto w-full text-foreground">
      <defs>
        <Hatch id="ap-hatch" gap={6} opacity={0.2} />
      </defs>

      {/* registration lines threading the whole stack */}
      <Reg x1={CX - RX} y1={layers.lens} x2={CX - RX} y2={layers.sensor} opacity={0.35} />
      <Reg x1={CX + RX} y1={layers.lens} x2={CX + RX} y2={layers.sensor} opacity={0.35} />

      {/* 1 — lens ring */}
      <Disk cy={layers.lens}>
        <ellipse cx={CX} cy={layers.lens} rx={RX - 22} ry={RY - 8} strokeWidth={1} opacity={0.7} />
        <ellipse cx={CX} cy={layers.lens} rx={RX - 40} ry={RY - 15} strokeWidth={1} opacity={0.45} />
      </Disk>
      <Leader x1={CX + RX + 86} y1={layers.lens - 10} x2={CX + RX - 6} y2={layers.lens - 14} opacity={0.7} />
      <Label x={CX + RX + 92} y={layers.lens - 14} size={11}>
        LENS&nbsp;RING
      </Label>

      {/* 2 — iris blades */}
      <Disk cy={layers.iris}>
        {/* opening */}
        <polygon
          points={hex.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          strokeWidth={1.3}
          fill="url(#ap-hatch)"
        />
        {/* blades: each hex edge sweeps out to the rim */}
        {hex.map((p, i) => {
          const rim = pt(CX, layers.iris, RX - 6, RY - 2, i * 60 - 30 + 8);
          return <line key={i} x1={p.x} y1={p.y} x2={rim.x} y2={rim.y} strokeWidth={1} opacity={0.75} />;
        })}
      </Disk>
      <Leader x1={CX + RX + 86} y1={layers.iris - 6} x2={CX + 30} y2={layers.iris - 6} opacity={0.7} />
      <Label x={CX + RX + 92} y={layers.iris - 10} size={11}>
        IRIS · 6 BLADES
      </Label>
      <Leader x1={CX - RX - 30} y1={layers.iris + 28} x2={hex[3].x - 4} y2={hex[3].y} opacity={0.7} />
      <Label x={CX - RX - 36} y={layers.iris + 30} anchor="end" size={10}>
        APERTURE
      </Label>

      {/* 3 — T-minus countdown ring */}
      <Disk cy={layers.count}>
        {Array.from({ length: 24 }).map((_, i) => {
          const a = i * 15;
          const o = pt(CX, layers.count, RX - 4, RY - 1, a);
          const inn = pt(CX, layers.count, RX - 16, RY - 6, a);
          const big = i % 8 === 0;
          return (
            <line
              key={i}
              x1={inn.x}
              y1={inn.y}
              x2={o.x}
              y2={o.y}
              strokeWidth={big ? 1.6 : 1}
              opacity={big ? 0.9 : 0.45}
            />
          );
        })}
        {/* 3·2·1 markers */}
        {[
          { d: 210, n: "3" },
          { d: 270, n: "2" },
          { d: 330, n: "1" },
        ].map(({ d, n }) => {
          const o = pt(CX, layers.count, RX - 30, RY - 11, d);
          return (
            <text
              key={n}
              x={o.x}
              y={o.y}
              fill={INK}
              stroke="none"
              fontFamily="var(--font-mono)"
              fontSize={11}
              textAnchor="middle"
              dominantBaseline="middle"
              opacity={0.85}
            >
              {n}
            </text>
          );
        })}
      </Disk>
      <Leader x1={CX + RX + 86} y1={layers.count - 4} x2={CX + RX - 8} y2={layers.count - 6} opacity={0.7} />
      <Label x={CX + RX + 92} y={layers.count - 8} size={11}>
        COUNTDOWN&nbsp;RING
      </Label>
      <Label x={CX + RX + 92} y={layers.count + 8} size={9} dim>
        T-3 · 2 · 1
      </Label>

      {/* 4 — sensor plane */}
      <Disk cy={layers.sensor}>
        <ellipse cx={CX} cy={layers.sensor} rx={RX - 30} ry={RY - 12} strokeWidth={1} fill="url(#ap-hatch)" />
        <circle cx={CX} cy={layers.sensor} r={4} fill={INK} stroke="none" />
      </Disk>
      <Leader x1={CX - RX - 30} y1={layers.sensor + 16} x2={CX - 30} y2={layers.sensor + 6} opacity={0.7} />
      <Label x={CX - RX - 36} y={layers.sensor + 18} anchor="end" size={11}>
        SENSOR&nbsp;PLANE
      </Label>
      <Leader x1={CX + RX + 86} y1={layers.sensor + 6} x2={CX + RX - 30} y2={layers.sensor + 4} opacity={0.7} />
      <Label x={CX + RX + 92} y={layers.sensor + 2} size={11}>
        CAPTURE
      </Label>
    </svg>
  );
}
