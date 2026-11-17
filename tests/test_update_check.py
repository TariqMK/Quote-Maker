"""Checks the update check without the network: versions, GitHub answers and every error message."""

import io
import json
import urllib.error

import pytest

from quotical.update_check import (
    API_URL,
    RELEASES_URL,
    UpdateCheckError,
    check_for_updates,
    compare,
    is_branch_build,
    parse_version,
)

RELEASE = {
    "tag_name": "v1.6.0",
    "html_url": "https://github.com/TariqMK/Quotical/releases/tag/v1.6.0",
    "body": "**Release Notes:**\n\n- Something new",
}


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def answer(body):
    """Return a stand-in for urlopen that records the request and gives back body."""
    seen = {}

    def opener(request, timeout):
        seen["request"] = request
        seen["timeout"] = timeout
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        return FakeResponse(data)

    opener.seen = seen
    return opener


def failing(error):
    def opener(request, timeout):
        raise error

    return opener


def http_error(code):
    return urllib.error.HTTPError(API_URL, code, "error", {}, None)


def test_versions_are_read_as_numbers():
    assert parse_version("v1.5.0") == (1, 5, 0)
    assert parse_version("1.5.0") == (1, 5, 0)
    assert parse_version("v0.10.0") > parse_version("v0.9.0")
    assert parse_version("0.0.0.dev0") is None
    assert parse_version("v1.6.0-new-sync.1") is None
    assert is_branch_build("v1.6.0-new-sync.1")
    assert not is_branch_build("1.6.0")


def test_one_request_to_github_with_only_the_two_headers():
    opener = answer(RELEASE)
    check_for_updates("1.5.0", opener)
    request = opener.seen["request"]
    assert request.full_url == API_URL
    assert request.get_method() == "GET"
    assert request.data is None
    assert {key.lower(): value for key, value in request.header_items()} == {
        "user-agent": "Quotical/1.5.0",
        "accept": "application/vnd.github+json",
    }
    assert opener.seen["timeout"] == 10


def test_a_newer_release_is_offered_with_its_page_and_notes():
    result = check_for_updates("1.5.0", answer(RELEASE))
    assert result == {
        "kind": "newer",
        "current": "v1.5.0",
        "latest": "v1.6.0",
        "url": RELEASE["html_url"],
        "notes": RELEASE["body"],
    }


def test_numbers_are_compared_as_numbers():
    assert compare("0.9.0", {"tag_name": "v0.10.0"})["kind"] == "newer"
    assert compare("0.10.0", {"tag_name": "v0.9.0"})["kind"] == "current"


def test_the_same_version_is_up_to_date():
    assert compare("1.6.0", RELEASE)["kind"] == "current"


def test_development_and_branch_builds_are_never_up_to_date():
    assert compare("0.0.0.dev0", RELEASE)["kind"] == "dev"
    assert compare("1.7.0-new-sync.1", RELEASE)["kind"] == "branch"


@pytest.mark.parametrize("url", [None, "", "http://github.com/x", "javascript:alert(1)", 5])
def test_only_an_https_release_page_is_used(url):
    assert compare("1.5.0", {**RELEASE, "html_url": url})["url"] == RELEASES_URL


@pytest.mark.parametrize(
    ("error", "message"),
    [
        (http_error(404), "No Quotical releases are published yet."),
        (http_error(403), "GitHub limits how often it can be checked. Try again in an hour."),
        (http_error(429), "GitHub limits how often it can be checked. Try again in an hour."),
        (http_error(500), "GitHub answered with error 500. Try again later."),
        (
            urllib.error.URLError("no route to host"),
            "Can't reach GitHub: no route to host. Check the internet connection.",
        ),
        (
            TimeoutError("timed out"),
            "Can't reach GitHub: timed out. Check the internet connection.",
        ),
    ],
)
def test_errors_are_written_for_the_user(error, message):
    with pytest.raises(UpdateCheckError) as raised:
        check_for_updates("1.5.0", failing(error))
    assert str(raised.value) == message


@pytest.mark.parametrize(
    "body", [b"not json", b"[1, 2]", {"tag_name": "latest"}, {"name": "no tag"}]
)
def test_an_unreadable_answer_is_reported(body):
    with pytest.raises(UpdateCheckError) as raised:
        check_for_updates("1.5.0", answer(body))
    assert str(raised.value) == "GitHub sent an answer Quotical can't read. Try again later."
