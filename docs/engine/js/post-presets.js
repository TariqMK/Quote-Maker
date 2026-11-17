// The default post style values and the built-in post styles.
// A post style draws the text as a social media post: a card with a picture, name, handle,
// date and the post text. The looks follow common post layouts, with no platform logos.
// Sizes are in units of 1/1080 of the image's shorter side, the same as quote styles.

import { mergeDeep } from "./presets.js";

// The four post layouts. short: a short public post. work: a post on a work network.
// thread: a reply-style post with the text beside the picture. photo: a photo post with the
// text on a coloured square.
export const POST_KINDS = [
  ["short", "Short post"],
  ["work", "Work post"],
  ["thread", "Thread post"],
  ["photo", "Photo post"],
];

export const DEFAULT_POST_STYLE = {
  kind: "short",
  background: { type: "linear", color1: "#e9eef2", color2: "#d5dde4", color3: "", angle: 160 },
  texture: { type: "none", opacity: 0.1, color: "#000000" },
  layout: { margin: 72 },
  card: { color: "#ffffff", border: "#e1e8ed", borderWidth: 0, radius: 36, shadow: 0.14, padding: 56 },
  body: { font: "Inter", weight: 400, italic: false, color: "#0f1419", size: 46, lineHeight: 1.36, letterSpacing: 0 },
  // The person's name. Muted text uses the same font at weight 400.
  profile: { font: "Inter", weight: 700, color: "#0f1419", size: 34 },
  // Handle, date, icons and the dots menu.
  muted: "#536471",
  divider: "#e6ecf0",
  badge: "#1d9bf0",
  avatar: { shape: "circle", color: "#1d9bf0" },
  // The coloured square of a photo post. The post text on it uses body.color.
  media: { type: "linear", color1: "#ff9a62", color2: "#d6457b", color3: "", angle: 135 },
};

// Fills in any values missing from a saved style, so older saved styles keep working.
export function withPostDefaults(style) {
  return mergeDeep(DEFAULT_POST_STYLE, style);
}

function preset(name, category, overrides) {
  const id = `post-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return { ...withPostDefaults(overrides), id, name, category };
}

export const POST_CATEGORIES = POST_KINDS.map(([, name]) => name);

// Card, text and detail colours in one call: card, border, text, muted, divider.
const scheme = (card, border, text, muted, divider) => ({
  card: { color: card, border },
  body: { color: text },
  profile: { color: text },
  muted,
  divider,
});

export const POST_PRESETS = [
  preset("Short light", "Short post", {}),
  preset(
    "Short dim",
    "Short post",
    mergeDeep(scheme("#15202b", "#38444d", "#f7f9f9", "#8b98a5", "#38444d"), {
      background: { color1: "#0b1218", color2: "#1c2a36" },
      card: { shadow: 0.35 },
    }),
  ),
  preset(
    "Short dark",
    "Short post",
    mergeDeep(scheme("#000000", "#2f3336", "#e7e9ea", "#71767b", "#2f3336"), {
      background: { type: "solid", color1: "#000000" },
      card: { borderWidth: 2, shadow: 0 },
    }),
  ),
  preset(
    "Work light",
    "Work post",
    mergeDeep(scheme("#ffffff", "#e0dfdc", "#191919", "#666666", "#e8e8e8"), {
      kind: "work",
      background: { type: "solid", color1: "#f4f2ee" },
      card: { radius: 20, shadow: 0.08, borderWidth: 2 },
      body: { size: 40, lineHeight: 1.42 },
      profile: { weight: 600, size: 32 },
      badge: "#0a66c2",
      avatar: { color: "#0a66c2" },
    }),
  ),
  preset(
    "Work dark",
    "Work post",
    mergeDeep(scheme("#1b1f23", "#38434f", "#e9e9e9", "#a6a6a6", "#38434f"), {
      kind: "work",
      background: { type: "solid", color1: "#000000" },
      card: { radius: 20, shadow: 0, borderWidth: 2 },
      body: { size: 40, lineHeight: 1.42 },
      profile: { weight: 600, size: 32 },
      badge: "#71b7fb",
      avatar: { color: "#378fe9" },
    }),
  ),
  preset(
    "Thread light",
    "Thread post",
    mergeDeep(scheme("#ffffff", "#e5e5e5", "#101010", "#8a8a8a", "#ededed"), {
      kind: "thread",
      background: { type: "solid", color1: "#f5f5f5" },
      card: { shadow: 0.1 },
      body: { size: 42 },
      profile: { weight: 600, size: 32 },
      badge: "#0095f6",
      avatar: { color: "#101010" },
    }),
  ),
  preset(
    "Thread dark",
    "Thread post",
    mergeDeep(scheme("#181818", "#2d2d2d", "#f3f5f7", "#777777", "#2d2d2d"), {
      kind: "thread",
      background: { type: "solid", color1: "#0a0a0a" },
      card: { borderWidth: 2, shadow: 0 },
      body: { size: 42 },
      profile: { weight: 600, size: 32 },
      badge: "#0095f6",
      avatar: { color: "#3a3a3a" },
    }),
  ),
  preset(
    "Thread sky",
    "Thread post",
    mergeDeep(scheme("#ffffff", "#d4dbe2", "#0b0f14", "#66788a", "#d4dbe2"), {
      kind: "thread",
      background: { type: "linear", color1: "#cfe8ff", color2: "#7fb6f5", angle: 170 },
      card: { radius: 28, shadow: 0.16 },
      body: { size: 42 },
      profile: { size: 32 },
      badge: "#1083fe",
      avatar: { color: "#1083fe" },
    }),
  ),
  preset(
    "Photo sunset",
    "Photo post",
    mergeDeep(scheme("#ffffff", "#dbdbdb", "#ffffff", "#737373", "#efefef"), {
      kind: "photo",
      background: { type: "solid", color1: "#fafafa" },
      card: { radius: 28, shadow: 0.12, padding: 36 },
      body: { font: "Fraunces", weight: 500, size: 68, lineHeight: 1.22 },
      profile: { color: "#0c1014", weight: 600, size: 30 },
      badge: "#0095f6",
      avatar: { color: "#d6457b" },
    }),
  ),
  preset(
    "Photo night",
    "Photo post",
    mergeDeep(scheme("#000000", "#262626", "#ffffff", "#a8a8a8", "#262626"), {
      kind: "photo",
      background: { type: "solid", color1: "#121212" },
      card: { radius: 28, shadow: 0, borderWidth: 2, padding: 36 },
      body: { font: "Fraunces", weight: 500, size: 68, lineHeight: 1.22 },
      profile: { color: "#f5f5f5", weight: 600, size: 30 },
      badge: "#0095f6",
      avatar: { color: "#4f5bd5" },
      media: { color1: "#4f5bd5", color2: "#962fbf", angle: 145 },
    }),
  ),
];
