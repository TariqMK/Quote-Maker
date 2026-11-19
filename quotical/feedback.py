"""Builds the link for Report a Problem: the GitHub bug form with the version and system filled in.

The app sends nothing itself. It opens the link in the user's browser, and nothing reaches GitHub
until the user submits the form there. Only the version and the system name go in the link.
"""

import platform
import sys
import urllib.parse

from quotical.update_check import REPO

BUG_FORM_URL = f"https://github.com/{REPO}/issues/new"


def system_name() -> str:
    """Return the system as the bug form's placeholder shows it, such as "macOS 26.1"."""
    if sys.platform == "darwin":
        release = platform.mac_ver()[0]
        return f"macOS {release}" if release else "macOS"
    if sys.platform == "win32":
        # Windows 11 still reports release "10". Its build numbers start at 22000.
        release = platform.release()
        build = platform.version().split(".")[-1]
        if release == "10" and build.isdigit() and int(build) >= 22000:
            release = "11"
        return f"Windows {release}" if release else "Windows"
    if sys.platform.startswith("linux"):
        try:
            info = platform.freedesktop_os_release()
        except OSError:
            info = {}
        name = info.get("NAME", "Linux")
        version = info.get("VERSION_ID", "")
        return f"{name} {version}".strip()
    return f"{platform.system()} {platform.release()}".strip() or "Unknown"


def report_url(version: str, system: str) -> str:
    """Return the bug form link with the version and system filled in."""
    query = urllib.parse.urlencode(
        {"template": "bug.yml", "version": str(version).strip().removeprefix("v"), "os": system},
        quote_via=urllib.parse.quote,
    )
    return f"{BUG_FORM_URL}?{query}"
