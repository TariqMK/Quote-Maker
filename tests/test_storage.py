"""Checks that custom styles and app state save, reload and survive damaged files."""

import base64
import sys
from pathlib import Path

import pytest

from quote_maker.app import PNG_SIGNATURE, decode_png
from quote_maker.storage import DATA_FOLDER_NAME, Storage, data_dir, safe_filename


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
        ('a<b>:c"/d\\e|f?g*', "abcdefg.png"),
        ("...", "quote.png"),
        ("", "quote.png"),
        ("CON", "quote.png"),
    ],
)
def test_safe_filename(name, expected):
    assert safe_filename(name) == expected


def test_decode_png_accepts_a_png_data_url():
    data = PNG_SIGNATURE + b"rest"
    url = "data:image/png;base64," + base64.b64encode(data).decode()
    assert decode_png(url) == data


@pytest.mark.parametrize(
    "url",
    [
        "data:image/jpeg;base64,AAAA",
        "data:image/png;base64,!!!",
        "data:image/png;base64," + base64.b64encode(b"not a png").decode(),
        None,
    ],
)
def test_decode_png_rejects_anything_else(url):
    with pytest.raises(ValueError):
        decode_png(url)
