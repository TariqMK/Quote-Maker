"""Checks the release scripts and the version the screenshot script shows."""

import importlib.util
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from quote_maker._version import __version__

ROOT = Path(__file__).parent.parent


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_script(name):
    return load_module(name, ROOT / ".github" / "scripts" / f"{name}.py")


next_version = load_script("next_version").next_version
check_bundle = load_script("check_bundle")


@pytest.fixture
def screenshots(monkeypatch):
    """Load the screenshot script without letting it contact the git remote."""
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: SimpleNamespace(stdout="v3.2.1\n"))
    return load_module("make_screenshots", ROOT / "assets" / "make_screenshots.py")


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        ([], None),
        (["latest", "v1.2", "v1.2.3-beta"], None),
        (["v1.9.0", "v1.10.0", "notes"], "1.10.0"),
        (["v2.0.0\n", "v1.99.99"], "2.0.0"),
    ],
)
def test_screenshots_show_the_newest_version_tag(screenshots, tags, expected):
    assert screenshots.newest_version(tags) == expected


def test_screenshots_read_the_version_from_the_repository(screenshots):
    assert screenshots.SHOWN_VERSION == "3.2.1"


def test_screenshots_can_read_the_source_version(screenshots):
    assert screenshots.source_version() == __version__


@pytest.mark.parametrize(
    ("tags", "bump", "expected"),
    [
        ([], "patch", "v0.0.1"),
        ([], "minor", "v0.1.0"),
        ([], "major", "v1.0.0"),
        (["v1.2.3"], "patch", "v1.2.4"),
        (["v1.2.3"], "minor", "v1.3.0"),
        (["v1.2.3"], "major", "v2.0.0"),
        (["v1.9.0", "v1.10.0"], "patch", "v1.10.1"),
        (["v2.0.0", "v1.99.99"], "patch", "v2.0.1"),
        (["latest", "v1.2", "1.2.3", "v1.2.3-beta", "v0.4.0\n"], "patch", "v0.4.1"),
        # A draft's tag appears in the release list even before it exists in git.
        (["v1.0.0", "v1.0.1", "v1.0.0"], "patch", "v1.0.2"),
    ],
)
def test_next_version(tags, bump, expected):
    assert next_version(tags, bump) == expected


def test_next_version_rejects_an_unknown_bump():
    with pytest.raises(ValueError):
        next_version([], "huge")


def real_web_files():
    return [p.relative_to(ROOT).as_posix() for p in (ROOT / "quote_maker" / "web").rglob("*")]


def test_bundle_check_passes_with_every_web_file():
    assert check_bundle.problems(real_web_files()) == []


def test_bundle_check_passes_inside_a_macos_app():
    names = [f"Contents/Resources/{name}" for name in real_web_files()]
    assert check_bundle.problems(names) == []


def test_bundle_check_reports_missing_files_and_fonts():
    names = [n for n in real_web_files() if not n.endswith((".woff2", "js/app.js"))]
    errors = check_bundle.problems(names)
    assert "Missing quote_maker/web/js/app.js" in errors
    assert any("font files" in error for error in errors)
