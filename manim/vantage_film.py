"""
Vantage — the marketing film.

A ~55-second engineering-drawing animation for the landing page, built in the
same strict-monochrome "technical reference manual" language as the site's
blueprint figures. Six plates:

    INTRO       the aperture mark assembles → wordmark
    FIG_001     JOIN          — scan a QR, the room joins
    FIG_002     THE LIVE WALL — photos stream in, live
    FIG_003     THE MOMENT    — three angles, one synchronized instant
    FIG_004     THE RECAP REEL— vertical story-format playback
    OUTRO       call to action

Render (1080p):
    cd manim && ../.manim-venv/bin/manim -qh vantage_film.py VantageFilm
"""
from __future__ import annotations

import math

from manim import (
    AnimationGroup,
    Circle,
    Create,
    DOWN,
    DashedLine,
    FadeIn,
    FadeOut,
    Flash,
    GrowFromCenter,
    Indicate,
    LEFT,
    LaggedStart,
    Line,
    ORIGIN,
    RIGHT,
    Rectangle,
    Rotate,
    Scene,
    Transform,
    UP,
    VGroup,
    Write,
    config,
    rate_functions as rf,
)

from vantage_theme import (
    BG, INK, DIM, FAINT, GHOST,
    F_DISPLAY,
    aperture_mark, corner_marks, display, dot_grid, iris, leader, mono,
    phone, qr_code, reg, serif, shade_divider, tick, tile,
)

config.background_color = BG

EASE = rf.ease_out_expo          # ≈ the site's cubic-bezier(0.22,1,0.36,1)
FRAME_W, FRAME_H = 13.7, 7.3     # inner plate frame (inside corner crops)


