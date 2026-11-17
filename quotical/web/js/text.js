// Cleans pasted text and splits it into paragraphs of words, with *emphasis* and highlights marked.

const WRAPPING_QUOTES = [
  ['"', '"'],
  ["“", "”"],
  ["„", "”"],
  ["'", "'"],
  ["‘", "’"],
  ["«", "»"],
];

// Replaces straight quotes and typed dashes with the characters a typesetter would use.
export function smartenPunctuation(text) {
  return text
    .replace(/(^|[\s([{—–-])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s([{—–“-])'/g, "$1‘")
    .replace(/'/g, "’")
    .replace(/\s*---?\s*/g, " — ")
    .replace(/\.\.\./g, "…");
}

function stripWrappingQuotes(text) {
  for (const [open, close] of WRAPPING_QUOTES) {
    if (text.length > 2 && text.startsWith(open) && text.endsWith(close)) {
      const inner = text.slice(open.length, -close.length);
      if (!inner.includes(open) && !inner.includes(close)) return inner.trim();
    }
  }
  return text;
}

// Prepares pasted text for layout. The quote marks come from the style, so pasted ones go.
export function cleanQuote(raw) {
  const text = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return smartenPunctuation(stripWrappingQuotes(text));
}

export function cleanLine(raw) {
  return smartenPunctuation(String(raw ?? "").replace(/\s+/g, " ").trim());
}

// The preset highlight colours. A mark is [yellow: these words] or [#7fd1ae: these words].
export const HIGHLIGHTS = {
  yellow: "#ffe14d",
  green: "#8fe388",
  blue: "#8fd0ff",
  pink: "#ff9ecb",
  orange: "#ffb35c",
  red: "#ff6b5e",
};
const HIGHLIGHT_NAMES = Object.keys(HIGHLIGHTS).join("|");
const MARK = new RegExp(
  `(\\[(${HIGHLIGHT_NAMES}|#[0-9a-f]{6})[^\\S\\n]*:[^\\S\\n]*)([^\\[\\]\\n]*[^\\[\\]\\s])([^\\S\\n]*\\])`,
  "gi",
);

// Removes the marks. Returns the plain text, the colour of each plain character (or null),
// and the plain position of each raw position. Text in brackets that is not a mark stays.
function decodeHighlights(text) {
  let plain = "";
  const colors = [];
  const toPlain = new Array(text.length + 1);
  let raw = 0;
  const skip = (until) => {
    for (; raw < until; raw += 1) toPlain[raw] = plain.length;
  };
  const copy = (until, color) => {
    for (; raw < until; raw += 1) {
      toPlain[raw] = plain.length;
      plain += text[raw];
      colors.push(color);
    }
  };
  for (const match of text.matchAll(MARK)) {
    copy(match.index, null);
    const name = match[2].toLowerCase();
    skip(match.index + match[1].length);
    copy(raw + match[3].length, HIGHLIGHTS[name] ?? name);
    skip(raw + match[4].length);
  }
  copy(text.length, null);
  toPlain[text.length] = plain.length;
  return { plain, colors, toPlain };
}

export function stripHighlights(text) {
  return decodeHighlights(text).plain;
}

// Writes marks around each run of one colour. Marks stop at line ends and around spaces at the
// edge of a run. The result also gives the raw range that covers the plain range start to end.
function encodeHighlights(plain, colors, start, end) {
  const nameOf = (color) => Object.keys(HIGHLIGHTS).find((name) => HIGHLIGHTS[name] === color) ?? color;
  let out = "";
  let open = null;
  let rawStart = 0;
  let rawEnd = 0;
  for (let i = 0; i <= plain.length; i += 1) {
    const char = plain[i];
    let next = i;
    while (next < plain.length && /[^\S\n]/.test(plain[next])) next += 1;
    const nextColor = next < plain.length && plain[next] !== "\n" ? colors[next] : null;
    if (open && nextColor !== open) {
      out += "]";
      open = null;
    }
    if (i === end) rawEnd = out.length;
    if (i === start) rawStart = out.length;
    if (i === plain.length) break;
    if (!open && next === i && colors[i] && char !== "\n") {
      open = colors[i];
      out += `[${nameOf(open)}: `;
    }
    out += char;
  }
  return { text: out, start: rawStart, end: rawEnd };
}

// Sets the highlight of the selected raw range. A null colour removes it. Returns the new text
// and the range to select, or null when the selection holds no words.
export function applyHighlight(text, rawStart, rawEnd, color) {
  const { plain, colors, toPlain } = decodeHighlights(text);
  let start = toPlain[rawStart];
  let end = toPlain[rawEnd];
  while (start < end && /\s/.test(plain[start])) start += 1;
  while (end > start && /\s/.test(plain[end - 1])) end -= 1;
  if (start >= end) return null;
  for (let i = start; i < end; i += 1) {
    // A mark cannot hold brackets, so those characters stay out of it.
    colors[i] = /[[\]]/.test(plain[i]) ? null : (HIGHLIGHTS[color] ?? color);
  }
  return encodeHighlights(plain, colors, start, end);
}

// Returns paragraphs as arrays of words, each with {text, em, hl} parts, where hl is a highlight
// colour or null. A blank line sets paragraph.gap to true.
export function parseParagraphs(text) {
  const paragraphs = [];
  let gapBefore = false;
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      gapBefore = true;
      continue;
    }
    const words = [];
    const { plain, colors } = decodeHighlights(line);
    let em = false;
    let hl = null;
    // A lone * with no partner stays as a literal character.
    const stars = (plain.match(/\*/g) || []).length;
    const usable = stars - (stars % 2);
    let seen = 0;
    let wordText = "";
    let parts = [];
    const endPart = () => {
      if (wordText) parts.push({ text: wordText, em, hl });
      wordText = "";
    };
    const endWord = () => {
      endPart();
      if (parts.length) words.push({ parts, text: parts.map((p) => p.text).join("") });
      parts = [];
    };
    let index = 0;
    for (const char of plain) {
      if (/\s/.test(char)) {
        endWord();
      } else if (char === "*" && seen < usable) {
        seen += 1;
        endPart();
        em = !em;
      } else {
        if (colors[index] !== hl) {
          endPart();
          hl = colors[index];
        }
        wordText += char;
      }
      index += char.length;
    }
    endWord();
    if (words.length) {
      paragraphs.push({ words, gap: gapBefore && paragraphs.length > 0 });
      gapBefore = false;
    }
  }
  return paragraphs;
}

// True when the text starts with a right-to-left letter (Arabic, Hebrew and similar).
export function isRtl(text) {
  const strong = text.match(/[A-Za-zÀ-ɏͰ-῿֐-ࣿיִ-ﻼ]/);
  return !!strong && /[֐-ࣿיִ-ﻼ]/.test(strong[0]);
}

// Builds a file name from the first words of the quote.
export function suggestFilename(quote, author) {
  const words = stripHighlights(cleanQuote(quote))
    .replace(/[*“”‘’]/g, "")
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]/gu, "");
  const by = cleanLine(author).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return [words || "quote", by].filter(Boolean).join("--").slice(0, 80);
}

// Article text for a carousel

// A line that holds only [slide] starts a new slide.
const SLIDE_BREAK = /^[^\S\n]*\[slide\][^\S\n]*$/im;
export const SLIDE_MARK = "[slide]";

// Prepares pasted article text. Unlike a quote, quote marks around the whole text stay.
export function cleanArticle(raw) {
  return smartenPunctuation(
    String(raw ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .trim(),
  );
}

// Splits cleaned article text at [slide] lines. Returns one text for each forced section.
export function splitSlides(text) {
  return text
    .split(new RegExp(SLIDE_BREAK.source, "gim"))
    .map((section) => section.trim());
}

// Finds the characters that switch bold (**) and italic (*) on and off. A star with no partner
// stays as a literal character. Returns a Map from position to the number of stars it uses.
function emphasisToggles(plain) {
  const toggles = new Map();
  const doubles = [];
  for (let i = 0; i < plain.length - 1; i += 1) {
    if (plain[i] === "*" && plain[i + 1] === "*") {
      doubles.push(i);
      i += 1;
    }
  }
  // A pair of stars with no partner stays as two literal stars.
  const unpaired = doubles.length % 2 ? doubles.pop() : -1;
  doubles.forEach((i) => toggles.set(i, 2));
  const singles = [];
  for (let i = 0; i < plain.length; i += 1) {
    if (toggles.has(i) || i === unpaired) i += 1;
    else if (plain[i] === "*") singles.push(i);
  }
  if (singles.length % 2) singles.pop();
  singles.forEach((i) => toggles.set(i, 1));
  return toggles;
}

// Returns paragraphs of words, each word with {text, look, hl} parts. look is "", "b", "i" or
// "bi". A blank line starts a new block and sets gap. Inside a block, single line breaks join
// into one paragraph, unless keepLineBreaks is true: then each line is its own paragraph with
// the same block number, so a stanza stays together.
export function parseArticle(text, { keepLineBreaks = false } = {}) {
  const paragraphs = [];
  const blocks = text.split(/\n[^\S\n]*\n\s*/).map((b) => b.trim()).filter(Boolean);
  blocks.forEach((rawBlock, block) => {
    const joined = keepLineBreaks ? rawBlock : rawBlock.replace(/\n/g, " ");
    const { plain, colors } = decodeHighlights(joined);
    const toggles = emphasisToggles(plain);
    let bold = false;
    let italic = false;
    let hl = null;
    let words = [];
    let parts = [];
    let wordText = "";
    const look = () => (bold ? "b" : "") + (italic ? "i" : "");
    const endPart = () => {
      if (wordText) parts.push({ text: wordText, look: look(), hl });
      wordText = "";
    };
    const endWord = () => {
      endPart();
      if (parts.length) words.push({ parts, text: parts.map((p) => p.text).join("") });
      parts = [];
    };
    const endParagraph = () => {
      endWord();
      if (words.length) {
        const first = !paragraphs.some((p) => p.block === block);
        paragraphs.push({ words, block, gap: first && paragraphs.length > 0 });
      }
      words = [];
    };
    for (let i = 0; i < plain.length; i += 1) {
      const char = plain[i];
      const stars = toggles.get(i);
      if (stars) {
        endPart();
        if (stars === 2) bold = !bold;
        else italic = !italic;
        i += stars - 1;
      } else if (char === "\n") {
        endParagraph();
      } else if (/\s/.test(char)) {
        endWord();
      } else {
        if (colors[i] !== hl) {
          endPart();
          hl = colors[i];
        }
        wordText += char;
      }
    }
    endParagraph();
  });
  return paragraphs;
}
