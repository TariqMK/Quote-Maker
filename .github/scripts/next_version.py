"""Reads existing tags from stdin and prints the next vX.Y.Z tag.

Usage: next_version.py major|minor|patch
Anything that is not exactly vX.Y.Z is ignored. With no versions, the base is v0.0.0.
"""

import re
import sys

TAG = re.compile(r"v(\d+)\.(\d+)\.(\d+)")


def next_version(tags, bump):
    versions = [m.groups() for m in (TAG.fullmatch(t.strip()) for t in tags) if m]
    major, minor, patch = max(
        (tuple(int(part) for part in version) for version in versions), default=(0, 0, 0)
    )
    if bump == "major":
        return f"v{major + 1}.0.0"
    if bump == "minor":
        return f"v{major}.{minor + 1}.0"
    if bump == "patch":
        return f"v{major}.{minor}.{patch + 1}"
    raise ValueError(f"Unknown bump: {bump}")


if __name__ == "__main__":
    print(next_version(sys.stdin, sys.argv[1]))
