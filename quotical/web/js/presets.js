// The default style values and the built-in preset styles.

export const DEFAULT_STYLE = {
  background: { type: "solid", color1: "#f6f1e7", color2: "#e8dfcd", color3: "", angle: 160 },
  texture: { type: "none", opacity: 0.1, color: "#000000" },
  decor: { type: "none", color: "#d9482b", opacity: 1 },
  frame: {
    type: "none",
    color: "#1c1a17",
    width: 3,
    inset: 44,
    radius: 28,
    cardColor: "#ffffff",
    cardOpacity: 1,
    cardShadow: 0.18,
  },
  layout: { margin: 110, align: "center", vAlign: "center", textWidth: 100 },
  quote: {
    font: "Fraunces",
    weight: 400,
    italic: false,
    color: "#1c1a17",
    size: 84,
    lineHeight: 1.28,
    letterSpacing: 0,
    uppercase: false,
    balance: true,
    shadowBlur: 0,
    shadowY: 0,
    shadowColor: "#000000",
    emphasis: "italic",
    emphasisColor: "#d9482b",
  },
  mark: { type: "none", font: "Fraunces", color: "#d9482b", size: 200, opacity: 1 },
  rule: { type: "none", color: "#1c1a17", width: 80, thickness: 3 },
  author: {
    font: "Inter",
    weight: 500,
    italic: false,
    color: "#1c1a17",
    size: 30,
    letterSpacing: 0.02,
    uppercase: false,
    dash: true,
    gap: 56,
  },
  source: { font: "Inter", weight: 400, italic: false, color: "#6d675c", size: 26 },
};

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Copies base and applies overrides, one level of nesting at a time.
export function mergeDeep(base, overrides) {
  const out = {};
  for (const key of Object.keys(base)) {
    out[key] = isPlainObject(base[key]) ? mergeDeep(base[key], {}) : base[key];
  }
  for (const [key, value] of Object.entries(overrides ?? {})) {
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? mergeDeep(out[key], value) : value;
  }
  return out;
}

// Fills in any values missing from a saved style, so older saved styles keep working.
export function withDefaults(style) {
  return mergeDeep(DEFAULT_STYLE, style);
}

function preset(name, category, overrides) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { ...withDefaults(overrides), id, name, category };
}

const ink = (color, muted = color) => ({
  quote: { color },
  author: { color },
  source: { color: muted },
  rule: { color },
  frame: { color },
});

function tone(color, muted, overrides) {
  return mergeDeep(ink(color, muted), overrides);
}

export const CATEGORIES = ["Classic", "Modern", "Bold", "Soft", "Retro"];

