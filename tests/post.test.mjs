// Tests the Post mode layout and styles: every part stays inside the image, and text shrinks to fit.

import assert from "node:assert/strict";
import { test } from "node:test";

import { FONTS } from "../quotical/web/js/fonts.js";
import { initials, layoutPost } from "../quotical/web/js/post.js";
import {
  DEFAULT_POST_STYLE,
  POST_CATEGORIES,
  POST_KINDS,
  POST_PRESETS,
  withPostDefaults,
} from "../quotical/web/js/post-presets.js";

// A stand-in canvas: each character is half the font size wide.
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

const SIZES = [[1080, 1080], [1080, 1350], [1200, 675], [1080, 1920]];
const SHORT = "Clear writing is a set of *small habits*.\n\nAnyone can **learn** them.";
const LONG = Array.from({ length: 30 }, (_, i) => `Sentence ${i + 1} adds a few more words to a long post.`).join("\n");
const INPUT = { name: "Alex Rivera", handle: "@alexwrites", date: "9:41 AM · Nov 17, 2026", verified: true };

const layout = (style, text, [width, height] = [1080, 1080], extra = {}) =>
  layoutPost(fakeContext(), { ...INPUT, width, height, text, style, ...extra });

const wordCount = (text) => text.replace(/\*/g, "").split(/\s+/).filter(Boolean).length;

test("every part of every preset stays inside the image at every size", () => {
  for (const style of POST_PRESETS) {
    for (const size of SIZES) {
      for (const text of [SHORT, LONG]) {
        const result = layout(style, text, size);
        const [width, height] = size;
        const label = `${style.name} ${width}x${height} ${text === LONG ? "long" : "short"}`;
        const { card } = result;
        assert.ok(card.x >= 0 && card.x + card.w <= width + 0.01, `${label}: card fits across`);
        assert.ok(card.y >= -0.01 && card.y + card.h <= height + 0.01, `${label}: card fits down`);
        for (const line of result.body.fitted.lines) {
          assert.ok(line.width <= result.body.w + 0.01, `${label}: body line fits`);
        }
        const bodyBottom = result.body.y + result.body.fitted.height;
        assert.ok(result.body.y >= card.y - 0.01 && bodyBottom <= card.y + card.h + 0.01, `${label}: body inside card`);
        if (result.media) {
          assert.ok(result.body.y >= result.media.y - 0.01, `${label}: body inside photo square`);
          assert.ok(bodyBottom <= result.media.y + result.media.h + 0.01, `${label}: body inside photo square`);
        }
        for (const icon of result.icons) {
          assert.ok(icon.x >= card.x && icon.x + icon.size <= card.x + card.w + 0.01, `${label}: icon inside card`);
        }
        const placed = result.body.fitted.lines.flatMap((line) => line.words);
        assert.equal(placed.length, wordCount(text), `${label}: keeps every word once`);
      }
    }
  }
});

test("long text shrinks to fit, short text keeps the style size", () => {
  const style = withPostDefaults({});
  assert.equal(layout(style, SHORT).fittedDown, false);
  const long = layout(style, LONG);
  assert.equal(long.fittedDown, true);
  assert.ok(long.body.fitted.size < style.body.size);
});

test("line breaks in the post are kept", () => {
  const result = layout(withPostDefaults({}), "One\nTwo\nThree");
  assert.deepEqual(result.body.fitted.lines.map((line) => line.words.map((w) => w.text).join(" ")), ["One", "Two", "Three"]);
});

test("the verified badge shows only when chosen", () => {
  const style = withPostDefaults({});
  assert.equal(layout(style, SHORT).badges.length, 1);
  assert.equal(layout(style, SHORT, undefined, { verified: false }).badges.length, 0);
});

test("a long name is shortened with an ellipsis", () => {
  const result = layout(withPostDefaults({}), SHORT, undefined, { name: "A very long name ".repeat(10) });
  const name = result.lines[0].text;
  assert.ok(name.endsWith("…"));
  assert.ok(name.length < 170);
});

test("empty fields leave out their parts", () => {
  const result = layout(withPostDefaults({}), "", undefined, { handle: "", date: "" });
  assert.equal(result.body, null);
  assert.equal(result.lines.length, 1);
  assert.ok(result.card.h > 0);
});

test("action icons can be turned off", () => {
  const style = withPostDefaults({ actions: false });
  const result = layout(style, SHORT);
  assert.equal(result.icons.length, 0);
  assert.equal(result.dividers.length, 0);
});

test("initials come from the first two words of the name", () => {
  assert.equal(initials("alex rivera jones"), "AR");
  assert.equal(initials("  Émile  "), "É");
  assert.equal(initials(""), "?");
});

// Styles

test("post presets cover every layout, have unique ids and use bundled fonts with bold and italic", () => {
  assert.equal(new Set(POST_PRESETS.map((p) => p.id)).size, POST_PRESETS.length);
  for (const [kind] of POST_KINDS) assert.ok(POST_PRESETS.some((p) => p.kind === kind), `a preset uses ${kind}`);
  const byName = new Map(FONTS.map((f) => [f.family, f]));
  for (const preset of POST_PRESETS) {
    assert.ok(POST_CATEGORIES.includes(preset.category), `${preset.name} has a known category`);
    for (const font of [preset.profile.font, preset.body.font]) assert.ok(byName.has(font), `${preset.name} uses ${font}`);
    const body = byName.get(preset.body.font);
    assert.ok(body.italic, `${preset.name} body font has italics`);
    assert.ok(body.max >= preset.body.weight + 200, `${preset.name} body font has a bold weight`);
  }
});

test("post presets contain only style values the app knows about", () => {
  const check = (value, base, path) => {
    for (const key of Object.keys(value)) {
      if (path === "" && ["id", "name", "category"].includes(key)) continue;
      assert.ok(key in base, `unknown value ${path}${key}`);
      if (base[key] && typeof base[key] === "object") check(value[key], base[key], `${path}${key}.`);
    }
  };
  POST_PRESETS.forEach((preset) => check(preset, DEFAULT_POST_STYLE, ""));
});
