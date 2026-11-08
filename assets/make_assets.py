"""Writes every brand image from the icon masters in assets/icon.

Writes the app icon as .png, .ico and .icns, copies the window icons into quote_maker/web,
and writes assets/banner.png and assets/social-card.png. Text uses the app's bundled fonts.
Run from any environment that has the brand tools:
    python -m pip install .[brand]
    python assets/make_assets.py [--guides copy-with-safe-area.png]
"""

import argparse
import io
import os
import struct
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PySide6.QtCore import QBuffer, QByteArray, QIODevice, QPointF, QRectF, Qt
from PySide6.QtGui import (
    QColor,
    QFont,
    QFontDatabase,
    QFontMetricsF,
    QGuiApplication,
    QImage,
    QPainter,
    QPen,
)
from PySide6.QtSvg import QSvgRenderer

ASSETS = Path(__file__).parent
ICON_DIR = ASSETS / "icon"
WEB_DIR = ASSETS.parent / "quote_maker" / "web"
NAME = "quote-maker"
APP_NAME = "Quote-Maker"
TAGLINE = "Any words. Many styles. One image."

# Colours from the app's dark theme in quote_maker/web/styles.css.
BACKGROUND = "#111112"  # --stage
BORDER = QColor(255, 255, 255, 23)  # --line
TEXT = "#eeeeec"  # --text
TEXT_2 = "#a9a9ac"  # --text-2
TEXT_3 = "#8a8a8e"  # --text-3
SUBLINE = "Windows · macOS · Linux"

FONTS = WEB_DIR / "fonts"
UI_FONT = FONTS / "instrument-sans" / "instrument-sans-latin-wght-normal.woff2"
MONO_FONT = FONTS / "ibm-plex-mono" / "ibm-plex-mono-latin-400-normal.woff2"
SEMIBOLD = 600

MASTER = ICON_DIR / f"{NAME}.svg"
SMALL_MASTER = ICON_DIR / f"{NAME}-small.svg"
SMALL_LIMIT = 32  # This size and below use the simplified master.

ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
# Each icns type code holds one size. Retina types share a pixel size with a larger plain type.
ICNS_TYPES = [
    (b"icp4", 16),
    (b"ic11", 32),
    (b"icp5", 32),
    (b"ic12", 64),
    (b"icp6", 64),
    (b"ic07", 128),
    (b"ic13", 256),
    (b"ic08", 256),
    (b"ic14", 512),
    (b"ic09", 512),
    (b"ic10", 1024),
]


def render_svg(path, size):
    """Render an SVG to a square transparent image."""
    renderer = QSvgRenderer(QByteArray(path.read_bytes()))
    if not renderer.isValid():
        sys.exit(f"Cannot read the SVG: {path}")
    image = QImage(size, size, QImage.Format.Format_ARGB32_Premultiplied)
    image.fill(Qt.GlobalColor.transparent)
    painter = QPainter(image)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    renderer.render(painter, QRectF(0, 0, size, size))
    painter.end()
    return image


def icon_png(size):
    """Return PNG bytes of the icon at one size, from the master that suits that size."""
    image = render_svg(SMALL_MASTER if size <= SMALL_LIMIT else MASTER, size)
    data = QByteArray()
    buffer = QBuffer(data)
    buffer.open(QIODevice.OpenModeFlag.WriteOnly)
    image.save(buffer, "PNG")
    return bytes(data)


def ico_bytes(sizes):
    """Build a Windows .ico with one PNG-encoded image per size."""
    images = [(size, icon_png(size)) for size in sizes]
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = len(header) + 16 * len(images)
    entries = b""
    for size, png in images:
        dimension = 0 if size >= 256 else size  # In an .ico, 0 means 256.
        entries += struct.pack("<BBBBHHII", dimension, dimension, 0, 0, 1, 32, len(png), offset)
        offset += len(png)
    return header + entries + b"".join(png for _, png in images)


def icns_bytes():
    """Build a macOS .icns with PNG-encoded images, including the Retina sizes."""
    body = b""
    for code, size in ICNS_TYPES:
        png = icon_png(size)
        body += code + struct.pack(">I", len(png) + 8) + png
    return b"icns" + struct.pack(">I", len(body) + 8) + body


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"Wrote {path.relative_to(ASSETS.parent)} ({len(data) // 1024} KB)")


