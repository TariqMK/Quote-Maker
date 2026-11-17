// Checks article parsing, slide paging, carousel layout and the built-in carousel styles.

import assert from "node:assert/strict";
import { test } from "node:test";

import { CAROUSEL_PRESETS, DEFAULT_CAROUSEL_STYLE, withCarouselDefaults } from "../quotical/web/js/carousel-presets.js";
import { layoutCarousel, paginate } from "../quotical/web/js/carousel.js";
import { FONTS } from "../quotical/web/js/fonts.js";
import { cleanArticle, parseArticle, splitSlides } from "../quotical/web/js/text.js";

const words = (paragraph) => paragraph.words.map((w) => w.text).join(" ");
const looks = (text) => parseArticle(text).flatMap((p) => p.words.flatMap((w) => w.parts.map((x) => [x.text, x.look])));

// Article text

test("single line breaks join, and a blank line starts a new paragraph", () => {
  const paragraphs = parseArticle("one\ntwo\n\nthree");
  assert.deepEqual(paragraphs.map(words), ["one two", "three"]);
  assert.deepEqual(paragraphs.map((p) => p.gap), [false, true]);
  assert.deepEqual(paragraphs.map((p) => p.block), [0, 1]);
});

test("kept line breaks give one paragraph per line in the same block", () => {
  const paragraphs = parseArticle("roses are red\nviolets are blue\n\nnext", { keepLineBreaks: true });
  assert.deepEqual(paragraphs.map(words), ["roses are red", "violets are blue", "next"]);
  assert.deepEqual(paragraphs.map((p) => p.block), [0, 0, 1]);
  assert.deepEqual(paragraphs.map((p) => p.gap), [false, false, true]);
});

test("double stars make bold, single stars make italic, and triple stars make both", () => {
  assert.deepEqual(looks("a **bold** and *slanted* and ***both***"), [
    ["a", ""], ["bold", "b"], ["and", ""], ["slanted", "i"], ["and", ""], ["both", "bi"],
  ]);
});

test("a star with no partner stays as a character", () => {
  assert.deepEqual(looks("5 * 3 = 15"), [["5", ""], ["*", ""], ["3", ""], ["=", ""], ["15", ""]]);
  assert.deepEqual(looks("**open only"), [["**open", ""], ["only", ""]]);
});

test("emphasis continues over a joined line break", () => {
  assert.deepEqual(looks("*one\ntwo*"), [["one", "i"], ["two", "i"]]);
});

test("highlights and bold combine", () => {
  const parts = parseArticle("**[yellow: key words]** here").flatMap((p) => p.words.flatMap((w) => w.parts));
  assert.deepEqual(parts.map((p) => [p.text, p.look, p.hl]), [
    ["key", "b", "#ffe14d"], ["words", "b", "#ffe14d"], ["here", "", null],
  ]);
});

test("a [slide] line splits the text into sections", () => {
  assert.deepEqual(splitSlides("one\n[slide]\ntwo\n  [SLIDE]  \nthree"), ["one", "two", "three"]);
  assert.deepEqual(splitSlides("keep [slide] inside a line"), ["keep [slide] inside a line"]);
});

test("article cleanup keeps quote marks around the whole text", () => {
  assert.equal(cleanArticle('"Hello" -- world...'), "“Hello” — world…");
});

// Paging

const page = (sections, firstLines, otherLines = firstLines, gapHeight = 0) =>
  paginate(sections, { firstHeight: firstLines * 10, otherHeight: otherLines * 10, lineHeight: 10, gapHeight }).map(
    (slide) => slide.map((p) => `${p.section}.${p.block}:${p.from}-${p.to}`),
  );

test("blocks that fit share one slide", () => {
  assert.deepEqual(page([[3, 4]], 10), [["0.0:0-3", "0.1:0-4"]]);
});

test("the paragraph gap counts toward the space used", () => {
  assert.deepEqual(page([[5, 5]], 10, 10, 1), [["0.0:0-5"], ["0.1:0-5"]]);
});

test("slide 1 has less room when the title takes space", () => {
  assert.deepEqual(page([[6]], 4, 10), [["0.0:0-4"], ["0.0:4-6"]]);
});

test("a block moves whole when the slide is at least half full", () => {
  assert.deepEqual(page([[6, 6]], 10), [["0.0:0-6"], ["0.1:0-6"]]);
});

test("a block splits when the slide is less than half full", () => {
  assert.deepEqual(page([[3, 9]], 10), [["0.0:0-3", "0.1:0-7"], ["0.1:7-9"]]);
});

test("a split never leaves one line alone on either slide", () => {
  // 9 free lines and 10 lines to place: 9 + 1 would strand a line, so 8 + 2.
  assert.deepEqual(page([[1, 10]], 10), [["0.0:0-1", "0.1:0-8"], ["0.1:8-10"]]);
  // 1 free line: too few to start the block here, so it moves on.
  assert.deepEqual(page([[9, 5]], 10), [["0.0:0-9"], ["0.1:0-5"]]);
});

