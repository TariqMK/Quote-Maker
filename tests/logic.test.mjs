// Checks text cleanup, line breaking, size fitting and that every preset is valid.

import assert from "node:assert/strict";
import { test } from "node:test";

import { FONTS } from "../quote_maker/web/js/fonts.js";
import { breakLines, fitText } from "../quote_maker/web/js/layout.js";
import { DEFAULT_STYLE, PRESETS, withDefaults } from "../quote_maker/web/js/presets.js";
import {
  cleanQuote,
  isRtl,
  parseParagraphs,
  suggestFilename,
} from "../quote_maker/web/js/text.js";

test("cleanQuote removes pasted wrapping quotes and extra space", () => {
  assert.equal(cleanQuote('  "Hello   world"  '), "Hello world");
  assert.equal(cleanQuote("“Hello world”"), "Hello world");
});

test("cleanQuote keeps quotes when they are not one wrapping pair", () => {
  assert.equal(cleanQuote('"One" and "two"'), "“One” and “two”");
});

test("cleanQuote makes punctuation typographic", () => {
  assert.equal(cleanQuote("don't -- wait..."), "don’t — wait…");
});

test("cleanQuote keeps single line breaks and limits blank lines", () => {
  assert.equal(cleanQuote("a\r\nb\n\n\n\nc"), "a\nb\n\nc");
});

test("parseParagraphs marks emphasis across words and inside a word", () => {
  const [{ words }] = parseParagraphs("the *very best* un*real*");
  assert.deepEqual(words.map((w) => w.parts.map((p) => [p.text, p.em])), [
    [["the", false]],
    [["very", true]],
    [["best", true]],
    [["un", false], ["real", true]],
  ]);
});

test("parseParagraphs keeps an unpaired star as a character", () => {
  const [{ words }] = parseParagraphs("5 * 3");
  assert.deepEqual(words.map((w) => w.text), ["5", "*", "3"]);
});

test("parseParagraphs records a gap only after a blank line", () => {
  const paragraphs = parseParagraphs("a\nb\n\nc");
  assert.deepEqual(paragraphs.map((p) => p.gap), [false, false, true]);
});

test("isRtl detects the direction from the first letter", () => {
  assert.equal(isRtl("مرحبا hello"), true);
  assert.equal(isRtl("hello مرحبا"), false);
  assert.equal(isRtl("123"), false);
});

test("suggestFilename uses the first words and the author", () => {
  assert.equal(
    suggestFilename("Don't *stop* now, friend", "Ada Lovelace"),
    "dont-stop-now-friend--ada-lovelace",
  );
  assert.equal(suggestFilename("", ""), "quote");
});

test("breakLines fills lines when not balancing", () => {
  assert.deepEqual(breakLines([40, 40, 40, 40], 10, 100, false), [[0, 2], [2, 4]]);
});

test("breakLines balanced avoids one word alone on the last line", () => {
  const lines = breakLines([30, 30, 30, 30, 30], 5, 100, true);
  assert.notEqual(lines.at(-1)[1] - lines.at(-1)[0], 1);
});

test("breakLines puts a too-long word on its own line without looping", () => {
  assert.deepEqual(breakLines([500], 10, 100, true), [[0, 1]]);
});

const options = (overrides = {}) => ({
  maxWidth: 400,
  maxHeight: 400,
  maxSize: 100,
  minSize: 10,
  lineHeight: 1.2,
  paragraphGap: 0.6,
  balance: true,
  space100: 25,
  ...overrides,
});
const paragraph = (count, width100 = 200) => {
  const words = Array.from({ length: count }, () => ({ text: "word", parts: [] }));
  return { words, widths100: words.map(() => width100), gap: false };
};

test("fitText uses the largest size when short text fits", () => {
  assert.equal(fitText([paragraph(2, 100)], options()).size, 100);
});

test("fitText shrinks long text until it fits the height", () => {
  const result = fitText([paragraph(80)], options());
  assert.ok(result.size < 100);
  assert.ok(result.height <= 400);
  assert.ok(result.lines.every((line) => line.width <= 400 + 1));
});

test("fitText shrinks so the widest word never overflows", () => {
  const result = fitText([paragraph(1, 2000)], options());
  assert.ok((2000 * result.size) / 100 <= 400);
});

test("fitText handles empty text", () => {
  const result = fitText([], options());
  assert.equal(result.height, 0);
  assert.deepEqual(result.lines, []);
});

test("withDefaults fills in values a saved style is missing", () => {
  const style = withDefaults({ quote: { font: "Inter" } });
  assert.equal(style.quote.font, "Inter");
  assert.equal(style.quote.lineHeight, DEFAULT_STYLE.quote.lineHeight);
  assert.notEqual(style.frame, DEFAULT_STYLE.frame);
});

test("presets have unique ids and only use bundled fonts", () => {
  assert.ok(PRESETS.length >= 24);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  const families = new Set(FONTS.map((f) => f.family));
  for (const preset of PRESETS) {
    for (const part of [preset.quote, preset.mark, preset.author, preset.source]) {
      assert.ok(families.has(part.font), `${preset.name} uses ${part.font}`);
    }
  }
});

test("presets contain only style values the app knows about", () => {
  const check = (value, known, where) => {
    for (const key of Object.keys(value)) {
      if (where === "" && ["id", "name", "category"].includes(key)) continue;
      assert.ok(key in known, `Unknown value ${where}${key}`);
      if (typeof known[key] === "object") check(value[key], known[key], `${where}${key}.`);
    }
  };
  PRESETS.forEach((preset) => check(preset, DEFAULT_STYLE, ""));
});
