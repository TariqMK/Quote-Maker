"""Reads and writes custom styles and app state as JSON files in a folder beside the app."""

import json
import os
import re
import sys
import uuid
from pathlib import Path

MAX_NAME_LENGTH = 60
DATA_FOLDER_NAME = "Quote-Maker Data"


def data_dir() -> Path:
    """Return the data folder beside the app, so the app stays portable.

    A packaged app keeps it beside the executable, or beside the .app bundle on macOS.
    A source run keeps it in the project folder.
    """
    if not getattr(sys, "frozen", False):
        return Path(__file__).resolve().parent.parent / DATA_FOLDER_NAME
    executable = Path(sys.executable).resolve()
    if sys.platform == "darwin":
        for parent in executable.parents:
            if parent.suffix == ".app":
                return parent.parent / DATA_FOLDER_NAME
    return executable.parent / DATA_FOLDER_NAME


def _write_json(path: Path, value) -> None:
    """Write through a temporary file, so a crash cannot leave a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, path)


def _read_json(path: Path, default):
    """Read a JSON file. Keep a damaged file as a .damaged copy instead of losing it."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError:
        return default
    except (json.JSONDecodeError, UnicodeDecodeError):
        try:
            os.replace(path, path.with_name(path.name + ".damaged"))
        except OSError:
            pass  # In a read-only folder the file stays as it is, and is not overwritten.
        return default


class Storage:
    def __init__(self, folder: Path | None = None):
        self.folder = Path(folder) if folder else data_dir()
        self.styles_path = self.folder / "styles.json"
        self.state_path = self.folder / "state.json"

    def list_styles(self) -> list[dict]:
        styles = _read_json(self.styles_path, [])
        if not isinstance(styles, list):
            return []
        return [s for s in styles if isinstance(s, dict) and s.get("id")]

    def save_style(self, style: dict) -> dict:
        """Add a style, or replace the saved style that has the same id."""
        if not isinstance(style, dict):
            raise TypeError("A style must be an object.")
        name = str(style.get("name") or "").strip()[:MAX_NAME_LENGTH]
        if not name:
            raise ValueError("A style must have a name.")
        saved = {**style, "name": name, "id": style.get("id") or f"custom-{uuid.uuid4().hex[:12]}"}
        styles = self.list_styles()
        for index, existing in enumerate(styles):
            if existing["id"] == saved["id"]:
                styles[index] = saved
                break
        else:
            styles.append(saved)
        _write_json(self.styles_path, styles)
        return saved

    def delete_style(self, style_id: str) -> bool:
        styles = self.list_styles()
        kept = [s for s in styles if s["id"] != style_id]
        if len(kept) == len(styles):
            return False
        _write_json(self.styles_path, kept)
        return True

    def load_state(self) -> dict:
        state = _read_json(self.state_path, {})
        return state if isinstance(state, dict) else {}

    def save_state(self, state: dict) -> None:
        _write_json(self.state_path, state)


def safe_filename(name: str) -> str:
    """Return a PNG file name that is valid on Windows, macOS and Linux."""
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", str(name)).strip(" .")
    stem = re.sub(r"\.png$", "", stem, flags=re.IGNORECASE)[:80].strip(" .")
    if not stem or re.fullmatch(r"(?i)con|prn|aux|nul|com\d|lpt\d", stem):
        stem = "quote"
    return f"{stem}.png"