def make_icons():
    write(ICON_DIR / f"{NAME}.png", icon_png(1024))
    ico = ico_bytes(ICO_SIZES)
    write(ICON_DIR / f"{NAME}.ico", ico)
    write(ICON_DIR / f"{NAME}.icns", icns_bytes())
    # The running app uses these for its window: .ico on Windows, .png on Linux.
    write(WEB_DIR / "icon.ico", ico)
    write(WEB_DIR / "icon.png", icon_png(256))


def load_font(path, pixel_size, weight=None):
    """Load a bundled WOFF2 font, fixing a variable font at one weight, and return a QFont."""
    font = TTFont(path)
    font.flavor = None
    if weight is not None:
        instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True)
    data = io.BytesIO()
    font.save(data)
    font_id = QFontDatabase.addApplicationFontFromData(QByteArray(data.getvalue()))
    if font_id < 0:
        sys.exit(f"Cannot load the font: {path}")
    result = QFont(QFontDatabase.applicationFontFamilies(font_id)[0])
    result.setPixelSize(pixel_size)
    result.setWeight(QFont.Weight(weight or 400))
    result.setHintingPreference(QFont.HintingPreference.PreferNoHinting)
    return result


def start_painter(image):
    painter = QPainter(image)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    painter.setRenderHint(QPainter.RenderHint.TextAntialiasing)
    return painter


def make_banner():
    """1280 x 320 px at 2x: the icon, then the name above the tagline, centred as one group."""
    width, height, scale = 1280, 320, 2
    icon_size, icon_gap, line_gap = 176, 40, 28
    name_font = load_font(UI_FONT, 96, SEMIBOLD)
    tagline_font = load_font(MONO_FONT, 24)
    name_metrics = QFontMetricsF(name_font)
    tagline_metrics = QFontMetricsF(tagline_font)

    image = QImage(width * scale, height * scale, QImage.Format.Format_ARGB32_Premultiplied)
    image.fill(Qt.GlobalColor.transparent)
    painter = start_painter(image)
    painter.scale(scale, scale)
    painter.setPen(QPen(BORDER, 1))
    painter.setBrush(QColor(BACKGROUND))
    painter.drawRoundedRect(QRectF(0.5, 0.5, width - 1, height - 1), 24, 24)

    text_width = max(
        name_metrics.horizontalAdvance(APP_NAME), tagline_metrics.horizontalAdvance(TAGLINE)
    )
    left = (width - (icon_size + icon_gap + text_width)) / 2
    QSvgRenderer(QByteArray(MASTER.read_bytes())).render(
        painter, QRectF(left, (height - icon_size) / 2, icon_size, icon_size)
    )

    # Centre the text by its visible height: name capitals down to the tagline baseline.
    block = name_metrics.capHeight() + line_gap + tagline_metrics.capHeight()
    name_baseline = (height - block) / 2 + name_metrics.capHeight()
    text_left = left + icon_size + icon_gap
    painter.setFont(name_font)
    painter.setPen(QColor(TEXT))
    painter.drawText(QPointF(text_left, name_baseline), APP_NAME)
    painter.setFont(tagline_font)
    painter.setPen(QColor(TEXT_2))
    tagline_baseline = name_baseline + line_gap + tagline_metrics.capHeight()
    painter.drawText(QPointF(text_left, tagline_baseline), TAGLINE)
    painter.end()

    path = ASSETS / "banner.png"
    image.save(str(path))
    print(f"Wrote {path.relative_to(ASSETS.parent)} ({path.stat().st_size // 1024} KB)")


def contrast(foreground, background):
    """Return the WCAG contrast ratio of two colours."""

    def luminance(name):
        color = QColor(name)
        channels = [color.redF(), color.greenF(), color.blueF()]
        linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

    light, dark = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def fit_width(font, text, max_width):
    """Shrink a font 2 px at a time until the text fits."""
    result = QFont(font)
    while QFontMetricsF(result).horizontalAdvance(text) > max_width and result.pixelSize() > 12:
        result.setPixelSize(result.pixelSize() - 2)
    if result.pixelSize() < font.pixelSize():
        print(f'Warning: "{text}" shrank from {font.pixelSize()} to {result.pixelSize()} px.')
    return result


