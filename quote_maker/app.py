"""Opens the app window and gives the web interface access to files and saved styles."""

import argparse
import base64
import binascii
from pathlib import Path

import webview

from quote_maker._version import __version__
from quote_maker.storage import Storage, safe_filename

WEB_DIR = Path(__file__).parent / "web"
PNG_PREFIX = "data:image/png;base64,"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def decode_png(data_url: str) -> bytes:
    """Convert the data URL from the canvas to PNG bytes. Reject anything that is not a PNG."""
    if not isinstance(data_url, str) or not data_url.startswith(PNG_PREFIX):
        raise ValueError("The image is not a PNG data URL.")
    try:
        png = base64.b64decode(data_url[len(PNG_PREFIX) :], validate=True)
    except binascii.Error as error:
        raise ValueError("The image data is damaged.") from error
    if not png.startswith(PNG_SIGNATURE):
        raise ValueError("The image is not a PNG.")
    return png


class Api:
    """Methods the web interface calls through window.pywebview.api."""

    def __init__(self, storage: Storage):
        # A leading underscore stops pywebview from exposing these objects to the page.
        self._storage = storage
        self._window = None

    def attach(self, window) -> None:
        self._window = window

    def get_version(self):
        return __version__

    def list_styles(self):
        return self._storage.list_styles()

    def save_style(self, style):
        return self._storage.save_style(style)

    def delete_style(self, style_id):
        return self._storage.delete_style(style_id)

    def load_state(self):
        return self._storage.load_state()

    def save_state(self, state):
        self._storage.save_state(state)

    def save_image(self, data_url, filename):
        """Ask the user where to save, then write the PNG. Return the path, or None if cancelled."""
        png = decode_png(data_url)
        chosen = self._window.create_file_dialog(
            webview.FileDialog.SAVE,
            save_filename=safe_filename(filename),
            file_types=("PNG image (*.png)",),
        )
        if not chosen:
            return None
        path = Path(chosen if isinstance(chosen, str) else chosen[0])
        if path.suffix.lower() != ".png":
            path = path.with_name(path.name + ".png")
        path.write_bytes(png)
        return str(path)


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
    webview.start(debug=args.debug, private_mode=True)


if __name__ == "__main__":
    main()
