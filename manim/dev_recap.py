"""Fast dev harness: render just the recap chapter.
   manim -ql -s --media_dir media dev_recap.py RecapDev   (last frame)
"""
import math
from manim import VGroup, config
from vantage_theme import BG, aperture_mark, corner_marks, display, dot_grid, mono
from vantage_film import VantageFilm

config.background_color = BG


class RecapDev(VantageFilm):
    def construct(self):
        self.grid = dot_grid(opacity=0.5)
        self.crops = corner_marks(13.7, 7.3, opacity=0.5)
        self.add(self.grid, self.crops)
        mark = aperture_mark(0.22, stroke=1.5)
        from manim import RIGHT, UP, LEFT
        word = display("Vantage", size=24).next_to(mark, RIGHT, buff=0.22)
        self.header = VGroup(mark, word).to_corner(UP + LEFT, buff=0.5)
        self.add(self.header)
        self.cur_rails = VGroup()
        self.chapter_recap()
