// Draws a finished quote image on a canvas. The preview, thumbnails and export all use this.
// Style sizes are in units of 1/1080 of the image's shorter side, so a style works at any size.

import {
  drawRuns,
  emphasisFont,
  textureFonts,
  fontString,
  measureLine,
  measureParagraphs,
  paintBackground,
  paintBands,
  paintDecor,
  paintFrame,
  paintTexture,
  setSpacing,
} from "./paint.js";
import { fitText } from "./layout.js";
import { cleanLine, cleanQuote, highlightAll, isRtl, parseParagraphs, stripHighlights } from "./text.js";

const MARK_GLYPH = "“";
const PARAGRAPH_GAP = 0.6;

// Loads every font face a style uses. A canvas draws fallback fonts until this finishes.
export async function ensureFonts(style) {
  if (typeof document === "undefined" || !document.fonts) return;
  const q = style.quote;
  const sample = "Aa“—";
  const needed = [
    fontString(q.font, q.weight, q.italic, 40),
    emphasisFont(q, 40),
    fontString(style.mark.font, 400, false, 40),
    fontString(style.author.font, style.author.weight, style.author.italic, 40),
    fontString(style.source.font, style.source.weight, style.source.italic, 40),
    ...textureFonts(style.texture),
  ];
  await Promise.all(needed.map((font) => document.fonts.load(font, sample).catch(() => null)));
}

// Applies the wrapping curly quotes used by the "Around the text" mark.
function wrapInMarks(paragraphs) {
  const first = paragraphs[0]?.words[0]?.parts[0];
  const lastWord = paragraphs.at(-1)?.words.at(-1);
  if (!first || !lastWord) return;
  first.text = `“${first.text}`;
  lastWord.parts.at(-1).text += "”";
}

function attributionLines(ctx, style, author, source, u, maxWidth) {
  const lines = [];
  const a = style.author;
  const s = style.source;
  if (author) {
    const text = (a.dash ? "— " : "") + author;
    lines.push({
      text: a.uppercase ? text.toLocaleUpperCase() : text,
      font: fontString(a.font, a.weight, a.italic, a.size * u),
      spacing: a.letterSpacing * a.size * u,
      size: a.size * u,
      color: a.color,
    });
  }
  if (source) {
    lines.push({
      text: source,
      font: fontString(s.font, s.weight, s.italic, s.size * u),
      spacing: 0,
      size: s.size * u,
      color: s.color,
    });
  }
  // Long attribution shrinks to fit on one line instead of running off the image.
  for (const line of lines) {
    ctx.font = line.font;
    setSpacing(ctx, `${line.spacing}px`);
    const width = ctx.measureText(line.text).width;
    line.width = Math.min(width, maxWidth);
  }
  setSpacing(ctx, "0px");
  return lines;
}

