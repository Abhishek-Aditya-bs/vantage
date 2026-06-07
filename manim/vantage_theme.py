"""
vantage_theme — the blueprint drawing kit for the Vantage marketing film.

Ports the on-site visual vocabulary (src/components/landing/figures/*) into Manim:
strict monochrome ink on the near-black plate, 1px hairlines, Geist Mono labels,
leader lines with arrowheads, dashed registration lines, 45° cross-hatch fills,
tick marks, the dot-grid plate, the ░ shade divider, the aperture mark.

No colour, ever — engineering-drawing ink, exactly like the website.
"""
from __future__ import annotations

import glob
import math
import os
import random

import manimpango
from manim import (
    BOLD,
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    Dot,
    Line,
    MarkupText,
    Polygon,
    RoundedRectangle,
    VGroup,
    VMobject,
)

# --------------------------------------------------------------------------- #
#  Palette — dark plate is the primary surface; light = its exact inverse,
#  matching src/index.css. Set VANTAGE_LIGHT=1 to render the white-paper cut.
# --------------------------------------------------------------------------- #
if os.environ.get("VANTAGE_LIGHT") == "1":
    BG = "#FAFAFA"    # oklch(0.98 0 0)   — white-paper plate
    INK = "#1C1C1C"   # oklch(0.17 0 0)   — near-black ink (foreground)
    DIM = "#5E5E5E"   # oklch(0.44 0 0)   — muted-foreground
    FAINT = "#BEBEBE" # hairline borders / dot-grid
    GHOST = "#D6D6D6" # the faintest construction lines
else:
    BG = "#0C0C0C"    # oklch(0.135 0 0)  — near-black plate
    INK = "#F3F3F3"   # oklch(0.955 0 0)  — near-white ink (foreground)
    DIM = "#9E9E9E"   # oklch(0.62 0 0)   — muted-foreground
    FAINT = "#5A5A5A" # hairline borders / dot-grid
    GHOST = "#3A3A3A" # the faintest construction lines

# Typeface families (registered below from manim/fonts/*.ttf)
F_DISPLAY = "Geist"
F_MONO = "Geist Mono"
F_SERIF = "EB Garamond"

_FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")


def register_fonts() -> None:
    """Register the self-hosted brand TTFs with Pango (idempotent)."""
    for path in sorted(glob.glob(os.path.join(_FONTS_DIR, "*.ttf"))):
        try:
            manimpango.register_font(path)
        except Exception:  # pragma: no cover - best effort
            pass


register_fonts()


# --------------------------------------------------------------------------- #
#  Type — monospace technical labels, display headings, serif body
# --------------------------------------------------------------------------- #
def mono(
    text: str,
    size: float = 20,
    color: str = INK,
    tracking: float = 0.22,
    opacity: float = 1.0,
    upper: bool = True,
) -> MarkupText:
    """A Geist Mono label, upper-cased and letter-spaced like the figure rails."""
    if upper:
        text = text.upper()
    # Pango letter_spacing is in 1024ths of a point; tracking is in em.
    ls = int(tracking * size * 1024 / 10)
    safe = (
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )
    m = MarkupText(
        f'<span letter_spacing="{ls}">{safe}</span>',
        font=F_MONO,
        font_size=size,
        color=color,
    )
    m.set_opacity(opacity)
    return m


def display(text: str, size: float = 64, color: str = INK, weight=BOLD) -> MarkupText:
    """Tight Geist display type for headlines."""
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return MarkupText(safe, font=F_DISPLAY, font_size=size, color=color, weight=weight)


def serif(text: str, size: float = 30, color: str = DIM) -> MarkupText:
    """Editorial EB Garamond body."""
    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return MarkupText(safe, font=F_SERIF, font_size=size, color=color)


