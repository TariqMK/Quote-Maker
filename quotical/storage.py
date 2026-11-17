"""Reads and writes custom styles and app state as JSON files in a folder beside the app."""

import json
import os
import re
import sys
import uuid
from pathlib import Path

MAX_NAME_LENGTH = 60
DATA_FOLDER_NAME = "Quotical Data"
# The folder's name before the app was renamed. An old folder beside the app is renamed on first run.
OLD_DATA_FOLDER_NAME = "Quote-Maker Data"
# Each mode keeps its saved styles in its own file, because the kinds of style differ.
STYLE_FILES = {"single": "styles.json", "carousel": "carousel-styles.json", "post": "post-styles.json"}


def data_dir() -> Path:
    """Return the data folder beside the app, so the app stays portable.

    A packaged app keeps it beside the executable, or beside the .app bundle on macOS.
    A source run keeps it in the project folder.
    """
    return adopt_old_folder(_app_home() / DATA_FOLDER_NAME)


def _app_home() -> Path:
    if not getattr(sys, "frozen", False):
        return Path(__file__).resolve().parent.parent
    executable = Path(sys.executable).resolve()
    if sys.platform == "darwin":
        for parent in executable.parents:
            if parent.suffix == ".app":
                return parent.parent
    return executable.parent


def adopt_old_folder(folder: Path) -> Path:
    """Rename the data folder from before the app was renamed, so saved work carries over.

    If the rename fails, as in a read-only folder, the old folder is used as it is.
    """
    old = folder.with_name(OLD_DATA_FOLDER_NAME)
    if folder.exists() or not old.is_dir():
        return folder
    try:
        os.replace(old, folder)
    except OSError:
        return old
    return folder


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
        self.styles_path = self.folder / STYLE_FILES["single"]
        self.state_path = self.folder / "state.json"

    def _styles_path(self, kind: str) -> Path:
        if kind not in STYLE_FILES:
            raise ValueError(f"Unknown style kind: {kind}")
        return self.folder / STYLE_FILES[kind]

    def list_styles(self, kind: str = "single") -> list[dict]:
        styles = _read_json(self._styles_path(kind), [])
        if not isinstance(styles, list):
            return []
        return [s for s in styles if isinstance(s, dict) and s.get("id")]

    def save_style(self, style: dict, kind: str = "single") -> dict:
        """Add a style, or replace the saved style that has the same id."""
        if not isinstance(style, dict):
            raise TypeError("A style must be an object.")
        name = str(style.get("name") or "").strip()[:MAX_NAME_LENGTH]
        if not name:
            raise ValueError("A style must have a name.")
        saved = {**style, "name": name, "id": style.get("id") or f"custom-{uuid.uuid4().hex[:12]}"}
        styles = self.list_styles(kind)
        for index, existing in enumerate(styles):
            if existing["id"] == saved["id"]:
                styles[index] = saved
                break
        else:
            styles.append(saved)
        _write_json(self._styles_path(kind), styles)
        return saved

    def delete_style(self, style_id: str, kind: str = "single") -> bool:
        styles = self.list_styles(kind)
        kept = [s for s in styles if s["id"] != style_id]
        if len(kept) == len(styles):
            return False
        _write_json(self._styles_path(kind), kept)
        return True

    def load_state(self) -> dict:
        state = _read_json(self.state_path, {})
        return state if isinstance(state, dict) else {}

    def save_state(self, state: dict) -> None:
        _write_json(self.state_path, state)


def _safe_stem(name: str, fallback: str) -> str:
    """Remove characters and names that Windows, macOS or Linux do not allow in a file name."""
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", str(name)).strip(" .")
    stem = re.sub(r"\.(png|jpe?g)$", "", stem, flags=re.IGNORECASE)[:80].strip(" .")
    if not stem or re.fullmatch(r"(?i)con|prn|aux|nul|com\d|lpt\d", stem):
        stem = fallback
    return stem


def safe_filename(name: str, extension: str = "png") -> str:
    """Return an image file name that is valid on Windows, macOS and Linux."""
    return f"{_safe_stem(name, 'quote')}.{extension}"


def safe_folder_name(name: str) -> str:
    """Return a folder name for a set of slides that is valid on every system."""
    return _safe_stem(name, "Carousel")


def new_folder(parent: Path, name: str) -> Path:
    """Create a new folder in parent. A name already in use gets a number, so nothing is overwritten."""
    for number in range(1, 1000):
        folder = parent / (name if number == 1 else f"{name} ({number})")
        try:
            folder.mkdir()
            return folder
        except FileExistsError:
            continue
    raise FileExistsError(f"Could not find a free folder name for {name}.")