def content_bounds(image, background):
    """Return the box around every pixel that differs from the background."""
    xs, ys = [], []
    for y in range(image.height()):
        for x in range(image.width()):
            if image.pixelColor(x, y) != background:
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def make_social_card(guides=None):
    """1280 x 640 px in the fixed repo-card layout. Exits if anything leaves the safe area."""
    width, height, safe = 1280, 640, 80
    icon_size, icon_top, icon_gap = 168, 150, 40
    tagline_baseline, subline_baseline = 420, 476
    safe_width = width - 2 * safe

    name_font = load_font(UI_FONT, 112, SEMIBOLD)
    name_font.setLetterSpacing(QFont.SpacingType.PercentageSpacing, 98)
    name_font = fit_width(name_font, APP_NAME, safe_width - icon_size - icon_gap)
    tagline_font = fit_width(load_font(MONO_FONT, 34), TAGLINE, safe_width)
    subline_font = fit_width(load_font(MONO_FONT, 24), SUBLINE, safe_width)

    image = QImage(width, height, QImage.Format.Format_ARGB32)
    image.fill(QColor(BACKGROUND))
    painter = start_painter(image)

    name_metrics = QFontMetricsF(name_font)
    name_width = name_metrics.horizontalAdvance(APP_NAME)
    left = (width - (icon_size + icon_gap + name_width)) / 2
    QSvgRenderer(QByteArray(MASTER.read_bytes())).render(
        painter, QRectF(left, icon_top, icon_size, icon_size)
    )
    painter.setFont(name_font)
    painter.setPen(QColor(TEXT))
    # The name's cap height is centred on the icon. The nudge evens out the gap to the icon.
    baseline = icon_top + icon_size / 2 + name_metrics.capHeight() / 2
    nudge = name_font.pixelSize() * 0.035
    painter.drawText(QPointF(left + icon_size + icon_gap - nudge, baseline), APP_NAME)

    for text, font, color, y in (
        (TAGLINE, tagline_font, TEXT_2, tagline_baseline),
        (SUBLINE, subline_font, TEXT_3, subline_baseline),
    ):
        painter.setFont(font)
        painter.setPen(QColor(color))
        text_width = QFontMetricsF(font).horizontalAdvance(text)
        painter.drawText(QPointF((width - text_width) / 2, y), text)
    painter.end()

    path = ASSETS / "social-card.png"
    image.save(str(path))
    print(f"Wrote {path.relative_to(ASSETS.parent)} ({path.stat().st_size // 1024} KB)")

    for label, color in (("Name", TEXT), ("Tagline", TEXT_2), ("Subline", TEXT_3)):
        print(f"{label} contrast: {contrast(color, BACKGROUND):.1f}:1")

    if guides:
        copy = image.copy()
        painter = QPainter(copy)
        painter.setPen(QPen(QColor("#d1242f"), 2))
        painter.drawRect(safe, safe, safe_width, height - 2 * safe)
        painter.end()
        copy.save(str(guides))

    x0, y0, x1, y1 = content_bounds(image, QColor(BACKGROUND))
    print(
        f"Content: x {x0}-{x1}, y {y0}-{y1}. Safe area: x {safe}-{width - safe}, y {safe}-{height - safe}"
    )
    if x0 < safe or y0 < safe or x1 > width - safe or y1 > height - safe:
        sys.exit("The social card content is outside the safe area.")


def main():
    parser = argparse.ArgumentParser(description="Writes every Quote-Maker brand image.")
    parser.add_argument("--guides", help="also write a social card copy with the safe area drawn")
    args = parser.parse_args()

    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    app = QGuiApplication(sys.argv[:1])  # noqa: F841 - Qt needs an application object.
    make_icons()
    make_banner()
    make_social_card(args.guides)


if __name__ == "__main__":
    main()
