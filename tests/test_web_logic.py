"""Runs the JavaScript logic tests with Node, so one pytest command covers the whole project."""

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is not installed")
def test_javascript_logic():
    folder = Path(__file__).parent
    files = [str(path) for path in sorted(folder.glob("*.test.mjs"))]
    assert files, "No JavaScript test files found."
    result = subprocess.run(
        ["node", "--test", *files], check=False, capture_output=True, text=True, encoding="utf-8"
    )
    assert result.returncode == 0, result.stdout + result.stderr