class VantageFilm(Scene):
    # ----------------------------------------------------------------- setup
    def construct(self):
        self.grid = dot_grid(opacity=0.0)
        self.crops = corner_marks(FRAME_W, FRAME_H, opacity=0.0)
        self.add(self.grid, self.crops)
        self.cur_rails = VGroup()
        self.header = None

        self.play(
            self.grid.animate.set_opacity(0.5),
            self.crops.animate.set_opacity(0.5),
            run_time=1.0,
        )

        self.intro()
        self.chapter_join()
        self.chapter_live_wall()
        self.chapter_moment()
        self.chapter_recap()
        self.outro()

    # ------------------------------------------------------------- furniture
    def rails(self, fig: str, caption: str) -> VGroup:
        """Left FIG rail + right [caption] / (c) rail, like BlueprintFigure."""
        left = mono(fig, size=15, color=DIM, tracking=0.25).rotate(math.pi / 2)
        left.to_edge(LEFT, buff=0.28)
        rcap = mono(f"[ {caption} ]", size=14, color=DIM, tracking=0.2).rotate(-math.pi / 2)
        rcap.to_edge(RIGHT, buff=0.30).shift(UP * 1.4)
        rcopy = mono("(c) 2026", size=12, color=GHOST, tracking=0.18).rotate(-math.pi / 2)
        rcopy.to_edge(RIGHT, buff=0.30).shift(DOWN * 2.0)
        return VGroup(left, rcap, rcopy)

    def swap_rails(self, fig: str, caption: str):
        new = self.rails(fig, caption)
        if len(self.cur_rails):
            self.play(FadeOut(self.cur_rails, run_time=0.35),
                      FadeIn(new, run_time=0.45))
        else:
            self.play(FadeIn(new, run_time=0.5))
        self.cur_rails = new

    def build_header(self):
        mark = aperture_mark(0.22, stroke=1.5)
        word = display("Vantage", size=24).next_to(mark, RIGHT, buff=0.22)
        self.header = VGroup(mark, word)
        self.header.to_corner(UP + LEFT, buff=0.5)

    # ----------------------------------------------------------------- INTRO
    def intro(self):
        mark = aperture_mark(1.25, stroke=2.4).move_to([0, 0.35, 0])
        housing, blades, focal = mark

        from manim import DashedVMobject
        recticle = DashedVMobject(Circle(radius=1.7, stroke_width=1, color=INK),
                                  num_dashes=44, dashed_ratio=0.45)
        recticle.move_to(mark.get_center()).set_opacity(0.3)

        blades.save_state()
        blades.rotate(-math.pi / 3, about_point=mark.get_center()).scale(0.2, about_point=mark.get_center())
        blades.set_opacity(0)

        self.play(Create(housing, run_time=1.0, rate_func=EASE))
        self.play(
            blades.animate.restore(),
            GrowFromCenter(focal),
            run_time=1.1, rate_func=EASE,
        )
        self.play(Create(recticle, run_time=0.8), Flash(focal.get_center(), color=INK,
                  line_length=0.18, num_lines=12, flash_radius=0.5, run_time=0.8))

        eyebrow = mono("MULTI-ANGLE CAPTURE · UP TO 50 PHONES · REAL-TIME",
                       size=19, color=DIM, tracking=0.24)
        title = display("Every phone. One instant.", size=58)
        sub = serif("Turn a room full of phones into one synchronized camera.",
                    size=27, color=DIM)

        block = VGroup(eyebrow, title, sub).arrange(DOWN, buff=0.34)
        block.move_to([0, -1.7, 0])

        self.play(
            mark.animate.scale(0.62).move_to([0, 1.55, 0]),
            recticle.animate.scale(0.62).move_to([0, 1.55, 0]).set_opacity(0.22),
            run_time=0.9, rate_func=EASE,
        )
        self.play(FadeIn(eyebrow, shift=UP * 0.2, run_time=0.6))
        self.play(Write(title, run_time=1.1))
        self.play(FadeIn(sub, shift=UP * 0.2, run_time=0.7))
        self.wait(1.2)

        # collapse the intro; the mark flies to the header position
        self.build_header()
        self.play(
            FadeOut(VGroup(eyebrow, title, sub, recticle), run_time=0.6),
            Transform(mark, self.header[0], run_time=0.9, rate_func=EASE),
            FadeIn(self.header[1], shift=LEFT * 0.2, run_time=0.7),
        )
        self.remove(mark)
        self.add(self.header)

    # ------------------------------------------------------------ FIG_001 JOIN
    def chapter_join(self):
        self.swap_rails("FIG_001", "JOIN")

        heading = display("Scan. Name. Shoot.", size=40).move_to([0, 3.0, 0])
        self.play(Write(heading, run_time=0.8))

        host = phone(2.7).move_to([-3.6, -0.3, 0])
        qr = qr_code(1.2, modules=17, seed=11).move_to(host.get_center())
        self.play(Create(host, run_time=0.9, rate_func=EASE))
        self.play(LaggedStart(*[FadeIn(m, scale=0.6) for m in qr],
                              lag_ratio=0.004, run_time=0.9))

        l1 = leader([-2.2, 1.0, 0], host.get_center() + UP * 0.55)
        c1 = mono("QR / LINK", size=16, color=INK, tracking=0.16).next_to(l1[0].get_start(), UP, buff=0.12)
        l2 = leader([-2.2, -1.3, 0], host.get_center() + DOWN * 0.95)
        c2 = mono("NO APP · NO ACCOUNT", size=14, color=DIM, tracking=0.14).next_to(
            l2[0].get_start(), DOWN, buff=0.12)
        self.play(Create(l1), FadeIn(c1), run_time=0.5)
        self.play(Create(l2), FadeIn(c2), run_time=0.5)

        # the room joins — guest phones fan in, linked by dashed arcs
        guests = VGroup(
            phone(1.5).move_to([1.7, 1.5, 0]).rotate(math.radians(-8)),
            phone(1.5).move_to([4.2, 0.9, 0]).rotate(math.radians(7)),
            phone(1.5).move_to([2.4, -1.6, 0]).rotate(math.radians(5)),
            phone(1.5).move_to([4.8, -1.7, 0]).rotate(math.radians(-6)),
        )
        links = VGroup(*[
            reg(host.get_center() + RIGHT * 0.7, g.get_center(), opacity=0.4) for g in guests
        ])
        counter = mono("PHONES  01 → 05", size=18, color=DIM, tracking=0.2).move_to([3.2, 2.4, 0])

        self.play(
            LaggedStart(*[AnimationGroup(Create(lk), FadeIn(g, scale=0.7))
                          for lk, g in zip(links, guests)],
                        lag_ratio=0.25, run_time=1.8),
            FadeIn(counter, run_time=0.6),
        )
        self.wait(0.8)

        self.play(FadeOut(VGroup(heading, host, qr, l1, c1, l2, c2, guests, links, counter),
                          run_time=0.6))

    # -------------------------------------------------------- FIG_002 LIVE WALL
    def chapter_live_wall(self):
        self.swap_rails("FIG_002", "THE LIVE WALL")

        heading = display("A contact sheet that fills itself.", size=34).move_to([0, 3.05, 0])
        self.play(Write(heading, run_time=0.8))

        cols, rows = 5, 3
        s = 1.25
        gap = 0.16
        gx = (cols - 1) * (s + gap) / 2
        gy = (rows - 1) * (s + gap) / 2
        slots = []
        for j in range(rows):
            for i in range(cols):
                x = -gx + i * (s + gap)
                y = 0.55 + gy - j * (s + gap)
                slots.append([x, y, 0])

        # faint empty lattice first
        ghosts = VGroup(*[tile(s, ghost=True).move_to(p) for p in slots])
        self.play(LaggedStart(*[FadeIn(g) for g in ghosts], lag_ratio=0.03, run_time=0.8))

        # photos land, staggered (two of them drop from above on reg lines)
        order = [0, 6, 2, 8, 11, 4, 13, 1, 9, 5, 12, 3, 10, 7, 14]
        drops = {3, 9}
        anims = []
        tiles = []
        for idx in order:
            t = tile(s).move_to(slots[idx])
            if idx in drops:
                rl = reg(slots[idx], [slots[idx][0], slots[idx][1] + 1.6, 0], opacity=0.4)
                t.shift(UP * 1.6).set_opacity(0)
                self.add(t)
                anims.append(AnimationGroup(FadeIn(rl),
                                            t.animate.shift(DOWN * 1.6).set_opacity(1)))
                tiles.extend([t, rl])
            else:
                tiles.append(t)
                anims.append(GrowFromCenter(t))

        counter = mono("PHOTOS  00 → 15", size=18, color=DIM, tracking=0.2).move_to([-4.4, 2.35, 0])
        lbl = mono("→ WS STREAM · LANDS LIVE", size=16, color=INK, tracking=0.16)
        ll = leader([4.4, -1.9, 0], slots[12][:2] + [0])
        lbl.next_to(ll[0].get_start(), DOWN, buff=0.1)

        self.play(FadeIn(counter), run_time=0.4)
        self.play(LaggedStart(*anims, lag_ratio=0.14, run_time=3.2))
        self.play(Create(ll), FadeIn(lbl), run_time=0.6)
        self.wait(0.6)

        self.play(FadeOut(VGroup(heading, ghosts, *tiles, counter, ll, lbl),
                          run_time=0.6))

    # ---------------------------------------------------------- FIG_003 MOMENT
    def chapter_moment(self):
        self.swap_rails("FIG_003", "THE MOMENT")

        heading = display("Fire one synchronized shutter.", size=34).move_to([0, 3.1, 0])
        self.play(Write(heading, run_time=0.8))

        # three phones fanned across the top
        specs = [(-4.0, -15, "A"), (0.0, 0, "B"), (4.0, 15, "C")]
        phones = []
        lens_pts = []
        for x, ang, lbl in specs:
            ph = phone(1.7, label=lbl).rotate(math.radians(ang)).move_to([x, 1.95, 0])
            phones.append(ph)
            d = 1.7 / 2 - 0.18
            th = math.radians(ang)
            lens_pts.append([x + d * math.sin(th), 1.95 - d * math.cos(th), 0])
        pg = VGroup(*phones)
        self.play(LaggedStart(*[FadeIn(p, scale=0.7) for p in pg], lag_ratio=0.18, run_time=1.1))

        anglbls = VGroup(*[
            mono(f"ANGLE {lbl}", size=14, color=DIM, tracking=0.18).move_to([x, 0.78, 0])
            for (x, _, lbl) in specs
        ])
        self.play(FadeIn(anglbls, run_time=0.4))

        # subject convergence reticle
        N = [0, -1.55, 0]
        from manim import DashedVMobject
        outer = DashedVMobject(Circle(radius=0.62, stroke_width=1, color=INK),
                               num_dashes=22, dashed_ratio=0.5).move_to(N).set_opacity(0.5)
        inner = Circle(radius=0.3, stroke_width=1.5, color=INK).move_to(N)
        center = Circle(radius=0.05, color=INK, fill_opacity=1).move_to(N)
        cross = VGroup(
            Line([N[0] - 0.5, N[1], 0], [N[0] - 0.38, N[1], 0], stroke_width=1, color=INK),
            Line([N[0] + 0.38, N[1], 0], [N[0] + 0.5, N[1], 0], stroke_width=1, color=INK),
            Line([N[0], N[1] - 0.5, 0], [N[0], N[1] - 0.38, 0], stroke_width=1, color=INK),
            Line([N[0], N[1] + 0.38, 0], [N[0], N[1] + 0.5, 0], stroke_width=1, color=INK),
        )
        reticle = VGroup(outer, inner, center, cross)
        subj_l = leader([-2.0, -1.55, 0], [N[0] - 0.66, N[1], 0])
        subj_t = mono("SUBJECT", size=14, color=INK, tracking=0.16).next_to(subj_l[0].get_start(), LEFT, buff=0.1)
        self.play(Create(reticle, run_time=0.7), Create(subj_l), FadeIn(subj_t), run_time=0.7)

        # sightlines: each lens → subject
        sights = VGroup(*[reg(lp, [N[0], N[1] + 0.66, 0], opacity=0.55) for lp in lens_pts])
        self.play(LaggedStart(*[Create(s) for s in sights], lag_ratio=0.15, run_time=0.9))

        # clock / server-time axis
        ax_y = -3.0
        axis = Line([-4.2, ax_y, 0], [4.2, ax_y, 0], stroke_width=1.4, color=INK)
        ticks = VGroup()
        for i in range(11):
            tx = -4.0 + i * 0.8
            big = (i == 5)
            ticks.add(tick([tx, ax_y, 0], length=0.13 if big else 0.07,
                           opacity=0.9 if big else 0.4))
        t0_dot = Circle(radius=0.05, color=INK, fill_opacity=1).move_to([0, ax_y + 0.13, 0])
        t0_lbl = mono("T0", size=16, color=INK, tracking=0.14).move_to([0, ax_y - 0.32, 0])
        clk_lbl = mono("SERVER CLOCK", size=12, color=DIM, tracking=0.16).next_to([4.2, ax_y, 0], RIGHT, buff=0.12)
        sync_lbl = mono("Δt = 0 · CLOCKS SYNCED OVER THE SOCKET", size=13, color=DIM,
                        tracking=0.14).move_to([-1.4, ax_y + 0.45, 0])
        drop = reg([N[0], N[1] - 0.62, 0], [0, ax_y + 0.13, 0], opacity=0.5)
        self.play(Create(axis), LaggedStart(*[Create(t) for t in ticks], lag_ratio=0.03),
                  run_time=0.9)
        self.play(FadeIn(clk_lbl), FadeIn(sync_lbl), Create(drop), run_time=0.5)

        # ---- the countdown (iris closing over the subject) ----
        cd_center = [0, -1.55, 0]
        ap = iris(0.85, radius=0.62).move_to(cd_center)
        rim = Circle(radius=0.66, stroke_width=1.2, color=DIM).move_to(cd_center)
        digit = display("3", size=40).move_to(cd_center)
        tminus = mono("T-MINUS", size=13, color=DIM, tracking=0.2).move_to([0, -0.55, 0])
        self.play(FadeOut(reticle), FadeIn(rim), FadeIn(ap), FadeIn(tminus),
                  FadeIn(digit), run_time=0.5)

        for n, open_amt in (("2", 0.5), ("1", 0.24)):
            self.wait(0.5)
            new_ap = iris(open_amt, radius=0.62).move_to(cd_center)
            new_digit = display(n, size=40).move_to(cd_center)
            self.play(Transform(ap, new_ap),
                      Transform(digit, new_digit),
                      Rotate(ap, angle=math.radians(18), about_point=cd_center),
                      run_time=0.5, rate_func=rf.smooth)
        self.wait(0.45)

        # ---- T0 : the synchronized capture ----
        shut = iris(0.0, radius=0.62).move_to(cd_center)
        self.play(
            Transform(ap, shut),
            FadeOut(digit, run_time=0.2),
            FadeOut(tminus, run_time=0.2),
            t0_dot.animate.scale(1.6),
            FadeIn(t0_dot),
            FadeIn(t0_lbl),
            *[Indicate(p, scale_factor=1.06, color=INK) for p in phones],
            Flash([0, -1.55, 0], color=INK, line_length=0.4, num_lines=18,
                  flash_radius=0.75, run_time=0.7),
            run_time=0.7,
        )
        # the "one instant" annotation
        inst_l = leader([2.1, -1.05, 0], [0.7, -1.4, 0])
        inst_t = mono("ONE INSTANT", size=16, color=INK, tracking=0.16).next_to(inst_l[0].get_start(), RIGHT, buff=0.08)
        inst_s = mono("T0 · ALL ANGLES", size=12, color=DIM, tracking=0.16).next_to(inst_t, DOWN, buff=0.08, aligned_edge=LEFT)
        self.play(Create(inst_l), FadeIn(inst_t), FadeIn(inst_s), run_time=0.5)
        self.wait(0.7)

        # ---- assemble the multi-angle artifact ----
        self.play(
            FadeOut(VGroup(ap, rim, sights, subj_l, subj_t, inst_l, inst_t, inst_s,
                           anglbls, axis, ticks, t0_dot, t0_lbl, clk_lbl, sync_lbl, drop)),
            run_time=0.5,
        )
        targets = [[-1.55, -1.4, 0], [0, -1.4, 0], [1.55, -1.4, 0]]
        flying = []
        for ph, tp in zip(phones, targets):
            t = tile(1.0).scale(0.5).move_to(ph.get_center())
            flying.append((t, tp))
        self.play(
            *[FadeOut(p) for p in phones],
            *[FadeIn(t) for (t, _) in flying],
            run_time=0.4,
        )
        self.play(*[t.animate.scale(2.0).move_to(tp) for (t, tp) in flying],
                  run_time=0.9, rate_func=EASE)
        art_box = Rectangle(width=5.0, height=1.55, color=INK, stroke_width=1.2).move_to([0, -1.4, 0])
        art_box.set_stroke(opacity=0.5)
        art_l = mono("MULTI-ANGLE ARTIFACT · 3 ANGLES · ONE INSTANT", size=15, color=INK,
                     tracking=0.14).next_to(art_box, DOWN, buff=0.25)
        self.play(Create(art_box), FadeIn(art_l), run_time=0.6)
        self.wait(0.9)

        self.play(FadeOut(VGroup(heading, art_box, art_l, *[t for (t, _) in flying])),
                  run_time=0.6)

    # ---------------------------------------------------------- FIG_004 RECAP
    def chapter_recap(self):
        self.swap_rails("FIG_004", "THE RECAP REEL")

        heading = display("Then it plays itself back.", size=36).move_to([0, 3.1, 0])
        self.play(Write(heading, run_time=0.8))

        # a vertical 9:16 phone frame
        fh = 4.18
        frame = phone(fh, screen_hatch=False).move_to([-2.6, -0.4, 0])
        # the inner screen we draw into (matches phone()'s screen rect)
        screen = Rectangle(width=fh * 0.55 - 0.18, height=fh - 0.34, color=INK, stroke_width=0)
        screen.move_to(frame.get_center())
        self.play(Create(frame, run_time=0.8, rate_func=EASE))

        # story progress segments at the top of the screen
        seg = VGroup()
        nseg = 5
        seg_w = (screen.width - 0.1) / nseg
        for i in range(nseg):
            x = screen.get_left()[0] + 0.05 + seg_w * (i + 0.5)
            base = Line([x - seg_w / 2 + 0.03, 0, 0], [x + seg_w / 2 - 0.03, 0, 0],
                        stroke_width=2.4, color=INK)
            base.set_opacity(0.25 if i else 0.95)
            base.move_to([x, screen.get_top()[1] - 0.16, 0])
            seg.add(base)
        self.play(FadeIn(seg, run_time=0.4))

        # title card inside the frame
        sc = screen.get_center()
        t_rec = mono("RECAP", size=15, color=DIM, tracking=0.42).move_to(sc + UP * 0.95)
        t_name = display("Summer\nRooftop", size=30).move_to(sc + UP * 0.1)
        t_meta = mono("15 PHOTOS · EVERY ANGLE, ONE INSTANT", size=10, color=DIM,
                      tracking=0.16).move_to(sc + DOWN * 0.95)
        if t_meta.width > screen.width - 0.2:
            t_meta.scale_to_fit_width(screen.width - 0.25)
        title_card = VGroup(t_rec, t_name, t_meta)
        self.play(FadeIn(title_card, run_time=0.7))
        self.wait(0.7)

        # cross-fade to a ken-burns photo frame, then to the moment card
        photo = tile(screen.width * 0.9).move_to(sc)
        self.play(FadeOut(title_card, run_time=0.4),
                  FadeIn(photo, run_time=0.4))
        self.play(photo.animate.scale(1.12), run_time=1.2, rate_func=rf.linear)

        moment = VGroup()
        ms = screen.width * 0.42
        for r in range(2):
            for c in range(2):
                if r == 1 and c == 1:
                    continue
                moment.add(tile(ms).move_to(sc + RIGHT * (c - 0.5) * (ms + 0.08)
                                            + UP * (0.5 - r) * (ms + 0.08)))
        mlabel = mono("THE MOMENT · 3 ANGLES", size=9, color=INK, tracking=0.14)
        if mlabel.width > screen.width - 0.2:
            mlabel.scale_to_fit_width(screen.width - 0.3)
        mlabel.move_to(sc + DOWN * (screen.height / 2 - 0.32))
        self.play(FadeOut(photo, run_time=0.35), FadeIn(moment, run_time=0.5),
                  FadeIn(mlabel, run_time=0.5))
        self.wait(0.6)

        # callouts on the right
        callouts = VGroup(
            self._callout([0.2, 1.5, 0], frame.get_top() + DOWN * 0.2 + RIGHT * 0.5,
                          "VERTICAL", "STORY FORMAT"),
            self._callout([0.2, -0.1, 0], frame.get_right() + RIGHT * 0.05,
                          "TAP → ADVANCE", "PAUSE · BACK"),
            self._callout([0.2, -1.7, 0], frame.get_bottom() + UP * 0.4 + RIGHT * 0.4,
                          "EXPORT 1080×1920", "→ YOUR GALLERY"),
        )
        self.play(LaggedStart(*[FadeIn(c) for c in callouts], lag_ratio=0.2, run_time=1.2))
        self.wait(0.9)

        self.play(FadeOut(VGroup(heading, frame, seg, photo, moment, mlabel, callouts),
                          run_time=0.6))

    def _callout(self, text_anchor, target, line1, line2):
        ld = leader([text_anchor[0] - 0.1, text_anchor[1], 0], target)
        c1 = mono(line1, size=15, color=INK, tracking=0.14).next_to(
            [text_anchor[0], text_anchor[1] + 0.0, 0], RIGHT, buff=0.12)
        c2 = mono(line2, size=11, color=DIM, tracking=0.14).next_to(c1, DOWN, buff=0.07, aligned_edge=LEFT)
        return VGroup(ld, c1, c2)

    # ----------------------------------------------------------------- OUTRO
    def outro(self):
        self.play(FadeOut(self.cur_rails, run_time=0.4),
                  FadeOut(self.header, run_time=0.4))
        self.cur_rails = VGroup()

        mark = aperture_mark(0.9, stroke=2.2).move_to([0, 1.6, 0])
        word = display("Vantage", size=66).move_to([0, 0.35, 0])
        tagline = serif("every angle, one instant.", size=30, color=DIM).move_to([0, -0.55, 0])
        cta = mono("START A SPACE — NO APP · NO ACCOUNT · FREE", size=18, color=INK,
                   tracking=0.2).move_to([0, -1.75, 0])
        url = mono("vantage.abhishek-aditya10.workers.dev", size=15, color=DIM,
                   tracking=0.18, upper=False).move_to([0, -2.45, 0])
        div = shade_divider(9.0).move_to([0, -3.05, 0])

        self.play(Create(mark[0]), run_time=0.6)
        self.play(FadeIn(mark[1]), GrowFromCenter(mark[2]), run_time=0.5)
        self.play(Write(word, run_time=0.9))
        self.play(FadeIn(tagline, shift=UP * 0.15, run_time=0.6))
        self.play(FadeIn(cta, run_time=0.5), FadeIn(url, run_time=0.5), FadeIn(div, run_time=0.6))
        self.wait(1.6)

        self.play(
            FadeOut(VGroup(mark, word, tagline, cta, url, div), run_time=1.0),
            self.grid.animate.set_opacity(0.18),
            run_time=1.0,
        )
        self.wait(0.4)
