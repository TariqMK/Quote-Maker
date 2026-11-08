"""Fails the build if the packaged app is missing interface files or fonts.

Usage: check_bundle.py <single-file executable, or .app folder>
"""

import sys
from pathlib import Path

REQUIRED = [
    "quote_maker/web/index.html",
    "quote_maker/web/styles.css",
    "quote_maker/web/fonts.css",
    "quote_maker/web/js/app.js",
    "quote_maker/web/js/render.js",
    "quote_maker/web/js/presets.js",
    "quote_maker/web/js/fonts.js",
    "quote_maker/web/icon.ico",
    "quote_maker/web/icon.png",
]
MIN_FONT_FILES = 24
MIN_FONT_LICENCES = 24


def bundled_names(target):
    """List bundled file paths, using forward slashes, from an executable or a folder."""
    if target.is_dir():
        return [p.relative_to(target).as_posix() for p in target.rglob("*") if p.is_file()]
    from PyInstaller.archive.readers import CArchiveReader

    return [name.replace("\\", "/") for name in CArchiveReader(str(target)).toc]


def problems(names):
    found = []
    for required in REQUIRED:
        if not any(name.endswith(required) for name in names):
            found.append(f"Missing {required}")
    fonts = [n for n in names if "quote_maker/web/fonts/" in n and n.endswith(".woff2")]
    licences = [n for n in names if "quote_maker/web/fonts/" in n and n.endswith("/LICENSE")]
    if len(fonts) < MIN_FONT_FILES:
        found.append(f"Only {len(fonts)} font files")
    if len(licences) < MIN_FONT_LICENCES:
        found.append(f"Only {len(licences)} font licences")
    return found


if __name__ == "__main__":
    names = bundled_names(Path(sys.argv[1]))
    errors = problems(names)
    for error in errors:
        print(error, file=sys.stderr)
    if errors:
        sys.exit(1)
    print(f"Bundle check passed: {len(names)} files.")