# --------------------------------------------------------------------------- #
#  Hairline primitives — leader, registration line, tick, hatch
# --------------------------------------------------------------------------- #
def leader(start, end, color: str = INK, opacity: float = 0.7, head: float = 0.13,
           stroke: float = 1.4, dashed: bool = False) -> VGroup:
    """A leader line tipped with a small filled arrowhead (figures/primitives Leader)."""
    start = _p(start)
    end = _p(end)
    if dashed:
        from manim import DashedLine
        shaft = DashedLine(start, end, dash_length=0.07, dashed_ratio=0.55,
                           stroke_width=stroke, color=color)
    else:
        shaft = Line(start, end, stroke_width=stroke, color=color)
    # arrowhead
    ang = math.atan2(end[1] - start[1], end[0] - start[0])
    w = head * 0.62
    bx = end[0] - head * math.cos(ang)
    by = end[1] - head * math.sin(ang)
    p1 = [bx - w * math.sin(ang), by + w * math.cos(ang), 0]
    p2 = [bx + w * math.sin(ang), by - w * math.cos(ang), 0]
    tip = Polygon(end, p1, p2, color=color, fill_color=color, fill_opacity=1, stroke_width=0)
    g = VGroup(shaft, tip)
    g.set_opacity(opacity)
    return g


def reg(start, end, color: str = INK, opacity: float = 0.4, stroke: float = 1.0) -> VMobject:
    """Dashed registration / construction line (the exploded-view guide)."""
    from manim import DashedLine
    ln = DashedLine(_p(start), _p(end), dash_length=0.05, dashed_ratio=0.32,
                    stroke_width=stroke, color=color)
    ln.set_opacity(opacity)
    return ln


def tick(center, length: float = 0.12, color: str = INK, opacity: float = 0.6,
         stroke: float = 1.2, vertical: bool = True) -> Line:
    c = _p(center)
    if vertical:
        ln = Line(c + UP * length, c + DOWN * length, stroke_width=stroke, color=color)
    else:
        ln = Line(c + LEFT * length, c + RIGHT * length, stroke_width=stroke, color=color)
    ln.set_opacity(opacity)
    return ln


def hatch(width: float, height: float, gap: float = 0.12, angle_deg: float = 45,
          color: str = INK, opacity: float = 0.18, stroke: float = 0.8) -> VGroup:
    """45° cross-hatch fill clipped to a w×h rect centred at the origin."""
    a, b = width / 2, height / 2
    th = math.radians(angle_deg)
    dx, dy = math.cos(th), math.sin(th)        # line direction
    nx, ny = -math.sin(th), math.cos(th)       # normal
    half_span = a * abs(nx) + b * abs(ny)
    lines = []
    t = -half_span
    while t <= half_span + 1e-6:
        # clip the line {p : p·n = t} to the rect along direction d
        lo, hi = -1e9, 1e9
        # |t*nx + s*dx| <= a  and  |t*ny + s*dy| <= b
        for comp_n, comp_d, lim in ((nx, dx, a), (ny, dy, b)):
            base = t * comp_n
            if abs(comp_d) < 1e-9:
                if abs(base) > lim:
                    lo, hi = 1, -1  # empty
                    break
            else:
                s1 = (-lim - base) / comp_d
                s2 = (lim - base) / comp_d
                lo = max(lo, min(s1, s2))
                hi = min(hi, max(s1, s2))
        if hi - lo > 1e-4:
            p_start = [t * nx + lo * dx, t * ny + lo * dy, 0]
            p_end = [t * nx + hi * dx, t * ny + hi * dy, 0]
            lines.append(Line(p_start, p_end, stroke_width=stroke, color=color))
        t += gap
    g = VGroup(*lines)
    g.set_opacity(opacity)
    return g


