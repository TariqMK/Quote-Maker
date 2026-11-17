// Draws text as a social media post: a card with a picture, name, handle, date and the post
// text. layoutPost measures and places every part with no drawing; renderPost draws it.
// Icons are simple outline shapes drawn here. No platform logos are drawn.

import { fitText, readableInk } from "./layout.js";
import {
  drawRuns,
  fontString,
  lookFont,
  measureLine,
  measureParagraphs,
  paintBackground,
  paintBands,
  paintTexture,
  setSpacing,
  textureFonts,
} from "./paint.js";
import { POST_KINDS } from "./post-presets.js";
import { cleanArticle, cleanLine, isRtl, parseArticle, stripHighlights } from "./text.js";

const KINDS = new Set(POST_KINDS.map(([id]) => id));

// Outline icons on a 24 x 24 grid, drawn with a round 1.8 px stroke.
const ICONS = {
  comment: "M12 4c4.6 0 8 3 8 7s-3.4 7-8 7c-1.2 0-2.3-.2-3.3-.6L4 19l1.2-3.6C4.4 14.2 4 12.7 4 11c0-4 3.4-7 8-7z",
  repost: "M4 11V8.5A2.5 2.5 0 0 1 6.5 6H18M15 3l3 3-3 3M20 13v2.5a2.5 2.5 0 0 1-2.5 2.5H6M9 21l-3-3 3-3",
  heart:
    "M12 20.5C6 16.5 3 13.2 3 9.6 3 6.9 5.1 5 7.5 5c1.9 0 3.4 1 4.5 2.6C13.1 6 14.6 5 16.5 5 18.9 5 21 6.9 21 9.6c0 3.6-3 6.9-9 10.9z",
  bookmark: "M6.5 3.5h11a1 1 0 0 1 1 1v16L12 16l-6.5 4.5v-16a1 1 0 0 1 1-1z",
  share: "M12 15V3.5M7.5 8 12 3.5 16.5 8M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13",
  send: "M21 3 10.5 13.5M21 3l-6.5 18-4-7.5-7.5-4z",
  like: "M7 10.5V20H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM7 10.5l3.6-6.3a1.6 1.6 0 0 1 3 .9l-.7 4.4h5.4a2 2 0 0 1 2 2.4l-1.3 6.4a2 2 0 0 1-2 1.7H7",
  globe:
    "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM3 12h18M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3z",
};

const ACTIONS = {
  short: ["comment", "repost", "heart", "bookmark", "share"],
  work: [["like", "Like"], ["comment", "Comment"], ["repost", "Repost"], ["send", "Send"]],
  thread: ["heart", "comment", "repost", "send"],
};

// Fills in the values the shared text drawing needs and a post style does not set.
function textSpec(part) {
  return {
    uppercase: false,
    emphasis: "italic",
    emphasisColor: part.color,
    shadowBlur: 0,
    shadowY: 0,
    shadowColor: "#000000",
    ...part,
  };
}

// One line of plain text: highlight marks and stars are removed.
const plain = (raw) => cleanLine(stripHighlights(String(raw ?? ""))).replace(/\*/g, "").trim();

// The first letters of the first two words, shown when there is no picture.
export function initials(name) {
  const words = plain(name).split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => [...word][0].toLocaleUpperCase()).join("") || "?";
}

// Shortens text with an ellipsis until it fits maxWidth in the context's current font.
function fitLine(ctx, text, maxWidth) {
  if (!text || ctx.measureText(text).width <= maxWidth) return text;
  const chars = [...text];
  while (chars.length && ctx.measureText(`${chars.join("").trimEnd()}…`).width > maxWidth) chars.pop();
  return chars.length ? `${chars.join("").trimEnd()}…` : "";
}

