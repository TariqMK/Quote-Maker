"""Retakes the README screenshots from the real interface, in light and dark, with made-up data.

Writes assets/screenshots/<view>-light.png and <view>-dark.png at 1120 x 820 px, saved at 2x.
It captures only the page, in a clean browser profile, so no real settings or files can appear.
The page's network requests are blocked, except to the local server.
The version label shows the newest vX.Y.Z git tag. The script fetches tags from the repository's
own remote first, and carries on with the local tags if that fails.
Needs Microsoft Edge. Run from any environment that has the brand tools:
    python -m pip install .[brand]
    python assets/make_screenshots.py
"""

import functools
import json
import re
import subprocess
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ASSETS = Path(__file__).parent
ROOT = ASSETS.parent
WEB_DIR = ROOT / "quote_maker" / "web"
OUT_DIR = ASSETS / "screenshots"
WIDTH, HEIGHT, SCALE = 1120, 820, 2
FETCH_TIMEOUT_SECONDS = 20


def newest_version(tags):
    """Return the highest X.Y.Z from a list of tags, or None. Other tag formats are ignored."""
    matches = (re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", tag.strip()) for tag in tags)
    versions = [tuple(int(part) for part in match.groups()) for match in matches if match]
    return ".".join(str(part) for part in max(versions)) if versions else None


def repo_tags():
    """Return the repository's tags, fetching any new ones first when the remote is reachable."""
    try:
        subprocess.run(
            ["git", "fetch", "--tags", "--quiet"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            timeout=FETCH_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.TimeoutExpired):
        print("Could not fetch tags. Using the local tags.")
    try:
        result = subprocess.run(
            ["git", "tag", "--list"], cwd=ROOT, check=False, capture_output=True, text=True
        )
    except OSError:
        return []
    return result.stdout.splitlines()


def source_version():
    """Return the development version from the source, for a repository with no release yet."""
    text = (ROOT / "quote_maker" / "_version.py").read_text(encoding="utf-8")
    return re.search(r'__version__ = "([^"]+)"', text).group(1)


SHOWN_VERSION = newest_version(repo_tags()) or source_version()

# Made-up saved styles, for the My styles view.
SAMPLE_STYLES = [
    {
        "id": "custom-harbour",
        "name": "Harbour notes",
        "background": {"type": "linear", "color1": "#17323b", "color2": "#0e1e24", "angle": 170},
        "quote": {
            "font": "Newsreader",
            "color": "#f1ece0",
            "emphasis": "color",
            "emphasisColor": "#e9b872",
        },
        "author": {"font": "Newsreader", "color": "#f1ece0", "letterSpacing": 0, "size": 34},
        "source": {"font": "Newsreader", "italic": True, "color": "#a9b8ba", "size": 30},
    },
    {
        "id": "custom-paper",
        "name": "Rough paper",
        "background": {"color1": "#efe7d6"},
        "texture": {"type": "grain", "opacity": 0.16},
        "quote": {"font": "Lora", "emphasis": "color", "emphasisColor": "#a2371f"},
        "author": {"font": "Lora", "letterSpacing": 0},
        "source": {"font": "Lora", "italic": True},
    },
    {
        "id": "custom-signal",
        "name": "Signal yellow",
        "background": {"color1": "#ffd23f"},
        "layout": {"align": "left", "margin": 90},
        "quote": {
            "font": "Space Grotesk",
            "weight": 700,
            "size": 96,
            "lineHeight": 1.1,
            "color": "#16140c",
        },
        "author": {
            "font": "Space Grotesk",
            "weight": 700,
            "dash": False,
            "color": "#16140c",
            "letterSpacing": 0,
        },
        "source": {"font": "Space Grotesk", "color": "#16140c"},
    },
]

# Stands in for the Python side, so nothing is read from or written to this computer.
FAKE_API = """
window.pywebview = { api: {
  get_version: async () => VERSION,
  list_styles: async () => STYLES,
  load_state: async () => ({}),
  save_state: async () => null,
  save_style: async (style) => style,
  delete_style: async () => true,
  save_image: async () => null,
} };
""".replace("VERSION", json.dumps(SHOWN_VERSION)).replace("STYLES", json.dumps(SAMPLE_STYLES))

# Each view: file name, words, image size, style, right tab, and optional extra step.
VIEWS = [
    {
        "file": "editor",
        "quote": "Keep the [yellow: first draft]. It remembers what you *meant* before you knew how to say it.",
        "author": "Mara Ellison",
        "source": "Notes from the Harbour",
        "size": "Portrait",
        "style": "oxblood",
        "tab": "tab-styles",
    },
    {
        "file": "fine-tune",
        "quote": "The *quiet* work is still the work.",
        "author": "Tomas Reyes",
        "source": "",
        "size": "Square",
        "style": "sunset-poster",
        "tab": "tab-tune",
    },
    {
        "file": "my-styles",
        "quote": "Start before you feel ready. *Ready* is a story you tell afterwards.",
        "author": "Ines Okafor",
        "source": "The Long Way Round",
        "size": "Landscape",
        "style": "custom-harbour",
        "tab": "tab-styles",
        "filter": "My styles",
    },
]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def start_server():
    handler = functools.partial(QuietHandler, directory=str(WEB_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def wait_until(page, expression, timeout=15):
    """Poll in Python, because the page's security policy blocks Playwright's own waiting."""
    deadline = time.monotonic() + timeout
    while not page.evaluate(expression):
        if time.monotonic() > deadline:
            raise TimeoutError(f"Timed out waiting for: {expression}")
        time.sleep(0.1)


def capture(browser, url, scheme):
    context = browser.new_context(
        viewport={"width": WIDTH, "height": HEIGHT},
        device_scale_factor=SCALE,
        color_scheme=scheme,
    )
    local = url.rstrip("/")
    context.route(
        "**/*",
        lambda route: route.continue_() if route.request.url.startswith(local) else route.abort(),
    )
    context.add_init_script(FAKE_API)
    for view in VIEWS:
        page = context.new_page()
        page.goto(f"{local}/index.html")
        wait_until(page, f"document.getElementById('version').textContent === 'v{SHOWN_VERSION}'")
        wait_until(page, "!!document.querySelector('[data-style-id=custom-harbour]')")
        page.fill("#quote", view["quote"])
        page.fill("#author", view["author"])
        page.fill("#source", view["source"])
        page.locator(".size-option", has_text=view["size"]).click()
        page.locator(f'[data-style-id="{view["style"]}"]').click()
        if "filter" in view:
            page.locator(".filter", has_text=view["filter"]).click()
        page.click(f"#{view['tab']}")
        # Clicking a style can scroll the gallery, which would hide the filters.
        page.evaluate("document.getElementById('pane-styles').scrollTop = 0")
        # Wait for fonts and every visible thumbnail, then for the preview to redraw.
        wait_until(page, "document.fonts.status === 'loaded'")
        wait_until(
            page,
            "[...document.querySelectorAll('.swatch canvas')].every((c) => c.width === 400)",
        )
        time.sleep(0.5)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        path = OUT_DIR / f"{view['file']}-{scheme}.png"
        page.screenshot(path=str(path))
        print(f"Wrote {path.relative_to(ASSETS.parent)} ({path.stat().st_size // 1024} KB)")
        page.close()
    context.close()


def main():
    from playwright.sync_api import sync_playwright  # Imported here so tests need no browser tools.

    print(f"Showing version v{SHOWN_VERSION}")
    server = start_server()
    url = f"http://127.0.0.1:{server.server_address[1]}"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=True)
        for scheme in ("light", "dark"):
            capture(browser, url, scheme)
        browser.close()
    server.shutdown()


if __name__ == "__main__":
    main()
