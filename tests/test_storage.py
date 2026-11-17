"""Checks that custom styles and app state save, reload and survive damaged files."""

import base64
import sys
from pathlib import Path

import pytest

from quote_maker.app import (
    JPEG_SIGNATURE,
    MAX_TEXT_FILE_BYTES,
    PNG_SIGNATURE,
    Api,
    decode_image,
    read_text_file,
    write_new_image,
)
from quote_maker.storage import (
    DATA_FOLDER_NAME,
    Storage,
    data_dir,
    new_folder,
    safe_filename,
    safe_folder_name,
)


@pytest.fixture
def storage(tmp_path):
    return Storage(tmp_path / "data")


def test_source_run_keeps_data_in_the_project_folder():
    assert data_dir() == Path(__file__).resolve().parent.parent / DATA_FOLDER_NAME


def test_default_storage_uses_the_folder_beside_the_app():
    assert Storage().folder == data_dir()


@pytest.mark.parametrize(
    ("platform", "executable", "expected_parent"),
    [
        ("win32", "Tools/Quote-Maker.exe", "Tools"),
        ("linux", "Tools/Quote-Maker", "Tools"),
        ("darwin", "Tools/Quote-Maker.app/Contents/MacOS/Quote-Maker", "Tools"),
    ],
)
def test_packaged_app_keeps_data_beside_the_app(
    monkeypatch, tmp_path, platform, executable, expected_parent
):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "platform", platform)
    monkeypatch.setattr(sys, "executable", str(tmp_path / executable))
    assert data_dir() == (tmp_path / expected_parent).resolve() / DATA_FOLDER_NAME


def test_nothing_is_created_until_something_is_saved(storage):
    storage.list_styles()
    storage.load_state()
    assert not storage.folder.exists()


def test_writing_to_an_unusable_folder_raises_and_reading_returns_defaults(tmp_path):
    blocked = tmp_path / "blocked"
    blocked.write_text("a file, not a folder", encoding="utf-8")
    unusable = Storage(blocked)
    assert unusable.list_styles() == []
    assert unusable.load_state() == {}
    with pytest.raises(OSError):
        unusable.save_style({"name": "Mine"})
    with pytest.raises(OSError):
        unusable.save_state({"quote": "text"})


def test_list_is_empty_before_anything_is_saved(storage):
    assert storage.list_styles() == []
    assert storage.load_state() == {}


def test_new_style_gets_an_id_and_reloads(storage):
    saved = storage.save_style({"name": "  Mine  ", "quote": {"size": 80}})
    assert saved["id"].startswith("custom-")
    assert saved["name"] == "Mine"
    assert Storage(storage.folder).list_styles() == [saved]


def test_saving_with_the_same_id_replaces_the_style(storage):
    first = storage.save_style({"name": "One"})
    storage.save_style({**first, "name": "Two"})
    styles = storage.list_styles()
    assert len(styles) == 1
    assert styles[0]["name"] == "Two"


def test_style_without_a_name_is_rejected(storage):
    with pytest.raises(ValueError):
        storage.save_style({"name": "   "})


def test_delete_removes_only_the_named_style(storage):
    keep = storage.save_style({"name": "Keep"})
    drop = storage.save_style({"name": "Drop"})
    assert storage.delete_style(drop["id"]) is True
    assert storage.delete_style("missing") is False
    assert storage.list_styles() == [keep]


def test_damaged_styles_file_is_kept_and_not_overwritten(storage):
    storage.folder.mkdir(parents=True)
    storage.styles_path.write_text("{not json", encoding="utf-8")
    assert storage.list_styles() == []
    kept = storage.folder / "styles.json.damaged"
    assert kept.read_text(encoding="utf-8") == "{not json"


def test_state_round_trip_keeps_non_ascii_text(storage):
    storage.save_state({"quote": "Café — مرحبا"})
    assert storage.load_state()["quote"] == "Café — مرحبا"


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("my-quote", "my-quote.png"),
        ("my-quote.PNG", "my-quote.png"),
        ("slide.jpeg", "slide.png"),
        ('a<b>:c"/d\\e|f?g*', "abcdefg.png"),
        ("...", "quote.png"),
        ("", "quote.png"),
        ("CON", "quote.png"),
    ],
)
def test_safe_filename(name, expected):
    assert safe_filename(name) == expected


def data_url(kind, data):
    mime = "image/png" if kind == "png" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(data).decode()


PNG = PNG_SIGNATURE + b"rest"
JPEG = JPEG_SIGNATURE + b"rest"


def test_decode_image_accepts_png_and_jpeg():
    assert decode_image(data_url("png", PNG)) == (PNG, "png")
    assert decode_image(data_url("jpg", JPEG)) == (JPEG, "jpg")


