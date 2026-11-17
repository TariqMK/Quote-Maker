// Splits article text into carousel slides and draws each slide on a canvas.
// layoutCarousel measures and pages the text once; renderSlide then draws any one slide from it.

import { layoutAt } from "./layout.js";
import {
  drawRuns,
  fontString,
  lookFont,
  measureLine,
  measureParagraphs,
  paintBackground,
  paintBands,
  paintFrame,
  paintTexture,
  setSpacing,
} from "./paint.js";
import { cleanArticle, cleanLine, isRtl, parseArticle, splitSlides, stripHighlights } from "./text.js";

// A paragraph split across slides keeps at least this many lines on each slide.
const MIN_LINES = 2;

// Pages blocks of lines onto slides. sections holds, for each part of the text between [slide]
// marks, the line count of each block (a paragraph, or a stanza when line breaks are kept).
// Rules:
// - Each section starts a new slide. Text that starts with [slide] leaves slide 1 for the title.
// - A block that fits in the space left stays whole.
// - A block that does not fit moves whole to the next slide when the current slide is at least
//   half full and the block fits on an empty slide. Otherwise it splits, with at least
//   MIN_LINES lines on each side of the split.
// - A slide too short for that rule takes what fits, and always at least one line.
// Returns slides as arrays of pieces: { section, block, from, to, gap }.
export function paginate(sections, { firstHeight, otherHeight, lineHeight, gapHeight }) {
  const slides = [];
  let slide;
  let used = 0;
  const open = () => {
    slide = [];
    slides.push(slide);
    used = 0;
  };
  const capacity = () => (slides.length === 1 ? firstHeight : otherHeight);
  const fitLines = (height) => Math.max(0, Math.floor(height / lineHeight + 1e-6));
  const place = (section, block, from, to) => {
    const gap = slide.length > 0;
    slide.push({ section, block, from, to, gap });
    used += (gap ? gapHeight : 0) + (to - from) * lineHeight;
  };

  open();
  sections.forEach((blocks, section) => {
    if (section > 0 && (slide.length > 0 || slides.length === 1)) open();
    blocks.forEach((lineCount, block) => {
      let from = 0;
      while (from < lineCount) {
        const remaining = lineCount - from;
        const room = fitLines(capacity() - used - (slide.length ? gapHeight : 0));
        if (remaining <= room) {
          place(section, block, from, lineCount);
          break;
        }
        const fitsEmpty = remaining <= fitLines(otherHeight);
        if (slide.length > 0 && fitsEmpty && used >= capacity() / 2) {
          open();
          continue;
        }
        let take = Math.min(room, remaining - MIN_LINES);
        if (take < MIN_LINES) {
          const headerOnly = slide.length === 0 && room === 0 && slides.length === 1;
          if (slide.length > 0 || headerOnly) {
            open();
            continue;
          }
          take = Math.max(1, Math.min(room, remaining));
        }
        place(section, block, from, from + take);
        from += take;
        open();
      }
    });
  });
  if (slides.length > 1 && slides.at(-1).length === 0) slides.pop();
  return slides;
}

// Fills in the values the shared text drawing needs and a carousel style does not set.
function textSpec(part) {
  return {
    letterSpacing: 0,
    uppercase: false,
    emphasis: "italic",
    emphasisColor: part.color,
    shadowBlur: 0,
    shadowY: 0,
    shadowColor: "#000000",
    ...part,
  };
}

// Lays out one short heading (title or subtitle). Returns null when the text is empty.
function layoutHeading(ctx, raw, part, u, maxWidth) {
  const text = cleanLine(raw);
  if (!text) return null;
  const spec = textSpec(part);
  const paragraphs = parseArticle(text);
  const space100 = measureParagraphs(ctx, paragraphs, spec);
  const size = part.size * u;
  const options = { maxWidth, lineHeight: part.lineHeight, paragraphGap: 0, balance: true, space100 };
  return { spec, size, ...layoutAt(paragraphs, size, options) };
}

// Measures the text and splits it into slides. The result holds everything renderSlide needs.
export function layoutCarousel(ctx, { width, height, title = "", subtitle = "", text = "", keepLineBreaks = false, style }) {
  const u = Math.min(width, height) / 1080;
  const box = style.layout;
  const marginX = box.marginX * u;
  const top = box.marginTop * u;
  const bottom = height - box.marginBottom * u;
  const contentWidth = Math.max(40 * u, width - marginX * 2);
  const available = Math.max(0, bottom - top);

  ctx.save();
  const heading = layoutHeading(ctx, title, style.title, u, contentWidth);
  const sub = layoutHeading(ctx, subtitle, style.subtitle, u, contentWidth);
  let headerHeight = (heading?.height ?? 0) + (sub?.height ?? 0);
  if (heading && sub) headerHeight += style.subtitle.gap * u;
  if (heading || sub) headerHeight += style.body.gap * u;

  const article = cleanArticle(text);
  const bodySpec = textSpec(style.body);
  const bodySize = style.body.size * u;
  const lineHeight = bodySize * style.body.lineHeight;
  const gapHeight = lineHeight * style.body.paragraphGap;
  const sections = splitSlides(article).map((section) => parseArticle(section, { keepLineBreaks }));
  const space100 = measureParagraphs(ctx, sections.flat(), bodySpec);
  ctx.restore();

  // Lines of one block stack with no gap. Blocks are separated by the paragraph gap.
  const blockLines = sections.map((paragraphs) => {
    const blocks = [];
    paragraphs.forEach((paragraph) => {
      const laid = layoutAt([{ ...paragraph, gap: false }], bodySize, {
        maxWidth: contentWidth,
        lineHeight: style.body.lineHeight,
        paragraphGap: 0,
        balance: false,
        space100,
      });
      if (blocks.length && blocks.at(-1).id === paragraph.block) blocks.at(-1).lines.push(...laid.lines);
      else blocks.push({ id: paragraph.block, lines: laid.lines });
    });
    return blocks.map((block) => block.lines);
  });

  const pages = paginate(
    blockLines.map((blocks) => blocks.map((lines) => lines.length)),
    { firstHeight: available - headerHeight, otherHeight: available, lineHeight, gapHeight },
  );
  const slides = pages.map((pieces, index) => {
    const capacity = index === 0 ? available - headerHeight : available;
    const parts = pieces.map(({ section, block, from, to, gap }) => ({
      gap,
      lines: blockLines[section][block].slice(from, to),
    }));
    const bodyHeight = parts.reduce((sum, p) => sum + (p.gap ? gapHeight : 0) + p.lines.length * lineHeight, 0);
    return { parts, bodyHeight, overflow: bodyHeight > capacity + 0.5 };
  });

  return {
    width,
    height,
    u,
    style,
    rtl: isRtl(stripHighlights(article)),
    marginX,
    top,
    bottom,
    contentWidth,
    heading,
    sub,
    headerHeight,
    body: { spec: bodySpec, size: bodySize, lineHeight, gapHeight },
    slides,
  };
}