test("a block longer than a whole slide continues over several slides", () => {
  assert.deepEqual(page([[25]], 10), [["0.0:0-10"], ["0.0:10-20"], ["0.0:20-25"]]);
});

test("each [slide] section starts a new slide", () => {
  assert.deepEqual(page([[2], [2]], 10), [["0.0:0-2"], ["1.0:0-2"]]);
});

test("text that starts with [slide] leaves slide 1 for the title", () => {
  assert.deepEqual(page([[], [2]], 5, 10), [[], ["1.0:0-2"]]);
});

test("a [slide] at the end or twice in a row adds no empty slide", () => {
  assert.deepEqual(page([[2], [], [2], []], 10), [["0.0:0-2"], ["2.0:0-2"]]);
});

test("a title that fills slide 1 sends the body to slide 2", () => {
  assert.deepEqual(page([[3]], 0, 10), [[], ["0.0:0-3"]]);
});

test("text too large for any slide still places one line per slide and ends", () => {
  // Slide 1 counts as filled by the title, so the lines start on slide 2.
  assert.deepEqual(page([[3]], 0.5, 0.5), [[], ["0.0:0-1"], ["0.0:1-2"], ["0.0:2-3"]]);
});

test("empty text gives one empty slide", () => {
  assert.deepEqual(page([[]], 10), [[]]);
});

// Full layout with a stand-in canvas: each character is half the font size wide.

function fakeContext() {
  return {
    font: "",
    save() {},
    restore() {},
    measureText(text) {
      const size = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 10);
      return { width: [...text].length * size * 0.5 };
    },
  };
}

const ARTICLE = Array.from({ length: 14 }, (_, i) =>
  `Paragraph ${i + 1} has **some** words in it, and *enough* of them to wrap over several lines on a slide.`,
).join("\n\n");

test("every slide's body fits inside the margins for every preset and size", () => {
  for (const style of CAROUSEL_PRESETS) {
    for (const [width, height] of [[1080, 1350], [1080, 1080], [1080, 1440]]) {
      const layout = layoutCarousel(fakeContext(), {
        width, height, title: "A title long enough to wrap onto a second line", subtitle: "By someone", text: ARTICLE, style,
      });
      assert.ok(layout.slides.length > 1, `${style.name} ${width}x${height} makes several slides`);
      layout.slides.forEach((slide, i) => {
        assert.ok(!slide.overflow, `${style.name} ${width}x${height} slide ${i + 1} overflows`);
        for (const part of slide.parts) {
          for (const line of part.lines) assert.ok(line.width <= layout.contentWidth + 0.01);
        }
      });
      const placed = layout.slides.flatMap((s) => s.parts.flatMap((p) => p.lines.flatMap((l) => l.words)));
      assert.equal(placed.length, ARTICLE.split(/\s+/).length, `${style.name} keeps every word once`);
    }
  }
});

test("a longer title leaves less body on slide 1", () => {
  const style = withCarouselDefaults({});
  const lines = (title) =>
    layoutCarousel(fakeContext(), { width: 1080, height: 1350, title, text: ARTICLE, style }).slides[0].parts
      .reduce((sum, p) => sum + p.lines.length, 0);
  assert.ok(lines("Short") > lines("A much longer title that needs three or four lines on the first slide of this carousel"));
});

// Styles

test("carousel presets have unique ids and use bundled fonts that have bold and italic", () => {
  assert.ok(CAROUSEL_PRESETS.length >= 4);
  assert.equal(new Set(CAROUSEL_PRESETS.map((p) => p.id)).size, CAROUSEL_PRESETS.length);
  const byName = new Map(FONTS.map((f) => [f.family, f]));
  for (const preset of CAROUSEL_PRESETS) {
    for (const part of [preset.title, preset.subtitle, preset.body, preset.pageNumber]) {
      assert.ok(byName.has(part.font), `${preset.name} uses ${part.font}`);
    }
    const body = byName.get(preset.body.font);
    assert.ok(body.italic, `${preset.name} body font has italics`);
    assert.ok(body.max >= preset.body.weight + 200, `${preset.name} body font has a bold weight`);
  }
});

test("carousel presets contain only style values the app knows about", () => {
  const check = (value, base, path) => {
    for (const key of Object.keys(value)) {
      if (path === "" && ["id", "name"].includes(key)) continue;
      assert.ok(key in base, `unknown value ${path}${key}`);
      if (base[key] && typeof base[key] === "object") check(value[key], base[key], `${path}${key}.`);
    }
  };
  CAROUSEL_PRESETS.forEach((preset) => check(preset, DEFAULT_CAROUSEL_STYLE, ""));
});