export const PRESETS = [
  // Classic: book pages and engraved stationery.
  preset("Book page", "Classic", {
    background: { color1: "#f6f1e7" },
    texture: { type: "grain", opacity: 0.08 },
    quote: { font: "EB Garamond", size: 86, lineHeight: 1.3 },
    mark: { type: "top", font: "EB Garamond", color: "#a2371f", size: 190 },
    author: { font: "EB Garamond", size: 36, letterSpacing: 0 },
    source: { font: "EB Garamond", italic: true, size: 32 },
  }),
  preset("Aged page", "Classic", tone("#2b1d10", "#5e4a30", {
    background: { type: "radial", color1: "#ecdfc0", color2: "#e0cda3", color3: "#a98a56" },
    texture: { type: "grain", opacity: 0.22 },
    rule: { type: "short", width: 70, thickness: 2 },
    quote: { font: "EB Garamond", weight: 500, size: 88, lineHeight: 1.32 },
    author: { font: "EB Garamond", weight: 500, size: 28, uppercase: true, letterSpacing: 0.14, dash: false },
    source: { font: "EB Garamond", italic: true, size: 32 },
    layout: { margin: 130 },
  })),
  preset("Engraved", "Classic", tone("#22303a", "#5a6a75", {
    background: { color1: "#f4f1ea" },
    frame: { type: "double", width: 2, inset: 44 },
    quote: { font: "Cormorant", weight: 500, size: 92, lineHeight: 1.2 },
    rule: { type: "short", width: 70, thickness: 2 },
    author: { font: "Cormorant", weight: 600, size: 30, uppercase: true, letterSpacing: 0.18, dash: false },
    source: { font: "Cormorant", italic: true, size: 32 },
    layout: { margin: 140 },
  })),
  preset("Midnight study", "Classic", tone("#efe6d2", "#a79c86", {
    background: { type: "radial", color1: "#22242e", color2: "#0f1016" },
    quote: { font: "Playfair Display", italic: true, size: 80, lineHeight: 1.32, emphasis: "color", emphasisColor: "#e5b567" },
    mark: { type: "top", font: "Playfair Display", color: "#e5b567", size: 190 },
    author: { font: "Instrument Sans", letterSpacing: 0.04 },
    source: { font: "Instrument Sans" },
  })),
  preset("Oxblood", "Classic", tone("#f3e5d6", "#cda99a", {
    background: { color1: "#5a1a1e" },
    texture: { type: "grain", opacity: 0.1 },
    frame: { type: "line", width: 2, inset: 40 },
    quote: { font: "DM Serif Display", size: 84, lineHeight: 1.22 },
    author: { font: "Lora", italic: true, weight: 400, size: 34, dash: true, letterSpacing: 0 },
    source: { font: "Lora", size: 26 },
    layout: { margin: 130 },
  })),
  preset("Margin note", "Classic", {
    background: { color1: "#fbf8f1" },
    layout: { align: "left", margin: 120 },
    quote: { font: "Newsreader", size: 80, lineHeight: 1.3, emphasis: "color", emphasisColor: "#a2371f" },
    mark: { type: "bar", color: "#a2371f" },
    author: { font: "Newsreader", weight: 500, size: 34, letterSpacing: 0 },
    source: { font: "Newsreader", italic: true, size: 32 },
  }),
  preset("Typewriter", "Classic", tone("#2b2925", "#6f695f", {
    background: { color1: "#ece5d5" },
    texture: { type: "grain", opacity: 0.14 },
    layout: { align: "left", margin: 120 },
    quote: { font: "Special Elite", size: 64, lineHeight: 1.45, balance: false, emphasis: "color", emphasisColor: "#a2371f" },
    author: { font: "Special Elite", weight: 400, size: 32, letterSpacing: 0 },
    source: { font: "Special Elite", size: 28 },
  })),

  // Modern: plain type with exact spacing.
  preset("Plain white", "Modern", tone("#111214", "#6b6e75", {
    background: { color1: "#ffffff" },
    layout: { align: "left", margin: 110, vAlign: "bottom" },
    quote: { font: "Inter", weight: 500, size: 76, lineHeight: 1.18, letterSpacing: -0.025, emphasis: "color", emphasisColor: "#2456e6" },
    author: { size: 30, dash: false, weight: 600, letterSpacing: 0 },
  })),
  preset("Graphite", "Modern", tone("#f2f2f0", "#8f9094", {
    background: { color1: "#17181a" },
    layout: { align: "left", margin: 110 },
    quote: { font: "Manrope", weight: 500, size: 74, lineHeight: 1.22, letterSpacing: -0.02, emphasis: "color", emphasisColor: "#f2b84b" },
    author: { font: "Manrope", dash: false, weight: 600, letterSpacing: 0 },
    source: { font: "Manrope" },
  })),
  preset("Terminal", "Modern", tone("#c9f7c5", "#6fa56c", {
    background: { color1: "#0b0f0c" },
    texture: { type: "lines", opacity: 0.05, color: "#c9f7c5" },
    layout: { align: "left", margin: 100 },
    quote: { font: "JetBrains Mono", size: 58, lineHeight: 1.42, balance: false, emphasis: "color", emphasisColor: "#ffffff" },
    author: { font: "JetBrains Mono", weight: 400, size: 28, letterSpacing: 0 },
    source: { font: "JetBrains Mono", size: 24 },
  })),
  preset("Blueprint", "Modern", tone("#e7f0ff", "#9ebbe8", {
    background: { color1: "#14366f" },
    texture: { type: "grid", opacity: 0.12, color: "#ffffff" },
    frame: { type: "corners", width: 3, inset: 48 },
    layout: { align: "left", margin: 130 },
    quote: { font: "Space Grotesk", weight: 500, size: 70, lineHeight: 1.24, emphasis: "color", emphasisColor: "#ffd66b" },
    author: { font: "IBM Plex Mono", weight: 400, size: 26, letterSpacing: 0, uppercase: true },
    source: { font: "IBM Plex Mono", size: 24 },
  })),
  preset("Swiss", "Modern", tone("#111111", "#111111", {
    background: { color1: "#f2efe9" },
    decor: { type: "band", color: "#d62e1f" },
    layout: { align: "left", margin: 100, vAlign: "bottom", textWidth: 92 },
    quote: { font: "Instrument Sans", weight: 600, size: 84, lineHeight: 1.08, letterSpacing: -0.03, balance: false, emphasis: "color", emphasisColor: "#d62e1f" },
    author: { font: "Instrument Sans", dash: false, weight: 600, letterSpacing: 0, size: 28 },
    source: { font: "Instrument Sans", size: 28 },
  })),
  preset("Index card", "Modern", tone("#1f2328", "#6a7077", {
    background: { color1: "#d9dde2" },
    frame: { type: "card", cardColor: "#ffffff", radius: 24, inset: 76, cardShadow: 0.16 },
    layout: { margin: 170, align: "left" },
    quote: { font: "Outfit", weight: 400, size: 62, lineHeight: 1.3 },
    author: { font: "Outfit", dash: false, weight: 500, letterSpacing: 0 },
    source: { font: "Outfit" },
  })),

  // Bold: poster type that fills the frame.
  preset("Poster", "Bold", tone("#111111", "#111111", {
    background: { color1: "#f5cf3a" },
    layout: { margin: 80, align: "left", textWidth: 100 },
    quote: { font: "Bebas Neue", size: 170, lineHeight: 1.0, letterSpacing: 0.005, balance: false, emphasis: "color", emphasisColor: "#d62e1f" },
    author: { font: "Inter", weight: 700, dash: false, letterSpacing: 0, size: 30 },
    source: { font: "Inter", weight: 400, size: 26 },
  })),
  preset("Headline", "Bold", tone("#ffffff", "#ffb3a8", {
    background: { color1: "#d62e1f" },
    layout: { margin: 80, align: "left", vAlign: "bottom" },
    quote: { font: "Oswald", weight: 600, size: 130, lineHeight: 1.1, uppercase: true, balance: false, emphasis: "color", emphasisColor: "#111111" },
    author: { font: "Oswald", weight: 400, dash: false, size: 34, uppercase: true, letterSpacing: 0.06 },
    source: { font: "Oswald", weight: 300, size: 28 },
  })),
  preset("Fat face", "Bold", tone("#16302b", "#3d5e56", {
    background: { color1: "#e8c9b6" },
    layout: { margin: 90 },
    quote: { font: "Abril Fatface", size: 112, lineHeight: 1.12, emphasis: "color", emphasisColor: "#b03a2e" },
    author: { font: "Lora", italic: true, weight: 400, size: 36, letterSpacing: 0 },
    source: { font: "Lora", size: 26 },
  })),
  preset("Night signal", "Bold", tone("#f6f3ec", "#a7a6a0", {
    background: { color1: "#0e0e10" },
    layout: { margin: 80, align: "left" },
    quote: { font: "Unbounded", weight: 600, size: 76, lineHeight: 1.2, letterSpacing: -0.01, balance: false, emphasis: "color", emphasisColor: "#ff5a36" },
    author: { font: "Inter", dash: false, weight: 600, letterSpacing: 0 },
  })),
  preset("Syne block", "Bold", tone("#0d2b52", "#0d2b52", {
    background: { color1: "#b7dcf5" },
    frame: { type: "line", width: 6, inset: 36 },
    layout: { margin: 100 },
    quote: { font: "Syne", weight: 800, size: 88, lineHeight: 1.12 },
    author: { font: "Syne", weight: 600, dash: false, letterSpacing: 0, size: 30 },
    source: { font: "Syne", weight: 400 },
  })),

  // Soft: gentle colour and handwriting.
  preset("First light", "Soft", tone("#3b2a2a", "#7d6158", {
    background: { type: "linear", color1: "#ffe9cf", color2: "#fbc8bb", color3: "#d9b6d9", angle: 170 },
    quote: { font: "Fraunces", weight: 300, size: 84, emphasis: "italic" },
    author: { font: "Fraunces", weight: 400, letterSpacing: 0, size: 34 },
    source: { font: "Fraunces", italic: true, weight: 300, size: 30 },
  })),
  preset("Sea glass", "Soft", tone("#123a3d", "#3f6c6e", {
    background: { type: "linear", color1: "#d9f0e6", color2: "#a9d6d8", angle: 200 },
    quote: { font: "Lora", size: 76, lineHeight: 1.36, italic: true },
    author: { font: "Instrument Sans", weight: 500 },
    source: { font: "Instrument Sans" },
  })),
  preset("Lilac dusk", "Soft", tone("#f8f1ff", "#d0c1e8", {
    background: { type: "linear", color1: "#3b2a6b", color2: "#7a4c8f", color3: "#d98a8a", angle: 160 },
    quote: { font: "Newsreader", weight: 300, size: 86, lineHeight: 1.26, shadowBlur: 24, shadowY: 4, shadowColor: "#1f1238" },
    author: { font: "Newsreader", weight: 400, size: 34, letterSpacing: 0 },
    source: { font: "Newsreader", italic: true, size: 30 },
  })),
  preset("Handwritten", "Soft", tone("#26364a", "#5f7083", {
    background: { color1: "#fdfaf0" },
    texture: { type: "lines", opacity: 0.1, color: "#6b8fb8" },
    layout: { align: "left", margin: 110 },
    quote: { font: "Caveat", weight: 500, size: 112, lineHeight: 1.16, balance: false, emphasis: "color", emphasisColor: "#b03a2e" },
    author: { font: "Caveat", weight: 600, size: 52, letterSpacing: 0 },
    source: { font: "Caveat", weight: 400, size: 44 },
  })),
  preset("Wedding card", "Soft", tone("#51443a", "#8b7b6c", {
    background: { color1: "#f7f0e8" },
    frame: { type: "double", width: 1.5, inset: 52, color: "#b09a7a" },
    layout: { margin: 150 },
    quote: { font: "Pinyon Script", size: 104, lineHeight: 1.26 },
    author: { font: "Cormorant", weight: 500, size: 30, uppercase: true, letterSpacing: 0.2, dash: false },
    source: { font: "Cormorant", italic: true, size: 30 },
  })),
  preset("Note card", "Soft", tone("#3a2f28", "#7e6e62", {
    background: { type: "linear", color1: "#c8d8c0", color2: "#a4bea0", angle: 180 },
    frame: { type: "card", cardColor: "#fffdf7", radius: 12, inset: 72, cardShadow: 0.22 },
    layout: { margin: 150 },
    quote: { font: "Dancing Script", weight: 500, size: 84, lineHeight: 1.26 },
    author: { font: "Lora", weight: 400, size: 28, letterSpacing: 0 },
    source: { font: "Lora", italic: true, size: 26 },
  })),

  // Retro: print-shop colour and simple shapes.
  preset("Sunset poster", "Retro", tone("#3a1a0e", "#3a1a0e", {
    background: { color1: "#f5e3c3" },
    texture: { type: "grain", opacity: 0.14 },
    decor: { type: "sun", color: "#ee7b3c" },
    quote: { font: "Fraunces", weight: 600, size: 78, lineHeight: 1.16 },
    author: { font: "Space Grotesk", weight: 500, letterSpacing: 0.02 },
    source: { font: "Space Grotesk", weight: 400 },
    layout: { margin: 130 },
  })),
  preset("Arch window", "Retro", tone("#f9ecd5", "#e3c6a1", {
    background: { color1: "#f2dcbc" },
    decor: { type: "arch", color: "#27514a" },
    texture: { type: "grain", opacity: 0.1 },
    layout: { margin: 210 },
    quote: { font: "Instrument Serif", size: 78, lineHeight: 1.16 },
    author: { font: "Instrument Sans", size: 24 },
    source: { font: "Instrument Sans", size: 22 },
  })),
  preset("Riso dots", "Retro", tone("#1d2b6b", "#1d2b6b", {
    background: { color1: "#ffd8cc" },
    texture: { type: "dots", opacity: 0.3, color: "#f0562f" },
    frame: { type: "line", width: 5, inset: 40 },
    layout: { margin: 120 },
    quote: { font: "DM Serif Display", size: 88, lineHeight: 1.16, emphasis: "color", emphasisColor: "#d6341a" },
    author: { font: "Space Grotesk", weight: 700, dash: false, letterSpacing: 0 },
    source: { font: "Space Grotesk", weight: 400 },
  })),
  preset("Seventies", "Retro", tone("#fbeed3", "#f0d4a6", {
    background: { color1: "#8f3b1d" },
    decor: { type: "sun", color: "#c75f22" },
    texture: { type: "grain", opacity: 0.12 },
    layout: { margin: 130 },
    quote: { font: "Abril Fatface", size: 84, lineHeight: 1.18 },
    author: { font: "Lora", italic: true, weight: 400, size: 34, letterSpacing: 0 },
    source: { font: "Lora", size: 26 },
  })),
  preset("Film title", "Retro", tone("#f4e7c6", "#b5a57e", {
    background: { type: "radial", color1: "#29241c", color2: "#0a0907" },
    texture: { type: "grain", opacity: 0.2 },
    quote: { font: "Cormorant", weight: 500, size: 90, lineHeight: 1.18, uppercase: true, letterSpacing: 0.06, shadowBlur: 30, shadowColor: "#c59a4a" },
    author: { font: "Cormorant", weight: 500, uppercase: true, letterSpacing: 0.3, size: 26, dash: false },
    source: { font: "Cormorant", italic: true, size: 28 },
    layout: { margin: 130 },
  })),
];
