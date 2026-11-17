// Drawing pieces shared by every image type: fonts, backgrounds, frames and runs of styled text.
// Sizes passed in as u are units of 1/1080 of the image's shorter side.

import { FONTS } from "./fonts.js";
import { readableInk } from "./layout.js";

const FALLBACK = '"Segoe UI", "Noto Sans", "Noto Naskh Arabic", system-ui, sans-serif';

function fontInfo(family) {
  return FONTS.find((f) => f.family === family);
}

export function fontString(family, weight, italic, size) {
  const info = fontInfo(family);
  const clamped = info ? Math.min(info.max, Math.max(info.min, weight)) : weight;
  const slant = italic && (!info || info.italic) ? "italic " : "";
  return `${slant}${clamped} ${size}px "${family}", ${FALLBACK}`;
}

export function emphasisFont(q, size) {
  if (q.emphasis === "italic") return fontString(q.font, q.weight, !q.italic, size);
  if (q.emphasis === "bold") return fontString(q.font, Math.min(900, q.weight + 300), q.italic, size);
  return fontString(q.font, q.weight, q.italic, size);
}

// A part's look: "" for plain text, "em" for a quote's *emphasis*, or "b", "i" or "bi" for the
// bold and italic of article text. Quote parts carry em: true instead of a look.
export const lookOf = (part) => part.look ?? (part.em ? "em" : "");

export function lookFont(q, look, size) {
  if (look === "em") return emphasisFont(q, size);
  if (!look) return fontString(q.font, q.weight, q.italic, size);
  const weight = look.includes("b") ? Math.min(900, q.weight + 300) : q.weight;
  const italic = look.includes("i") ? !q.italic : q.italic;
  return fontString(q.font, weight, italic, size);
}

export function setSpacing(ctx, value) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = value;
}

export function paintBackground(ctx, w, h, bg) {
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

export function paintDecor(ctx, w, h, u, decor) {
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

export function paintTexture(ctx, w, h, u, texture) {
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

export function paintFrame(ctx, w, h, u, frame) {
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
export function measureParagraphs(ctx, paragraphs, q) {
  const normal = fontString(q.font, q.weight, q.italic, 100);
  setSpacing(ctx, `${q.letterSpacing * 100}px`);
  const cased = (text) => (q.uppercase ? text.toLocaleUpperCase() : text);
  for (const paragraph of paragraphs) {
    paragraph.widths100 = paragraph.words.map((word) =>
      word.parts.reduce((sum, part) => {
        ctx.font = lookFont(q, lookOf(part), 100);
        return sum + ctx.measureText(cased(part.text)).width;
      }, 0),
    );
  }
  ctx.font = normal;
  return ctx.measureText(" ").width;
}

// Splits a line into runs of one kind and finds where each run starts and how wide it is.
export function measureLine(ctx, line, x, size, spec) {
  const { q, rtl } = spec;
  const normal = fontString(q.font, q.weight, q.italic, size);
  const cased = (text) => (q.uppercase ? text.toLocaleUpperCase() : text);
  setSpacing(ctx, `${q.letterSpacing * size}px`);
  ctx.font = normal;
  const space = ctx.measureText(" ").width;
  ctx.direction = rtl ? "rtl" : "ltr";

  // Merge neighbouring words of the same kind, so kerning and joined scripts stay intact.
  const runs = [];
  line.words.forEach((word, wordIndex) => {
    word.parts.forEach((part, partIndex) => {
      const last = runs.at(-1);
      const joined = partIndex > 0;
      const look = lookOf(part);
      if (last && last.look === look && last.hl === part.hl) {
        last.text += (joined ? "" : " ") + cased(part.text);
      } else {
        runs.push({ text: cased(part.text), look, hl: part.hl, spaced: !joined && wordIndex > 0 });
      }
    });
  });
  if (rtl) runs.reverse();

  let cursor = x;
  runs.forEach((run, index) => {
    const spacedBefore = rtl ? runs[index - 1]?.spaced : run.spaced;
    if (index > 0 && spacedBefore) cursor += space;
    run.font = lookFont(q, run.look, size);
    ctx.font = run.font;
    run.x = cursor;
    run.width = ctx.measureText(run.text).width;
    cursor += run.width;
  });
  setSpacing(ctx, "0px");
  ctx.direction = "ltr";
  return runs;
}

// Draws one band for each stretch of a line in one highlight colour, including its spaces.
export function paintBands(ctx, runs, y, size) {
  const pad = size * 0.08;
  for (let i = 0; i < runs.length; i += 1) {
    const color = runs[i].hl;
    if (!color) continue;
    const first = runs[i];
    while (runs[i + 1]?.hl === color) i += 1;
    ctx.fillStyle = color;
    ctx.fillRect(first.x - pad, y - size * 0.8, runs[i].x + runs[i].width - first.x + pad * 2, size * 1.06);
  }
}

export function drawRuns(ctx, runs, y, size, spec) {
  const { q, u, rtl } = spec;
  setSpacing(ctx, `${q.letterSpacing * size}px`);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.direction = rtl ? "rtl" : "ltr";
  const hasShadow = q.shadowBlur > 0 || q.shadowY !== 0;
  for (const run of runs) {
    const ink = run.look === "em" && q.emphasis === "color" ? q.emphasisColor : q.color;
    ctx.font = run.font;
    ctx.fillStyle = run.hl ? readableInk(run.hl, ink) : ink;
    // A text shadow would smudge the flat band, so highlighted text has none.
    const shadowed = hasShadow && !run.hl;
    ctx.shadowColor = shadowed ? q.shadowColor : "transparent";
    ctx.shadowBlur = shadowed ? q.shadowBlur * u : 0;
    ctx.shadowOffsetY = shadowed ? q.shadowY * u : 0;
    ctx.fillText(run.text, rtl ? run.x + run.width : run.x, y);
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  setSpacing(ctx, "0px");
  ctx.direction = "ltr";
}