// Measures and places every part of the post. All positions are in canvas pixels.
// actions: false leaves out the row of action icons (like, reply, share and similar).
export function layoutPost(ctx, { width, height, name = "", handle = "", date = "", text = "", verified = false, actions = true, style }) {
  const u = Math.min(width, height) / 1080;
  const kind = KINDS.has(style.kind) ? style.kind : "short";
  const margin = style.layout.margin * u;
  const pad = style.card.padding * u;
  const cardX = margin;
  const cardW = Math.max(200 * u, width - margin * 2);
  const innerX = cardX + pad;
  const innerW = Math.max(40 * u, cardW - pad * 2);
  const maxCardH = Math.max(100 * u, height - margin * 2);
  const n = style.profile.size * u;
  const m = n * 0.88;
  const icon = n * 1.2;
  const badgeSize = n * 0.95;
  const dotsW = n * 1.2;
  const nameFont = fontString(style.profile.font, style.profile.weight, false, n);
  const mutedFont = (size) => fontString(style.profile.font, 400, false, size);
  const shown = { name: plain(name), handle: plain(handle), date: plain(date) };
  const out = {
    width, height, u, kind, style,
    card: null, avatar: null, ring: null, dots: null, media: null, body: null,
    lines: [], badges: [], icons: [], dividers: [],
    fittedDown: false,
  };

  ctx.save();
  setSpacing(ctx, "0px");

  // The name, then the badge when the post is verified. Returns where the name ends.
  const placeName = (value, x, y, maxWidth, size = n, font = nameFont) => {
    const badgeRoom = verified ? badgeSize + 10 * u : 0;
    ctx.font = font;
    const fitted = fitLine(ctx, value, Math.max(0, maxWidth - badgeRoom));
    out.lines.push({ text: fitted, font, color: style.profile.color, x, y });
    let end = x + ctx.measureText(fitted).width;
    if (verified) {
      out.badges.push({ x: end + 8 * u + badgeSize / 2, y: y - size * 0.36, size: badgeSize });
      end += badgeRoom;
    }
    return end;
  };
  const placeMuted = (value, x, y, maxWidth, size = m) => {
    if (!value || maxWidth <= 0) return x;
    const font = mutedFont(size);
    ctx.font = font;
    const fitted = fitLine(ctx, value, maxWidth);
    out.lines.push({ text: fitted, font, color: style.muted, x, y });
    return x + ctx.measureText(fitted).width;
  };
  const dotsAt = (y) => {
    out.dots = { x: innerX + innerW - dotsW / 2, y, size: n };
  };
  const fitBody = (maxWidth, maxHeight, balance = false) => {
    const article = cleanArticle(text);
    const paragraphs = parseArticle(article, { keepLineBreaks: true });
    const spec = textSpec(style.body);
    const space100 = measureParagraphs(ctx, paragraphs, spec);
    const fitted = fitText(paragraphs, {
      maxWidth: Math.max(1, maxWidth),
      maxHeight: Math.max(0, maxHeight),
      maxSize: style.body.size * u,
      minSize: 12 * u,
      lineHeight: style.body.lineHeight,
      paragraphGap: 0.7,
      balance,
      space100,
    });
    out.fittedDown = paragraphs.length > 0 && fitted.size < style.body.size * u - 0.5;
    return { fitted, spec, rtl: isRtl(stripHighlights(article)), empty: paragraphs.length === 0 };
  };
  const iconRow = (names, y, size, xs) => {
    names.forEach((iconName, i) => out.icons.push({ name: iconName, x: xs(i), y, size }));
  };

  let y = pad;
  if (kind === "short" || kind === "work") {
    const work = kind === "work";
    const avatarSize = n * (work ? 3.2 : 2.9);
    const colX = innerX + avatarSize + 22 * u;
    const colW = innerW - avatarSize - 22 * u - dotsW - 16 * u;
    // Lines beside the picture: name, then handle (a headline in a work post), then the date.
    const rows = [n * 1.22];
    if (shown.handle) rows.push(m * 1.3);
    if (work && shown.date) rows.push(m * 1.3);
    const blockH = rows.reduce((sum, row) => sum + row, 0);
    const headerH = Math.max(avatarSize, blockH);
    out.avatar = { x: innerX, y: y + (headerH - avatarSize) / 2, size: avatarSize };
    let line = y + (headerH - blockH) / 2;
    const nameY = line + n * 0.96;
    placeName(shown.name, colX, nameY, colW);
    dotsAt(work ? y + n * 0.6 : nameY - n * 0.32);
    line += rows[0];
    if (shown.handle) {
      placeMuted(shown.handle, colX, line + m * 0.98, colW);
      line += m * 1.3;
    }
    if (work && shown.date) {
      const end = placeMuted(`${shown.date} · `, colX, line + m * 0.98, colW - m);
      out.icons.push({ name: "globe", x: end, y: line + m * 0.2, size: m * 0.95, muted: true });
    }
    y += headerH;

    const headerGap = (work ? 30 : 34) * u;
    const dateH = !work && shown.date ? 34 * u + m * 1.3 : 0;
    const actionsH = actions ? (work ? 28 + 22 : 30 + 30) * u + icon : 0;
    const body = fitBody(innerW, maxCardH - pad * 2 - headerH - headerGap - dateH - actionsH);
    if (!body.empty) {
      y += headerGap;
      out.body = { ...body, x: innerX, y, w: innerW, align: body.rtl ? "right" : "left" };
      y += body.fitted.height;
    }
    if (dateH) {
      y += 34 * u;
      placeMuted(shown.date, innerX, y + m * 0.98, innerW);
      y += m * 1.3;
    }
    if (actions) {
      y += (work ? 28 : 30) * u;
      out.dividers.push({ x: innerX, y, w: innerW });
      y += (work ? 22 : 30) * u;
      if (work) {
        const labelFont = fontString(style.profile.font, 600, false, m);
        ctx.font = labelFont;
        ACTIONS.work.forEach(([iconName, label], i) => {
          const groupW = icon + 10 * u + ctx.measureText(label).width;
          const x = innerX + (innerW * (i + 0.5)) / 4 - groupW / 2;
          out.icons.push({ name: iconName, x, y, size: icon, label, labelFont, labelX: x + icon + 10 * u, labelY: y + icon / 2 + m * 0.35 });
        });
      } else {
        const names = ACTIONS.short;
        iconRow(names, y, icon, (i) => innerX + (i * (innerW - icon)) / (names.length - 1));
      }
      y += icon;
    }
    y += pad;
  } else if (kind === "thread") {
    const avatarSize = n * 2.7;
    out.avatar = { x: innerX, y, size: avatarSize };
    const colX = innerX + avatarSize + 24 * u;
    const colW = innerW - avatarSize - 24 * u;
    const lineW = colW - dotsW - 16 * u;
    const nameY = y + n * 1.0;
    const nameEnd = placeName(shown.name, colX, nameY, lineW * 0.62);
    const rest = [shown.handle, shown.date].filter(Boolean).join(" · ");
    placeMuted(rest, nameEnd + 12 * u, nameY, colX + lineW - nameEnd - 12 * u, n * 0.94);
    dotsAt(nameY - n * 0.32);
    const headerH = n * 1.3 + 8 * u;
    const actionsH = actions ? 28 * u + icon : 0;
    const body = fitBody(colW, maxCardH - pad * 2 - headerH - actionsH);
    let column = y + headerH;
    if (!body.empty) {
      out.body = { ...body, x: colX, y: column, w: colW, align: body.rtl ? "right" : "left" };
      column += body.fitted.height;
    }
    if (actions) {
      column += 28 * u;
      iconRow(ACTIONS.thread, column, icon, (i) => colX + i * (icon + 30 * u));
      column += icon;
    }
    y = Math.max(column, y + avatarSize) + pad;
  } else {
    // Photo post: a header row, the text on a coloured square, then icons and the date.
    const avatarSize = n * 2.3;
    const ring = 6 * u;
    const ringSize = avatarSize + ring * 2;
    out.avatar = { x: innerX + ring, y: y + ring, size: avatarSize };
    out.ring = { x: innerX + ringSize / 2, y: y + ringSize / 2, r: ringSize / 2 - 1.75 * u, width: 3.5 * u };
    const colX = innerX + ringSize + 20 * u;
    const colW = innerW - ringSize - 20 * u - dotsW - 16 * u;
    const title = shown.handle ? shown.handle.replace(/^@/, "") : shown.name;
    const sub = shown.handle ? shown.name : "";
    const blockH = n * 1.22 + (sub ? m * 1.3 : 0);
    const top = y + (ringSize - blockH) / 2;
    const titleY = top + n * 0.96;
    placeName(title, colX, titleY, colW);
    if (sub) placeMuted(sub, colX, top + n * 1.22 + m * 0.98, colW);
    dotsAt(y + ringSize / 2);
    y += ringSize + pad * 0.8;

    const rowIcon = icon * 1.1;
    const dateGap = (actions ? 18 : 26) * u;
    const footerH = (actions ? 26 * u + rowIcon : 0) + (shown.date ? dateGap + m * 1.3 : 0) + pad;
    const mediaH = Math.max(80 * u, Math.min(cardW, maxCardH - y - footerH));
    out.media = { x: cardX, y, w: cardW, h: mediaH };
    const inset = Math.max(48 * u, cardW * 0.09);
    const body = fitBody(cardW - inset * 2, mediaH - inset * 2, true);
    if (!body.empty) {
      out.body = { ...body, x: cardX + inset, y: y + (mediaH - body.fitted.height) / 2, w: cardW - inset * 2, align: "center" };
    }
    y += mediaH;
    if (actions) {
      y += 26 * u;
      const gap = 30 * u;
      iconRow(["heart", "comment", "send"], y, rowIcon, (i) => innerX + i * (rowIcon + gap));
      out.icons.push({ name: "bookmark", x: innerX + innerW - rowIcon, y, size: rowIcon });
      y += rowIcon;
    }
    if (shown.date) {
      y += dateGap;
      placeMuted(shown.date, innerX, y + m * 0.98, innerW);
      y += m * 1.3;
    }
    y += pad;
  }
  ctx.restore();

  // Centre the card in the image. Every part was placed from the card's top edge.
  const cardY = (height - y) / 2;
  out.card = { x: cardX, y: cardY, w: cardW, h: y };
  for (const part of [out.avatar, out.ring, out.dots, out.media, out.body, ...out.lines, ...out.badges, ...out.icons, ...out.dividers]) {
    if (!part) continue;
    part.y += cardY;
    if (part.labelY !== undefined) part.labelY += cardY;
  }
  return out;
}