@pytest.mark.parametrize(
    "url",
    [
        "data:image/gif;base64,AAAA",
        "data:image/png;base64,!!!",
        "data:image/png;base64," + base64.b64encode(b"not a png").decode(),
        "data:image/jpeg;base64," + base64.b64encode(PNG_SIGNATURE).decode(),
        None,
    ],
)
def test_decode_image_rejects_anything_else(url):
    with pytest.raises(ValueError):
        decode_image(url)


def test_safe_filename_uses_the_image_type():
    assert safe_filename("slide-01", "jpg") == "slide-01.jpg"
    assert safe_filename("slide-01.png", "jpg") == "slide-01.jpg"


def test_safe_folder_name():
    assert safe_folder_name('Five habits: "clear" writing?') == "Five habits clear writing"
    assert safe_folder_name("  ") == "Carousel"


def test_new_folder_never_reuses_an_existing_folder(tmp_path):
    (tmp_path / "Slides").mkdir()
    (tmp_path / "Slides" / "keep.png").write_bytes(b"mine")
    assert new_folder(tmp_path, "Slides") == tmp_path / "Slides (2)"
    assert new_folder(tmp_path, "Slides") == tmp_path / "Slides (3)"
    assert (tmp_path / "Slides" / "keep.png").read_bytes() == b"mine"


def test_write_new_image_never_replaces_a_file(tmp_path):
    path = write_new_image(tmp_path, "slide-01", data_url("jpg", JPEG))
    assert path == tmp_path / "slide-01.jpg" and path.read_bytes() == JPEG
    with pytest.raises(FileExistsError):
        write_new_image(tmp_path, "slide-01", data_url("jpg", JPEG_SIGNATURE + b"other"))
    assert path.read_bytes() == JPEG


class FakeWindow:
    """Stands in for the pywebview window and answers its file dialogs."""

    def __init__(self, answer):
        self.answer = answer

    def create_file_dialog(self, *args, **kwargs):
        return self.answer


def test_export_writes_slides_into_a_new_folder(tmp_path, storage):
    api = Api(storage)
    api.attach(FakeWindow((str(tmp_path),)))
    folder = Path(api.choose_export_folder("Five habits"))
    assert folder == tmp_path / "Five habits"
    for number in (1, 2):
        api.save_export_image(data_url("png", PNG), f"five-habits-0{number}")
    assert sorted(p.name for p in folder.iterdir()) == ["five-habits-01.png", "five-habits-02.png"]


def test_export_needs_a_folder_and_a_cancel_writes_nothing(tmp_path, storage):
    api = Api(storage)
    with pytest.raises(ValueError):
        api.save_export_image(data_url("png", PNG), "slide")
    api.attach(FakeWindow(None))
    assert api.choose_export_folder("Five habits") is None
    assert not list(tmp_path.iterdir())


def test_save_image_adds_the_extension_for_its_type(tmp_path, storage):
    api = Api(storage)
    api.attach(FakeWindow(str(tmp_path / "chosen")))
    assert api.save_image(data_url("jpg", JPEG), "quote") == str(tmp_path / "chosen.jpg")
    assert (tmp_path / "chosen.jpg").read_bytes() == JPEG


def test_carousel_styles_are_kept_apart_from_quote_styles(storage):
    quote = storage.save_style({"name": "Quote style"})
    slide = storage.save_style({"name": "Slide style"}, "carousel")
    assert [s["id"] for s in storage.list_styles()] == [quote["id"]]
    assert [s["id"] for s in storage.list_styles("carousel")] == [slide["id"]]
    assert (storage.folder / "carousel-styles.json").exists()
    assert storage.delete_style(quote["id"], "carousel") is False
    assert storage.delete_style(slide["id"], "carousel") is True
    assert storage.list_styles("carousel") == []
    assert len(storage.list_styles()) == 1


def test_unknown_style_kind_is_rejected(storage):
    with pytest.raises(ValueError):
        storage.list_styles("../outside")


def test_text_file_reads_utf8_and_older_windows_text(tmp_path):
    utf8 = tmp_path / "Article.md"
    utf8.write_bytes(b"\xef\xbb\xbfCaf\xc3\xa9 **bold**")
    assert read_text_file(utf8) == {"name": "Article", "text": "Café **bold**"}
    old = tmp_path / "old.txt"
    old.write_bytes(b"Caf\xe9")
    assert read_text_file(old)["text"] == "Café"
    assert utf8.read_bytes().startswith(b"\xef\xbb\xbf")


def test_text_file_over_the_limit_is_refused(tmp_path):
    big = tmp_path / "big.txt"
    big.write_bytes(b"a" * (MAX_TEXT_FILE_BYTES + 1))
    with pytest.raises(ValueError):
        read_text_file(big)
