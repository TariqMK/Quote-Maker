// Draws a finished quote image on a canvas. The preview, thumbnails and export all use this.
// Style sizes are in units of 1/1080 of the image's shorter side, so a style works at any size.

import { FONTS } from "./fonts.js";
import { fitText } from "./layout.js";
import { cleanLine, cleanQuote, isRtl, parseParagraphs } from "./text.js";

const FALLBACK = '"Segoe UI", "Noto Sans", "Noto Naskh Arabic", system-ui, sans-serif';
const MARK_GLYPH = "“";
const PARAGRAPH_GAP = 0.6;

function fontInfo(family) {
  return FONTS.find((f) => f.family === family);
}

function fontString(family, weight, italic, size) {
  const info = fontInfo(family);
  const clamped = info ? Math.min(info.max, Math.max(info.min, weight)) : weight;
  const slant = italic && (!info || info.italic) ? "italic " : "";
  return `${slant}${clamped} ${size}px "${family}", ${FALLBACK}`;
}

function emphasisFont(q, size) {
  if (q.emphasis === "italic") return fontString(q.font, q.weight, !q.italic, size);
  if (q.emphasis === "bold") return fontString(q.font, Math.min(900, q.weight + 300), q.italic, size);
  return fontString(q.font, q.weight, q.italic, size);
}

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
  ];
  await Promise.all(needed.map((font) => document.fonts.load(font, sample).catch(() => null)));
}

function setSpacing(ctx, value) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = value;
}

function paintBackground(ctx, w, h, bg) {
  const stops = [bg.color1, bg.color2, bg.color3].filter(Boolean);
  if (bg.type === "solid" || stops.length < 2) {
    ctx.fillStyle = bg.color1;
  } else {
    let gradient;
    if (bg.type === "radial") {
      gradient = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.hypot(w, h) * 0.62);
    } else {
      const angle = (bg.angle * Math.PI) / 180;
      const dx = Math.sin(angle);
      const dy = -Math.cos(angle);
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      gradient = ctx.createLinearGradient(
        w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half,
      );
    }
    stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color));
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(0, 0, w, h);
}

function paintDecor(ctx, w, h, u, decor) {
  if (decor.type === "none") return;
  ctx.save();
  ctx.globalAlpha = decor.opacity;
  ctx.fillStyle = decor.color;
  const short = Math.min(w, h);
  ctx.beginPath();
  if (decor.type === "sun") {
    ctx.arc(w / 2, h / 2, short * 0.43, 0, Math.PI * 2);
  } else if (decor.type === "arch") {
    const archW = short * 0.76;
    const archH = h - 90 * u;
    const left = (w - archW) / 2;
    ctx.moveTo(left, h);
    ctx.lineTo(left, h - archH + archW / 2);
    ctx.arc(w / 2, h - archH + archW / 2, archW / 2, Math.PI, 0);
    ctx.lineTo(left + archW, h);
    ctx.closePath();
  } else if (decor.type === "band") {
    ctx.rect(0, 0, w, 56 * u);
  }
  ctx.fill();
  ctx.restore();
}

function noiseTile() {
  const size = 256;
  const tile = document.createElement("canvas");
  tile.width = tile.height = size;
  const context = tile.getContext("2d");
  const image = context.createImageData(size, size);
  // A fixed seed gives the same grain each time, so the preview and export match.
  let seed = 1234567;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = seed >>> 24;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return tile;
}
let cachedNoise = null;