function drawIcon(ctx, iconName, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(ICONS[iconName]));
  ctx.restore();
}

// A round badge with eight soft points and a tick.
function drawBadge(ctx, cx, cy, size, color) {
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 96; i += 1) {
    const angle = (i / 96) * Math.PI * 2;
    const radius = r * (0.88 + 0.12 * Math.cos(8 * angle));
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.38, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.3);
  ctx.lineTo(cx + r * 0.4, cy - r * 0.28);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function drawAvatar(ctx, { x, y, size }, image, style, name) {
  ctx.save();
  ctx.beginPath();
  if (style.avatar.shape === "rounded") ctx.roundRect(x, y, size, size, size * 0.2);
  else ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  const iw = image?.naturalWidth || image?.width || 0;
  const ih = image?.naturalHeight || image?.height || 0;
  if (iw && ih) {
    // Fill the circle: the middle square of the picture is used.
    const side = Math.min(iw, ih);
    ctx.drawImage(image, (iw - side) / 2, (ih - side) / 2, side, side, x, y, size, size);
  } else {
    ctx.fillStyle = style.avatar.color;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = readableInk(style.avatar.color, "#ffffff");
    ctx.font = fontString(style.profile.font, 600, false, size * 0.4);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(name), x + size / 2, y + size / 2 + size * 0.02);
  }
  ctx.restore();
}

