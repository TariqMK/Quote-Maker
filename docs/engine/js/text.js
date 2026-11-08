// Cleans pasted text and splits it into paragraphs of words, with *emphasis* marked.

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

// Returns paragraphs as arrays of {text, em} words. A blank line sets paragraph.gap to true.
export function parseParagraphs(text) {
  const paragraphs = [];
  let gapBefore = false;
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      gapBefore = true;
      continue;
    }
    const words = [];
    let em = false;
    // A lone * with no partner stays as a literal character.
    const stars = (line.match(/\*/g) || []).length;
    const usable = stars - (stars % 2);
    let seen = 0;
    for (const chunk of line.split(/\s+/).filter(Boolean)) {
      let wordText = "";
      const parts = [];
      for (const char of chunk) {
        if (char === "*" && seen < usable) {
          seen += 1;
          if (wordText) parts.push({ text: wordText, em });
          wordText = "";
          em = !em;
        } else {
          wordText += char;
        }
      }
      if (wordText) parts.push({ text: wordText, em });
      if (parts.length) words.push({ parts, text: parts.map((p) => p.text).join("") });
    }
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
  const words = cleanQuote(quote)
    .replace(/[*“”‘’]/g, "")
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]/gu, "");
  const by = cleanLine(author).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return [words || "quote", by].filter(Boolean).join("--").slice(0, 80);
}
