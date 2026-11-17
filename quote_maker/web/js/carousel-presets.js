// The default carousel style values and the built-in carousel styles.
// Sizes are in units of 1/1080 of the slide's shorter side, the same as quote styles.

import { mergeDeep } from "./presets.js";

export const DEFAULT_CAROUSEL_STYLE = {
  background: { type: "solid", color1: "#161616", color2: "#262626", color3: "", angle: 160 },
  texture: { type: "none", opacity: 0.1, color: "#000000" },
  frame: {
    type: "none",
    color: "#ffffff",
    width: 3,
    inset: 44,
    radius: 28,
    cardColor: "#ffffff",
    cardOpacity: 1,
    cardShadow: 0.18,
  },
  // top: everything starts at the top margin. body: the body is centred in the space below the
  // title. all: the title, subtitle and body are centred as one block.
  layout: { marginX: 110, marginTop: 115, marginBottom: 105, align: "left", vAlign: "top" },
  title: {
    font: "Newsreader",
    weight: 700,
    italic: false,
    color: "#ffffff",
    size: 68,
    lineHeight: 1.1,
    letterSpacing: 0,
    uppercase: false,
  },
  subtitle: {
    font: "Newsreader",
    weight: 400,
    italic: false,
    color: "#888888",
    size: 25,
    lineHeight: 1.44,
    letterSpacing: 0,
    uppercase: false,
    gap: 18,
  },
  body: {
    font: "Newsreader",
    weight: 400,
    italic: false,
    color: "#d4d0c8",
    size: 31,
    lineHeight: 1.74,
    letterSpacing: 0,
    paragraphGap: 0.43,
    gap: 50,
  },
  pageNumber: { position: "right", font: "Newsreader", color: "#888888", size: 20 },
};

// Fills in any values missing from a saved style, so older saved styles keep working.
export function withCarouselDefaults(style) {
  return mergeDeep(DEFAULT_CAROUSEL_STYLE, style);
}

function preset(name, overrides) {
  const id = `carousel-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return { ...withCarouselDefaults(overrides), id, name };
}

const family = (font) => ({ title: { font }, subtitle: { font }, body: { font }, pageNumber: { font } });

export const CAROUSEL_PRESETS = [
  // The look of the earlier carousel app: light serif text on near-black.
  preset("Dark editorial", {}),
  preset(
    "Paper",
    mergeDeep(family("Lora"), {
      background: { color1: "#f6f1e7" },
      texture: { type: "grain", opacity: 0.08 },
      title: { font: "Fraunces", weight: 600, color: "#1c1a17" },
      subtitle: { color: "#6d675c" },
      body: { color: "#2a2622", size: 30 },
      pageNumber: { color: "#6d675c" },
    }),
  ),
  preset(
    "Clean",
    mergeDeep(family("Inter"), {
      background: { color1: "#ffffff" },
      title: { weight: 700, color: "#111111", size: 62, letterSpacing: -0.01 },
      subtitle: { color: "#777777", size: 24 },
      body: { color: "#222222", size: 29, lineHeight: 1.66 },
      pageNumber: { color: "#999999" },
    }),
  ),
  preset(
    "Signal",
    mergeDeep(family("Inter"), {
      background: { color1: "#1d3cf0" },
      title: { font: "Space Grotesk", weight: 700, color: "#ffffff", size: 70, lineHeight: 1.05 },
      subtitle: { color: "#c9d1ff", weight: 500 },
      body: { color: "#ffffff", size: 30, lineHeight: 1.6 },
      pageNumber: { color: "#c9d1ff" },
    }),
  ),
  preset(
    "Typewriter",
    mergeDeep(family("JetBrains Mono"), {
      background: { color1: "#f2f0e8" },
      texture: { type: "grain", opacity: 0.06 },
      title: { color: "#1f1f1f", size: 54, lineHeight: 1.2 },
      subtitle: { color: "#6a6a62", size: 23 },
      body: { color: "#2b2b28", size: 26, lineHeight: 1.7 },
      pageNumber: { color: "#6a6a62", size: 18 },
    }),
  ),
  preset(
    "Card",
    mergeDeep(family("Fraunces"), {
      background: { type: "linear", color1: "#ffd8c2", color2: "#f4a6a6", angle: 160 },
      frame: { type: "card", inset: 60, radius: 36, cardColor: "#fffaf5", cardShadow: 0.16 },
      layout: { marginX: 130, marginTop: 135, marginBottom: 180 },
      title: { weight: 600, color: "#2a1b17", size: 62 },
      subtitle: { color: "#8a6a60" },
      body: { color: "#3a2a25", size: 29 },
      pageNumber: { color: "#8a6a60" },
    }),
  ),
];
