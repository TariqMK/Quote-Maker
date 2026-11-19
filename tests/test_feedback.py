# Tests for Report a Problem: the bug form link and the system name that goes in it.

import urllib.parse

import pytest

from quotical import feedback


def query(url):
    return urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)


def test_link_opens_the_bug_form_with_version_and_system():
    url = feedback.report_url("v1.6.0", "macOS 26.1")
    assert url.startswith("https://github.com/TariqMK/Quotical/issues/new?")
    assert query(url) == {"template": ["bug.yml"], "version": ["1.6.0"], "os": ["macOS 26.1"]}


def test_spaces_and_symbols_are_encoded():
    url = feedback.report_url("1.6.0", "Ubuntu & Friends 24.04")
    assert " " not in url
    assert "os=Ubuntu%20%26%20Friends%2024.04" in url
    assert query(url)["os"] == ["Ubuntu & Friends 24.04"]


def test_a_development_version_goes_in_as_it_is():
    assert query(feedback.report_url("0.0.0.dev0", "Windows 11"))["version"] == ["0.0.0.dev0"]


def test_only_the_template_version_and_system_are_sent():
    assert set(query(feedback.report_url("1.6.0", "Windows 11"))) == {"template", "version", "os"}


def test_macos_name(monkeypatch):
    monkeypatch.setattr(feedback.sys, "platform", "darwin")
    monkeypatch.setattr(feedback.platform, "mac_ver", lambda: ("26.1", ("", "", ""), "arm64"))
    assert feedback.system_name() == "macOS 26.1"


@pytest.mark.parametrize(
    ("release", "version", "expected"),
    [("10", "10.0.22631", "Windows 11"), ("10", "10.0.19045", "Windows 10")],
)
def test_windows_11_is_told_apart_from_windows_10(monkeypatch, release, version, expected):
    monkeypatch.setattr(feedback.sys, "platform", "win32")
    monkeypatch.setattr(feedback.platform, "release", lambda: release)
    monkeypatch.setattr(feedback.platform, "version", lambda: version)
    assert feedback.system_name() == expected


def test_linux_name_comes_from_os_release(monkeypatch):
    monkeypatch.setattr(feedback.sys, "platform", "linux")
    monkeypatch.setattr(
        feedback.platform, "freedesktop_os_release", lambda: {"NAME": "Ubuntu", "VERSION_ID": "24.04"}
    )
    assert feedback.system_name() == "Ubuntu 24.04"


def test_linux_without_os_release(monkeypatch):
    def missing():
        raise OSError("no os-release file")

    monkeypatch.setattr(feedback.sys, "platform", "linux")
    monkeypatch.setattr(feedback.platform, "freedesktop_os_release", missing)
    assert feedback.system_name() == "Linux"


def test_report_problem_opens_the_browser_and_nothing_else(monkeypatch, tmp_path):
    from quotical import app
    from quotical.storage import Storage

    opened = []
    monkeypatch.setattr(app.webbrowser, "open", opened.append)
    monkeypatch.setattr(app, "system_name", lambda: "macOS 26.1")
    monkeypatch.setattr(app, "__version__", "1.6.0")
    app.Api(Storage(tmp_path)).report_problem()
    assert opened == [
        "https://github.com/TariqMK/Quotical/issues/new?template=bug.yml&version=1.6.0&os=macOS%2026.1"
    ]
