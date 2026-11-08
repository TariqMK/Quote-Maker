"""Copies the app's renderer, fonts and brand images into docs/, which GitHub Pages serves.

Pages serves only docs/, so the working demo on the site needs its own copies.
Run this after a change to the renderer, presets, fonts or brand images:
    python assets/make_site.py
"""

import shutil
import time
from pathlib import Path

ATTEMPTS = 5

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


def retry(action, *args) -> None:
    """Run a file action, waiting if a sync tool such as OneDrive holds the file for a moment."""
    for attempt in range(ATTEMPTS):
        try:
            action(*args)
            return
        except PermissionError:
            if attempt == ATTEMPTS - 1:
                raise
            time.sleep(1)


def main() -> None:
    # Each engine file and where it comes from. The font licences are included,
    # because each licence must stay with its font.
    wanted = {ENGINE / "js" / name: WEB / "js" / name for name in ENGINE_SCRIPTS}
    wanted[ENGINE / "fonts.css"] = WEB / "fonts.css"
    for source in (WEB / "fonts").rglob("*"):
        if source.is_file():
            wanted[ENGINE / "fonts" / source.relative_to(WEB / "fonts")] = source

    # Files are replaced in place. Deleting the whole folder first fails while OneDrive syncs it.
    for target, source in {**wanted, **{t: s for s, t in BRAND_FILES.items()}}.items():
        target.parent.mkdir(parents=True, exist_ok=True)
        retry(shutil.copy2, source, target)
    (DOCS / ".nojekyll").touch()

    # Remove what the app no longer has, such as a font that was taken out.
    if ENGINE.exists():
        for path in ENGINE.rglob("*"):
            if path.is_file() and path not in wanted:
                retry(path.unlink)
        folders = [path for path in ENGINE.rglob("*") if path.is_dir()]
        for folder in sorted(folders, key=lambda path: len(path.parts), reverse=True):
            if not any(folder.iterdir()):
                retry(folder.rmdir)

    print(f"Copied {len(wanted)} files to {ENGINE.relative_to(ROOT)} and {len(BRAND_FILES)} brand images to docs")


if __name__ == "__main__":
    main()
