"""Asks GitHub for the newest Quotical release. Runs only when the user selects the version number.

It sends one GET request with a User-Agent and an Accept header, and nothing else.
Nothing is downloaded, logged or stored.
"""

import json
import re
import urllib.error
import urllib.request

REPO = "TariqMK/Quotical"
API_URL = f"https://api.github.com/repos/{REPO}/releases/latest"
RELEASES_URL = f"https://github.com/{REPO}/releases"
TIMEOUT_SECONDS = 10

RELEASE_VERSION = re.compile(r"v?(\d+)\.(\d+)\.(\d+)")
# A build from a branch, such as v1.6.0-new-sync.1. It is never treated as a release.
BRANCH_VERSION = re.compile(r"v?\d+\.\d+\.\d+-[0-9A-Za-z][0-9A-Za-z.-]*")

UNREADABLE = "GitHub sent an answer Quotical can't read. Try again later."


class UpdateCheckError(Exception):
    """A failed check. The message is written for the user."""


def parse_version(text) -> tuple[int, int, int] | None:
    """Return (major, minor, patch) for "vX.Y.Z" or "X.Y.Z", or None for any other text."""
    match = RELEASE_VERSION.fullmatch(str(text).strip())
    return tuple(int(part) for part in match.groups()) if match else None


def is_branch_build(text) -> bool:
    return bool(BRANCH_VERSION.fullmatch(str(text).strip()))


def fetch_latest(current: str, opener=urllib.request.urlopen) -> dict:
    """Ask GitHub for the latest published release and return its JSON object."""
    request = urllib.request.Request(
        API_URL,
        headers={"User-Agent": f"Quotical/{current}", "Accept": "application/vnd.github+json"},
    )
    try:
        with opener(request, timeout=TIMEOUT_SECONDS) as response:
            body = response.read()
    except urllib.error.HTTPError as error:
        if error.code == 404:
            raise UpdateCheckError("No Quotical releases are published yet.") from error
        if error.code in (403, 429):
            raise UpdateCheckError(
                "GitHub limits how often it can be checked. Try again in an hour."
            ) from error
        raise UpdateCheckError(
            f"GitHub answered with error {error.code}. Try again later."
        ) from error
    except urllib.error.URLError as error:
        raise UpdateCheckError(
            f"Can't reach GitHub: {error.reason}. Check the internet connection."
        ) from error
    except OSError as error:  # Includes a timeout while reading the answer.
        reason = str(error) or type(error).__name__
        raise UpdateCheckError(
            f"Can't reach GitHub: {reason}. Check the internet connection."
        ) from error
    try:
        data = json.loads(body)
    except (ValueError, UnicodeDecodeError) as error:
        raise UpdateCheckError(UNREADABLE) from error
    if not isinstance(data, dict):
        raise UpdateCheckError(UNREADABLE)
    return data


def compare(current: str, release: dict) -> dict:
    """Compare the running version with a GitHub release object.

    Returns kind ("newer", "current", "dev" or "branch"), current, latest, url and notes.
    """
    tag = release.get("tag_name")
    latest = parse_version(tag) if isinstance(tag, str) else None
    if latest is None:
        raise UpdateCheckError(UNREADABLE)
    url = release.get("html_url")
    # Only an https:// page from the answer is opened. Anything else opens the Releases page.
    if not (isinstance(url, str) and url.startswith("https://")):
        url = RELEASES_URL
    notes = release.get("body")
    running = parse_version(current)
    if is_branch_build(current):
        kind = "branch"
    elif running is None:
        kind = "dev"
    elif running < latest:
        kind = "newer"
    else:
        kind = "current"
    return {
        "kind": kind,
        "current": f"v{str(current).strip().removeprefix('v')}",
        "latest": "v" + ".".join(str(part) for part in latest),
        "url": url,
        "notes": notes.strip() if isinstance(notes, str) else "",
    }


def check_for_updates(current: str, opener=urllib.request.urlopen) -> dict:
    """Ask GitHub for the latest release and compare it with current. Raises UpdateCheckError."""
    return compare(current, fetch_latest(current, opener))
