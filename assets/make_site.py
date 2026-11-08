"""Copies the app's renderer, fonts and brand images into docs/, which GitHub Pages serves.

Pages serves only docs/, so the working demo on the site needs its own copies.
Run this after a change to the renderer, presets, fonts or brand images:
    python assets/make_site.py
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "quote_maker" / "web"
DOCS = ROOT / "docs"
ENGINE = DOCS / "engine"

# The modules the demo uses. The rest of the app's scripts need the Python window.
ENGINE_SCRIPTS = ["fonts.js", "layout.js", "presets.js", "render.js", "text.js"]

BRAND_FILES = {
    ROOT / "assets" / "icon" / "quote-maker.svg": DOCS / "icon.svg",
    ROOT / "assets" / "icon" / "quote-maker.png": DOCS / "apple-touch-icon.png",
    ROOT / "assets" / "social-card.png": DOCS / "social-card.png",
}


def main() -> None:
    if ENGINE.exists():
        shutil.rmtree(ENGINE)
    (ENGINE / "js").mkdir(parents=True)
    for name in ENGINE_SCRIPTS:
        shutil.copy2(WEB / "js" / name, ENGINE / "js" / name)
    shutil.copy2(WEB / "fonts.css", ENGINE / "fonts.css")
    # The font licences are copied too, because each licence must stay with its font.
    shutil.copytree(WEB / "fonts", ENGINE / "fonts")
    for source, target in BRAND_FILES.items():
        shutil.copy2(source, target)
    (DOCS / ".nojekyll").touch()
    files = sum(1 for path in ENGINE.rglob("*") if path.is_file())
    print(f"Copied {files} files to {ENGINE.relative_to(ROOT)} and {len(BRAND_FILES)} brand images to docs")


if __name__ == "__main__":
    main()