export function renderQuote(ctx, { width, height, quote, author, source, style }) {
  const u = Math.min(width, height) / 1080;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fontKerning = "normal";
  if ("textRendering" in ctx) ctx.textRendering = "optimizeLegibility";

  paintBackground(ctx, width, height, style.background);
  paintDecor(ctx, width, height, u, style.decor);
  paintTexture(ctx, width, height, u, style.texture);
  paintFrame(ctx, width, height, u, style.frame);

  const text = cleanQuote(quote);
  const authorText = cleanLine(author);
  const sourceText = cleanLine(source);
  const { layout: box, quote: q, mark, rule } = style;
  const margin = box.margin * u;
  const fullWidth = Math.max(40 * u, width - margin * 2);
  const barInset = mark.type === "bar" ? 44 * u : 0;
  // Text over an arch stays inside it, because the two often share a colour outside it.
  const archLimit = style.decor.type === "arch" ? Math.min(width, height) * 0.62 : Infinity;
  const textWidth = Math.min((fullWidth - barInset) * (box.textWidth / 100), archLimit);
  const innerHeight = Math.max(40 * u, height - margin * 2);

  const paragraphs = parseParagraphs(text);
  if (mark.type === "inline") wrapInMarks(paragraphs);
  highlightAll(paragraphs, q.band);
  const rtl = isRtl(stripHighlights(text));
  const align = rtl && box.align === "left" ? "right" : box.align;
  const space100 = measureParagraphs(ctx, paragraphs, q);

  // Space the marks and attribution need, which the quote text must leave free.
  const attribution = attributionLines(ctx, style, authorText, sourceText, u, fullWidth);
  const attributionHeight = attribution.reduce((sum, line) => sum + line.size * 1.4, 0);
  const hasAttribution = attribution.length > 0;
  const gap = hasAttribution ? style.author.gap * u : 0;
  const ruleHeight = rule.type === "short" ? rule.thickness * u + 28 * u : 0;

  let markHeight = 0;
  let markInk = null;
  if (mark.type === "top") {
    ctx.font = fontString(mark.font, 400, false, mark.size * u);
    const metrics = ctx.measureText(MARK_GLYPH);
    markInk = { ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent };
    markHeight = markInk.ascent + markInk.descent + 36 * u;
  }

  const fitted = fitText(paragraphs, {
    maxWidth: textWidth,
    maxHeight: Math.max(40 * u, innerHeight - attributionHeight - gap - ruleHeight - markHeight),
    maxSize: q.size * u,
    minSize: 10 * u,
    lineHeight: q.lineHeight,
    paragraphGap: PARAGRAPH_GAP,
    balance: q.balance,
    space100,
  });

  const blockHeight = markHeight + fitted.height + ruleHeight + gap + attributionHeight;
  let top = margin;
  if (box.vAlign === "center") top = (height - blockHeight) / 2;
  if (box.vAlign === "bottom") top = height - margin - blockHeight;

  const blockLeft = align === "right" ? margin : margin + barInset;
  const lineX = (lineWidth, areaWidth = textWidth, areaLeft = blockLeft) => {
    if (align === "center") return (width - lineWidth) / 2;
    if (align === "right") return areaLeft + areaWidth - lineWidth;
    return areaLeft;
  };

  // Top mark, placed by its visible ink so it sits exactly where the spacing says.
  if (mark.type === "top" && markInk) {
    ctx.save();
    ctx.globalAlpha = mark.opacity;
    ctx.fillStyle = mark.color;
    ctx.font = fontString(mark.font, 400, false, mark.size * u);
    const glyphWidth = ctx.measureText(MARK_GLYPH).width;
    ctx.fillText(MARK_GLYPH, lineX(glyphWidth), top + markInk.ascent);
    ctx.restore();
  }

  const textTop = top + markHeight;

  if (mark.type === "bar") {
    ctx.save();
    ctx.globalAlpha = mark.opacity;
    ctx.fillStyle = mark.color;
    const barX = align === "right" ? width - margin - 6 * u : margin;
    ctx.fillRect(barX, textTop, 6 * u, fitted.height);
    ctx.restore();
  }

  const lineHeightPx = fitted.size * q.lineHeight;
  const baselineOffset = lineHeightPx / 2 + fitted.size * 0.33;
  const spec = { q, u, rtl };
  const placed = fitted.lines.map((line) => ({
    y: textTop + line.y + baselineOffset,
    runs: measureLine(ctx, line, lineX(line.width), fitted.size, spec),
  }));
  // All bands go first, so a band can never cover the text of the line above it.
  placed.forEach(({ runs, y: baseline }) => paintBands(ctx, runs, baseline, fitted.size));
  placed.forEach(({ runs, y: baseline }) => drawRuns(ctx, runs, baseline, fitted.size, spec));

  let y = textTop + fitted.height + gap * (rule.type === "short" ? 0.6 : 1);
  if (rule.type === "short" && hasAttribution) {
    const ruleWidth = rule.width * u;
    ctx.fillStyle = rule.color;
    ctx.fillRect(lineX(ruleWidth), y, ruleWidth, rule.thickness * u);
    y += rule.thickness * u + 28 * u + gap * 0.4;
  }

  attribution.forEach((line) => {
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.textAlign = "left";
    setSpacing(ctx, `${line.spacing}px`);
    y += line.size * 1.1;
    ctx.fillText(line.text, lineX(line.width), y, fullWidth);
    y += line.size * 0.3;
  });
  setSpacing(ctx, "0px");
  ctx.restore();
  return { fontSize: fitted.size / u, fittedDown: fitted.size < q.size * u - 0.5 };
}