function drawBody(ctx, body, u) {
  const { fitted, spec, rtl, x, y, w, align } = body;
  const size = fitted.size;
  const baselineOffset = (size * spec.lineHeight) / 2 + size * 0.33;
  const lineX = (lineWidth) => {
    if (align === "center") return x + (w - lineWidth) / 2;
    if (align === "right") return x + w - lineWidth;
    return x;
  };
  const drawSpec = { q: spec, u, rtl };
  const placed = fitted.lines.map((line) => ({
    y: y + line.y + baselineOffset,
    runs: measureLine(ctx, line, lineX(line.width), size, drawSpec),
  }));
  placed.forEach(({ runs, y: baseline }) => paintBands(ctx, runs, baseline, size));
  placed.forEach(({ runs, y: baseline }) => drawRuns(ctx, runs, baseline, size, drawSpec));
}

// Draws the post. avatar is a loaded image, or null for initials on a coloured circle.
export function renderPost(ctx, input) {
  const { width, height, avatar = null, name = "" } = input;
  const layout = layoutPost(ctx, input);
  const { u, style, card } = layout;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fontKerning = "normal";
  if ("textRendering" in ctx) ctx.textRendering = "optimizeLegibility";

  paintBackground(ctx, width, height, style.background);
  paintTexture(ctx, width, height, u, style.texture);

  const radius = style.card.radius * u;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.w, card.h, radius);
  if (style.card.shadow > 0) {
    ctx.shadowColor = `rgba(0, 0, 0, ${style.card.shadow})`;
    ctx.shadowBlur = 60 * u;
    ctx.shadowOffsetY = 18 * u;
  }
  ctx.fillStyle = style.card.color;
  ctx.fill();
  ctx.restore();

  if (layout.media) {
    const { x, y, w, h } = layout.media;
    ctx.save();
    ctx.translate(x, y);
    paintBackground(ctx, w, h, style.media);
    ctx.restore();
  }

  ctx.fillStyle = style.divider;
  for (const divider of layout.dividers) ctx.fillRect(divider.x, divider.y, divider.w, Math.max(1, 1.5 * u));

  if (layout.ring) {
    const { x, y, r, width: lineWidth } = layout.ring;
    const gradient = ctx.createLinearGradient(x - r, y + r, x + r, y - r);
    gradient.addColorStop(0, style.media.color1);
    gradient.addColorStop(1, style.media.color2 || style.media.color1);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }
  if (layout.avatar) drawAvatar(ctx, layout.avatar, avatar, style, name);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const line of layout.lines) {
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, line.x, line.y);
  }
  for (const badge of layout.badges) drawBadge(ctx, badge.x, badge.y, badge.size, style.badge);

  if (layout.dots) {
    const { x, y, size } = layout.dots;
    ctx.fillStyle = style.muted;
    for (const dx of [-0.3, 0, 0.3]) {
      ctx.beginPath();
      ctx.arc(x + dx * size, y, size * 0.075, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const item of layout.icons) {
    drawIcon(ctx, item.name, item.x, item.y, item.size, style.muted);
    if (item.label) {
      ctx.font = item.labelFont;
      ctx.fillStyle = style.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.label, item.labelX, item.labelY);
    }
  }

  if (layout.body) drawBody(ctx, layout.body, u);

  if (style.card.borderWidth > 0) {
    const line = style.card.borderWidth * u;
    ctx.beginPath();
    ctx.roundRect(card.x + line / 2, card.y + line / 2, card.w - line, card.h - line, Math.max(0, radius - line / 2));
    ctx.strokeStyle = style.card.border;
    ctx.lineWidth = line;
    ctx.stroke();
  }
  ctx.restore();
  return {
    fontSize: layout.body ? layout.body.fitted.size / u : style.body.size,
    fittedDown: layout.fittedDown,
  };
}

// Loads every font face a post style uses. A canvas draws fallback fonts until this finishes.
export async function ensurePostFonts(style) {
  if (typeof document === "undefined" || !document.fonts) return;
  const sample = "Aa“—@";
  const body = textSpec(style.body);
  const needed = [
    ...["", "b", "i", "bi"].map((look) => lookFont(body, look, 40)),
    fontString(style.profile.font, style.profile.weight, false, 40),
    fontString(style.profile.font, 400, false, 40),
    fontString(style.profile.font, 600, false, 40),
    ...textureFonts(style.texture),
  ];
  await Promise.all(needed.map((font) => document.fonts.load(font, sample).catch(() => null)));
}
