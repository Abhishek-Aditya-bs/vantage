"""Quick visual smoke test for the Vantage drawing kit. Render one frame:
   manim -ql -s manim/smoke_test.py Smoke
"""
from manim import (
    Circle,
    DOWN,
    LEFT,
    RIGHT,
    Scene,
    UP,
    VGroup,
    config,
)

from vantage_theme import (
    BG, INK, DIM,
    aperture_mark, corner_marks, display, dot_grid, hatch, leader,
    mono, phone, qr_code, reg, serif, shade_divider, tick,
)

config.background_color = BG


class Smoke(Scene):
    def construct(self):
        self.add(dot_grid())
        self.add(corner_marks(13.6, 7.2))

        # type specimens
        self.add(display("Every phone. One instant.", size=54).to_edge(UP, buff=0.7))
        self.add(mono("MULTI-ANGLE CAPTURE · REAL-TIME", size=22, color=DIM).next_to(
            self.mobjects[-1], DOWN, buff=0.35))
        self.add(serif("Scan a QR to join a space.", size=30).move_to([0, 1.4, 0]))

        # aperture mark
        amark = aperture_mark(0.9).move_to([-4.5, -0.6, 0])
        self.add(amark)
        self.add(mono("MARK", size=14, color=DIM).next_to(amark, DOWN, buff=0.3))

        # phone + qr
        ph = phone(2.4).move_to([-1.6, -1.4, 0])
        self.add(ph)
        self.add(qr_code(1.0).move_to(ph.get_center() + UP * 0.2))

        # hatch swatch
        sw = hatch(1.4, 1.0).move_to([1.8, -1.4, 0])
        self.add(sw)
        self.add(mono("HATCH", size=14, color=DIM).next_to(sw, DOWN, buff=0.25))

        # leader + reg + tick
        self.add(leader([3.2, -0.2, 0], [4.6, 0.6, 0]))
        self.add(mono("LEADER", size=14, color=DIM).move_to([3.0, -0.45, 0]))
        self.add(reg([3.2, -1.2, 0], [5.4, -1.2, 0]))
        self.add(tick([4.3, -1.2, 0]))

        self.add(shade_divider(13).to_edge(DOWN, buff=0.5))