function drawLines(ctx, lines, startY, size, lineHeight, spec, lineX, u, rtl) {
  const baselineOffset = lineHeight / 2 + size * 0.33;
  const placed = lines.map((line, i) => ({
    y: startY + i * lineHeight + baselineOffset,
    runs: measureLine(ctx, line, lineX(line.width), size, { q: spec, u, rtl }),
  }));
  placed.forEach(({ runs, y }) => paintBands(ctx, runs, y, size));
  placed.forEach(({ runs, y }) => drawRuns(ctx, runs, y, size, { q: spec, u, rtl }));
}

// Draws slide number index (from 0). scale enlarges the whole slide for export.
export function renderSlide(ctx, layout, index, scale = 1) {
  const { width, height, u, style, rtl, marginX, top, bottom, contentWidth, heading, sub, body } = layout;
  const slide = layout.slides[index];
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fontKerning = "normal";
  if ("textRendering" in ctx) ctx.textRendering = "optimizeLegibility";

  paintBackground(ctx, width, height, style.background);
  paintTexture(ctx, width, height, u, style.texture);
  paintFrame(ctx, width, height, u, style.frame);

  const align = rtl && style.layout.align === "left" ? "right" : style.layout.align;
  const lineX = (lineWidth) => {
    if (align === "center") return marginX + (contentWidth - lineWidth) / 2;
    if (align === "right") return marginX + contentWidth - lineWidth;
    return marginX;
  };

  const first = index === 0;
  const header = first ? layout.headerHeight : 0;
  const space = bottom - top;
  const centred = (blockTop, blockSpace, blockHeight) =>
    blockHeight < blockSpace ? blockTop + (blockSpace - blockHeight) / 2 : blockTop;
  let headerY = top;
  let bodyY = top + header;
  const vAlign = style.layout.vAlign;
  if (vAlign === "all") {
    headerY = centred(top, space, header + slide.bodyHeight);
    bodyY = headerY + header;
  } else if (vAlign === "body") {
    bodyY = centred(top + header, space - header, slide.bodyHeight);
  }

  if (first) {
    let y = headerY;
    if (heading) {
      drawLines(ctx, heading.lines, y, heading.size, heading.size * style.title.lineHeight, heading.spec, lineX, u, rtl);
      y += heading.height + (sub ? style.subtitle.gap * u : 0);
    }
    if (sub) drawLines(ctx, sub.lines, y, sub.size, sub.size * style.subtitle.lineHeight, sub.spec, lineX, u, rtl);
  }

  let y = bodyY;
  for (const part of slide.parts) {
    if (part.gap) y += body.gapHeight;
    drawLines(ctx, part.lines, y, body.size, body.lineHeight, body.spec, lineX, u, rtl);
    y += part.lines.length * body.lineHeight;
  }

  const pageNumber = style.pageNumber;
  const total = layout.slides.length;
  if (pageNumber.position !== "none" && total > 1) {
    const size = pageNumber.size * u;
    ctx.font = fontString(pageNumber.font, 400, false, size);
    ctx.fillStyle = pageNumber.color;
    ctx.textBaseline = "middle";
    ctx.textAlign = pageNumber.position;
    const x = { left: marginX, center: width / 2, right: width - marginX }[pageNumber.position];
    setSpacing(ctx, "0px");
    ctx.fillText(`${index + 1} / ${total}`, x, (bottom + height) / 2);
  }
  ctx.restore();
}

// Loads every font face a carousel style uses. A canvas draws fallback fonts until this finishes.
export async function ensureCarouselFonts(style) {
  if (typeof document === "undefined" || !document.fonts) return;
  const sample = "Aa“—";
  const spec = (part) => textSpec(part);
  const needed = [
    lookFont(spec(style.title), "", 40),
    lookFont(spec(style.title), "b", 40),
    lookFont(spec(style.title), "i", 40),
    lookFont(spec(style.subtitle), "", 40),
    ...["", "b", "i", "bi"].map((look) => lookFont(spec(style.body), look, 40)),
    fontString(style.pageNumber.font, 400, false, 40),
  ];
  await Promise.all(needed.map((font) => document.fonts.load(font, sample).catch(() => null)));
}