function paintTexture(ctx, w, h, u, texture) {
  if (texture.type === "none") return;
  ctx.save();
  ctx.globalAlpha = texture.opacity;
  if (texture.type === "grain") {
    cachedNoise ??= noiseTile();
    ctx.globalCompositeOperation = "overlay";
    const pattern = ctx.createPattern(cachedNoise, "repeat");
    pattern.setTransform(new DOMMatrix().scale(Math.max(1, u)));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  } else if (texture.type === "dots") {
    ctx.fillStyle = texture.color;
    const step = 22 * u;
    let row = 0;
    for (let y = 0; y < h + step; y += step, row += 1) {
      for (let x = row % 2 ? step / 2 : 0; x < w + step; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 3.6 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = texture.color;
    ctx.lineWidth = Math.max(1, 2 * u);
    const step = (texture.type === "grid" ? 54 : 64) * u;
    ctx.beginPath();
    for (let y = step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    if (texture.type === "grid") {
      for (let x = step; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function paintFrame(ctx, w, h, u, frame) {
  if (frame.type === "none") return;
  const inset = frame.inset * u;
  const line = Math.max(0.5, frame.width * u);
  const boxW = w - inset * 2;
  const boxH = h - inset * 2;
  ctx.save();
  ctx.strokeStyle = frame.color;
  ctx.lineWidth = line;
  if (frame.type === "line" || frame.type === "double") {
    ctx.strokeRect(inset, inset, boxW, boxH);
    if (frame.type === "double") {
      const gap = line + 10 * u;
      ctx.strokeRect(inset + gap, inset + gap, boxW - gap * 2, boxH - gap * 2);
    }
  } else if (frame.type === "corners") {
    const arm = 70 * u;
    ctx.beginPath();
    [[inset, inset, 1, 1], [w - inset, inset, -1, 1], [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]]
      .forEach(([x, y, dx, dy]) => {
        ctx.moveTo(x + arm * dx, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + arm * dy);
      });
    ctx.stroke();
  } else if (frame.type === "card") {
    ctx.beginPath();
    ctx.roundRect(inset, inset, boxW, boxH, frame.radius * u);
    ctx.shadowColor = `rgba(0, 0, 0, ${frame.cardShadow})`;
    ctx.shadowBlur = 60 * u;
    ctx.shadowOffsetY = 20 * u;
    ctx.globalAlpha = frame.cardOpacity;
    ctx.fillStyle = frame.cardColor;
    ctx.fill();
  }
  ctx.restore();
}

// Measures each word at 100 px, because width grows in proportion to size.
function measureParagraphs(ctx, paragraphs, q) {
  const normal = fontString(q.font, q.weight, q.italic, 100);
  const emphatic = emphasisFont(q, 100);
  setSpacing(ctx, `${q.letterSpacing * 100}px`);
  const cased = (text) => (q.uppercase ? text.toLocaleUpperCase() : text);
  for (const paragraph of paragraphs) {
    paragraph.widths100 = paragraph.words.map((word) =>
      word.parts.reduce((sum, part) => {
        ctx.font = part.em ? emphatic : normal;
        return sum + ctx.measureText(cased(part.text)).width;
      }, 0),
    );
  }
  ctx.font = normal;
  return ctx.measureText(" ").width;
}

// Applies the wrapping curly quotes used by the "Around the text" mark.
function wrapInMarks(paragraphs) {
  const first = paragraphs[0]?.words[0]?.parts[0];
  const lastWord = paragraphs.at(-1)?.words.at(-1);
  if (!first || !lastWord) return;
  first.text = `“${first.text}`;
  lastWord.parts.at(-1).text += "”";
}

function drawLine(ctx, line, x, y, size, spec) {
  const { q, u, rtl } = spec;
  const normal = fontString(q.font, q.weight, q.italic, size);
  const emphatic = emphasisFont(q, size);
  const cased = (text) => (q.uppercase ? text.toLocaleUpperCase() : text);
  setSpacing(ctx, `${q.letterSpacing * size}px`);
  ctx.font = normal;
  const space = ctx.measureText(" ").width;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.direction = rtl ? "rtl" : "ltr";

  // Merge neighbouring words of the same kind, so kerning and joined scripts stay intact.
  const runs = [];
  line.words.forEach((word, wordIndex) => {
    word.parts.forEach((part, partIndex) => {
      const last = runs.at(-1);
      const joined = partIndex > 0;
      if (last && last.em === part.em) {
        last.text += (joined ? "" : " ") + cased(part.text);
      } else {
        runs.push({ text: cased(part.text), em: part.em, spaced: !joined && wordIndex > 0 });
      }
    });
  });
  if (rtl) runs.reverse();

  let cursor = x;
  runs.forEach((run, index) => {
    const spacedBefore = rtl ? runs[index - 1]?.spaced : run.spaced;
    if (index > 0 && spacedBefore) cursor += space;
    ctx.font = run.em ? emphatic : normal;
    ctx.fillStyle = run.em && q.emphasis === "color" ? q.emphasisColor : q.color;
    if (q.shadowBlur > 0 || q.shadowY !== 0) {
      ctx.shadowColor = q.shadowColor;
      ctx.shadowBlur = q.shadowBlur * u;
      ctx.shadowOffsetY = q.shadowY * u;
    }
    const drawX = rtl ? cursor + ctx.measureText(run.text).width : cursor;
    if (rtl) ctx.textAlign = "right";
    ctx.fillText(run.text, drawX, y);
    cursor += ctx.measureText(run.text).width;
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  setSpacing(ctx, "0px");
  ctx.direction = "ltr";
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
  const rtl = isRtl(text);
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
  fitted.lines.forEach((line) => {
    drawLine(ctx, line, lineX(line.width), textTop + line.y + baselineOffset, fitted.size, spec);
  });

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