# --------------------------------------------------------------------------- #
#  Plate furniture — dot grid, shade divider, corner registration marks
# --------------------------------------------------------------------------- #
def dot_grid(width: float = 15.0, height: float = 9.0, gap: float = 0.5,
             color: str = FAINT, radius: float = 0.012, opacity: float = 0.55) -> VGroup:
    """The graph-paper dot-grid plate behind every figure."""
    dots = []
    nx = int(width / gap)
    ny = int(height / gap)
    for i in range(-nx // 2, nx // 2 + 1):
        for j in range(-ny // 2, ny // 2 + 1):
            dots.append(Dot([i * gap, j * gap, 0], radius=radius, color=color))
    g = VGroup(*dots)
    g.set_opacity(opacity)
    return g


def shade_divider(width: float = 13.0, color: str = GHOST, opacity: float = 0.6) -> MarkupText:
    """The signature ░ ruled row used between sections."""
    n = int(width / 0.11)
    m = MarkupText("░" * n, font=F_MONO, font_size=14, color=color)
    m.set_opacity(opacity)
    if m.width > width:
        m.scale_to_fit_width(width)
    return m


def corner_marks(width: float, height: float, size: float = 0.18,
                 color: str = DIM, opacity: float = 0.55, stroke: float = 1.2) -> VGroup:
    """Four L-shaped registration crops at the corners of a w×h frame."""
    a, b = width / 2, height / 2
    g = VGroup()
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * a, sy * b
            h = Line([cx, cy, 0], [cx - sx * size, cy, 0], stroke_width=stroke, color=color)
            v = Line([cx, cy, 0], [cx, cy - sy * size, 0], stroke_width=stroke, color=color)
            g.add(h, v)
    g.set_opacity(opacity)
    return g


# --------------------------------------------------------------------------- #
#  The aperture mark (src/components/brand/Mascot.tsx) — hex housing + 6 blades
# --------------------------------------------------------------------------- #
def aperture_mark(radius: float = 1.0, color: str = INK, stroke: float = 2.0) -> VGroup:
    """The Vantage mark: pointy-top hex lens housing, six swept iris blades, focal dot."""
    r_hex = radius
    r_out = radius * 0.85
    r_in = radius * 0.35
    sweep = 34  # degrees

    def pt(r, deg):
        a = math.radians(deg)
        return [r * math.cos(a), r * math.sin(a), 0]

    hex_pts = [pt(r_hex, -90 + i * 60) for i in range(6)]
    housing = Polygon(*hex_pts, color=color, stroke_width=stroke, fill_opacity=0)

    blades = VGroup()
    for i in range(6):
        a = -90 + i * 60
        blades.add(Line(pt(r_out, a), pt(r_in, a + sweep), color=color, stroke_width=stroke * 0.92))

    focal = Dot(ORIGIN, radius=radius * 0.07, color=color)
    return VGroup(housing, blades, focal)


# --------------------------------------------------------------------------- #
#  Iris / aperture countdown (src/components/brand/IrisShutter.tsx)
# --------------------------------------------------------------------------- #
def iris(open_amt: float, radius: float = 1.0, color: str = INK, blades: int = 6,
         stroke: float = 1.2) -> VGroup:
    """Six aperture blades; open_amt 1→wide hole, 0→shut (the Moment countdown)."""
    r_out = radius
    r_in = radius * 0.14 + open_amt * radius * 0.74
    half = math.pi / blades
    g = VGroup()
    for i in range(blades):
        a0, a1 = -half, half
        inner_a = a0 + half * 0.5
        po0 = [r_out * math.cos(a0), r_out * math.sin(a0), 0]
        po1 = [r_out * math.cos(a1), r_out * math.sin(a1), 0]
        pi_ = [r_in * math.cos(inner_a), r_in * math.sin(inner_a), 0]
        blade = Polygon(po0, po1, pi_, color=color, fill_color=color,
                        fill_opacity=0.85 - (i % 2) * 0.16, stroke_width=stroke)
        blade.rotate((2 * math.pi / blades) * i, about_point=ORIGIN)
        g.add(blade)
    return g


# --------------------------------------------------------------------------- #
#  Photo tile (live wall / moment artifact / recap frame)
# --------------------------------------------------------------------------- #
def tile(size: float = 1.0, color: str = INK, hatched: bool = True, tag: bool = True,
         ghost: bool = False, stroke: float = 1.3) -> VGroup:
    """One photo as a blueprint tile: hatched square, author dot, timestamp tick."""
    from manim import DashedVMobject, Square
    sq = Square(side_length=size, color=color,
                stroke_width=(1.0 if ghost else stroke), fill_opacity=0)
    if ghost:
        ring = DashedVMobject(sq, num_dashes=28, dashed_ratio=0.5)
        ring.set_stroke(color, 1.0, opacity=0.5)
        return VGroup(ring)
    g = VGroup(sq)
    if hatched:
        g.add(hatch(size * 0.94, size * 0.94, gap=size * 0.14, opacity=0.14,
                    stroke=0.7, color=color))
    if tag:
        ax = -size / 2 + size * 0.18
        ay = -size / 2 + size * 0.18
        g.add(Dot([ax, ay, 0], radius=size * 0.05, color=color))
        g.add(Line([ax + size * 0.12, ay, 0], [ax + size * 0.42, ay, 0],
                   stroke_width=1.1, color=color).set_opacity(0.55))
    return g


# --------------------------------------------------------------------------- #
#  Phone (src/components/landing/figures/FigSyncCapture.tsx Phone)
# --------------------------------------------------------------------------- #
def phone(height: float = 2.2, color: str = INK, screen_hatch: bool = True,
          label: str | None = None) -> VGroup:
    """A blueprint phone: rounded body, hatched screen, notch, lens, side key."""
    w = height * 0.55
    h = height
    body = RoundedRectangle(width=w, height=h, corner_radius=w * 0.16,
                            color=color, stroke_width=1.8, fill_opacity=0)
    screen = RoundedRectangle(width=w - 0.18, height=h - 0.34, corner_radius=w * 0.08,
                              color=color, stroke_width=1.0, fill_opacity=0)
    g = VGroup(body, screen)
    if screen_hatch:
        hh = hatch(w - 0.18, h - 0.34, gap=0.16, opacity=0.14, stroke=0.7, color=color)
        g.add(hh)
    # notch
    notch = Line([-0.14, h / 2 - 0.14, 0], [0.14, h / 2 - 0.14, 0],
                 stroke_width=2.2, color=color)
    # lens (bottom, faces subject)
    lens_y = -h / 2 + 0.18
    lens_o = Dot([0, lens_y, 0], radius=0.11, color=color, fill_opacity=0).set_stroke(color, 1.2)
    lens_i = Dot([0, lens_y, 0], radius=0.045, color=color, fill_opacity=0).set_stroke(color, 1.0)
    # side shutter key
    key = Line([w / 2, 0.14, 0], [w / 2, -0.14, 0], stroke_width=2.6, color=color)
    g.add(notch, lens_o, lens_i, key)
    if label:
        g.add(mono(label, size=15, color=color, tracking=0.1).move_to(ORIGIN))
    g.set_z_index(2)
    return g


# --------------------------------------------------------------------------- #
#  Stylised QR matrix (engineering-drawing version of qrcode.react)
# --------------------------------------------------------------------------- #
def qr_code(size: float = 1.6, modules: int = 17, seed: int = 7, color: str = INK) -> VGroup:
    """A stylised QR: three finder eyes + a deterministic module field."""
    rng = random.Random(seed)
    cell = size / modules
    g = VGroup()

    def filled(i, j):
        x = -size / 2 + (i + 0.5) * cell
        y = size / 2 - (j + 0.5) * cell
        return Polygon(
            [x - cell / 2, y - cell / 2, 0], [x + cell / 2, y - cell / 2, 0],
            [x + cell / 2, y + cell / 2, 0], [x - cell / 2, y + cell / 2, 0],
            color=color, fill_color=color, fill_opacity=1, stroke_width=0,
        )

    def in_finder(i, j):
        for (fi, fj) in ((0, 0), (modules - 7, 0), (0, modules - 7)):
            if fi <= i < fi + 7 and fj <= j < fj + 7:
                return True
        return False

    # module field
    for i in range(modules):
        for j in range(modules):
            if in_finder(i, j):
                continue
            if rng.random() < 0.42:
                g.add(filled(i, j))

    # finder eyes (7x7 ring + 3x3 core)
    for (fi, fj) in ((0, 0), (modules - 7, 0), (0, modules - 7)):
        for i in range(7):
            for j in range(7):
                edge = i in (0, 6) or j in (0, 6)
                core = 2 <= i <= 4 and 2 <= j <= 4
                if edge or core:
                    g.add(filled(fi + i, fj + j))
    return g


# --------------------------------------------------------------------------- #
def _p(v):
    """Coerce a 2/3-tuple to a 3D point."""
    if len(v) == 2:
        return [v[0], v[1], 0]
    return list(v)
