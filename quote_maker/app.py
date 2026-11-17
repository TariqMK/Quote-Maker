"""Opens the app window and gives the web interface access to files and saved styles."""

import argparse
import base64
import binascii
import sys
from pathlib import Path

import webview

from quote_maker._version import __version__
from quote_maker.storage import Storage, new_folder, safe_filename, safe_folder_name

WEB_DIR = Path(__file__).parent / "web"
# macOS ignores this and takes the window icon from the app bundle.
WINDOW_ICON = WEB_DIR / ("icon.ico" if sys.platform == "win32" else "icon.png")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"
# The image types the canvas can send: data URL prefix, file signature and save dialog filter.
IMAGE_TYPES = {
    "png": ("data:image/png;base64,", PNG_SIGNATURE, "PNG image (*.png)"),
    "jpg": ("data:image/jpeg;base64,", JPEG_SIGNATURE, "JPEG image (*.jpg;*.jpeg)"),
}
# Larger text files are refused, because an article is never this long.
MAX_TEXT_FILE_BYTES = 2_000_000


def decode_image(data_url: str) -> tuple[bytes, str]:
    """Convert a data URL from the canvas to image bytes and their type, "png" or "jpg".

    Anything that is not a PNG or JPEG image is rejected.
    """
    for kind, (prefix, signature, _) in IMAGE_TYPES.items():
        if isinstance(data_url, str) and data_url.startswith(prefix):
            try:
                data = base64.b64decode(data_url[len(prefix) :], validate=True)
            except binascii.Error as error:
                raise ValueError("The image data is damaged.") from error
            if not data.startswith(signature):
                raise ValueError("The image data does not match its type.")
            return data, kind
    raise ValueError("The image is not a PNG or JPEG data URL.")


def write_new_image(folder: Path, filename: str, data_url: str) -> Path:
    """Write one image into folder. An existing file is never replaced."""
    data, kind = decode_image(data_url)
    path = folder / safe_filename(filename, kind)
    with path.open("xb") as file:
        file.write(data)
    return path


def read_text_file(path: Path) -> dict:
    """Read a text file for the carousel. The file itself is never changed."""
    if path.stat().st_size > MAX_TEXT_FILE_BYTES:
        raise ValueError("The file is larger than 2 MB.")
    data = path.read_bytes()
    if data.startswith(b"\xef\xbb\xbf"):
        data = data[3:]
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        text = data.decode("cp1252", errors="replace")
    return {"name": path.stem, "text": text}


class Api:
    """Methods the web interface calls through window.pywebview.api."""

    def __init__(self, storage: Storage):
        # A leading underscore stops pywebview from exposing these objects to the page.
        self._storage = storage
        self._window = None
        # The folder the user chose for the current set of slides. Slides are written only here.
        self._export_folder = None

    def attach(self, window) -> None:
        self._window = window

    def get_version(self):
        return __version__

    def list_styles(self, kind="single"):
        return self._storage.list_styles(kind)

    def save_style(self, style, kind="single"):
        return self._storage.save_style(style, kind)

    def delete_style(self, style_id, kind="single"):
        return self._storage.delete_style(style_id, kind)

    def open_text_file(self):
        """Ask the user for a text file and return {name, text}, or None if cancelled."""
        chosen = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            file_types=("Text files (*.txt;*.md)", "All files (*.*)"),
        )
        if not chosen:
            return None
        return read_text_file(Path(chosen if isinstance(chosen, str) else chosen[0]))

    def load_state(self):
        return self._storage.load_state()

    def save_state(self, state):
        self._storage.save_state(state)

    def save_image(self, data_url, filename):
        """Ask the user where to save, then write the image. Return the path, or None if cancelled.

        The save dialog asks the user before it replaces a file of the same name.
        """
        data, kind = decode_image(data_url)
        chosen = self._window.create_file_dialog(
            webview.FileDialog.SAVE,
            save_filename=safe_filename(filename, kind),
            file_types=(IMAGE_TYPES[kind][2],),
        )
        if not chosen:
            return None
        path = Path(chosen if isinstance(chosen, str) else chosen[0])
        allowed = (".png",) if kind == "png" else (".jpg", ".jpeg")
        if path.suffix.lower() not in allowed:
            path = path.with_name(f"{path.name}.{kind}")
        path.write_bytes(data)
        return str(path)

    def choose_export_folder(self, name):
        """Ask where to save a set of slides, and make a new folder there named after the set.

        Returns the new folder's path, or None if cancelled.
        """
        chosen = self._window.create_file_dialog(webview.FileDialog.FOLDER)
        if not chosen:
            return None
        parent = Path(chosen if isinstance(chosen, str) else chosen[0])
        self._export_folder = new_folder(parent, safe_folder_name(name))
        return str(self._export_folder)

    def save_export_image(self, data_url, filename):
        """Write one slide into the folder from choose_export_folder. Returns the file's path."""
        if self._export_folder is None:
            raise ValueError("Choose a folder first.")
        return str(write_new_image(self._export_folder, filename, data_url))


def main() -> None:
    parser = argparse.ArgumentParser(description="Quote-Maker")
    parser.add_argument("--debug", action="store_true", help="open the developer tools")
    args = parser.parse_args()

    api = Api(Storage())
    window = webview.create_window(
        "Quote-Maker",
        url=str(WEB_DIR / "index.html"),
        js_api=api,
        width=1400,
        height=880,
        min_size=(1080, 680),
        background_color="#18181a",
    )
    api.attach(window)
    webview.start(debug=args.debug, private_mode=True, icon=str(WINDOW_ICON))


if __name__ == "__main__":
    main()
