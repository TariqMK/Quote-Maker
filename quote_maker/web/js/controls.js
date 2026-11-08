// Defines the Fine-tune controls and builds them. Each control reads and writes one style value.

import { FONTS } from "./fonts.js";

const fontInfo = (family) => FONTS.find((f) => f.family === family);
const hasWeights = (family) => {
  const info = fontInfo(family);
  return !!info && info.max > info.min;
};
const hasItalic = (family) => !!fontInfo(family)?.italic;

const fontControls = (group, label = "Font") => [
  { path: `${group}.font`, label, type: "font" },
  {
    path: `${group}.weight`,
    label: "Weight",
    type: "range",
    step: 10,
    when: (s) => hasWeights(s[group].font),
    range: (s) => [fontInfo(s[group].font).min, fontInfo(s[group].font).max],
  },
  { path: `${group}.italic`, label: "Italic", type: "toggle", when: (s) => hasItalic(s[group].font) },
];

const ALIGN = [["left", "Left"], ["center", "Centre"], ["right", "Right"]];

export const CONTROL_GROUPS = [
  {
    title: "Quote text",
    controls: [
      ...fontControls("quote"),
      { path: "quote.color", label: "Colour", type: "color" },
      { path: "quote.size", label: "Largest size", type: "range", min: 30, max: 240, step: 1 },
      { path: "quote.lineHeight", label: "Line height", type: "range", min: 0.9, max: 1.9, step: 0.01 },
      { path: "quote.letterSpacing", label: "Letter spacing", type: "range", min: -0.05, max: 0.3, step: 0.005 },
      { path: "quote.uppercase", label: "Capitals", type: "toggle" },
      { path: "quote.balance", label: "Even lines", type: "toggle" },
      {
        path: "quote.emphasis",
        label: "*Stars* style",
        type: "select",
        options: [["italic", "Italic"], ["bold", "Bold"], ["color", "Colour"]],
      },
      { path: "quote.emphasisColor", label: "*Stars* colour", type: "color", when: (s) => s.quote.emphasis === "color" },
      { heading: "Text shadow" },
      { path: "quote.shadowBlur", label: "Blur", type: "range", min: 0, max: 80, step: 1 },
      { path: "quote.shadowY", label: "Offset", type: "range", min: -20, max: 40, step: 1 },
      { path: "quote.shadowColor", label: "Colour", type: "color", when: (s) => s.quote.shadowBlur > 0 || s.quote.shadowY !== 0 },
    ],
  },
  {
    title: "Author and source",
    open: false,
    controls: [
      { heading: "Author" },
      ...fontControls("author"),
      { path: "author.color", label: "Colour", type: "color" },
      { path: "author.size", label: "Size", type: "range", min: 14, max: 90, step: 1 },
      { path: "author.letterSpacing", label: "Letter spacing", type: "range", min: 0, max: 0.4, step: 0.01 },
      { path: "author.uppercase", label: "Capitals", type: "toggle" },
      { path: "author.dash", label: "Dash before", type: "toggle" },
      { path: "author.gap", label: "Gap above", type: "range", min: 0, max: 160, step: 2 },
      { heading: "Source" },
      ...fontControls("source"),
      { path: "source.color", label: "Colour", type: "color" },
      { path: "source.size", label: "Size", type: "range", min: 14, max: 90, step: 1 },
      { heading: "Divider line" },
      { path: "rule.type", label: "Line", type: "select", options: [["none", "None"], ["short", "Short line"]] },
      { path: "rule.color", label: "Colour", type: "color", when: (s) => s.rule.type !== "none" },
      { path: "rule.width", label: "Length", type: "range", min: 20, max: 400, step: 5, when: (s) => s.rule.type !== "none" },
      { path: "rule.thickness", label: "Thickness", type: "range", min: 1, max: 12, step: 0.5, when: (s) => s.rule.type !== "none" },
    ],
  },
  {
    title: "Background",
    open: false,
    controls: [
      { path: "background.type", label: "Fill", type: "select", options: [["solid", "Solid"], ["linear", "Linear gradient"], ["radial", "Radial gradient"]] },
      { path: "background.color1", label: "Colour 1", type: "color" },
      { path: "background.color2", label: "Colour 2", type: "color", when: (s) => s.background.type !== "solid" },
      { path: "background.color3", label: "Colour 3", type: "optionalColor", when: (s) => s.background.type !== "solid" },
      { path: "background.angle", label: "Angle", type: "range", min: 0, max: 360, step: 5, when: (s) => s.background.type === "linear" },
      { heading: "Texture" },
      { path: "texture.type", label: "Texture", type: "select", options: [["none", "None"], ["grain", "Paper grain"], ["dots", "Dots"], ["lines", "Ruled lines"], ["grid", "Grid"]] },
      { path: "texture.opacity", label: "Strength", type: "range", min: 0.02, max: 0.6, step: 0.01, when: (s) => s.texture.type !== "none" },
      { path: "texture.color", label: "Colour", type: "color", when: (s) => !["none", "grain"].includes(s.texture.type) },
      { heading: "Shape" },
      { path: "decor.type", label: "Shape", type: "select", options: [["none", "None"], ["sun", "Circle"], ["arch", "Arch"], ["band", "Top band"]] },
      { path: "decor.color", label: "Colour", type: "color", when: (s) => s.decor.type !== "none" },
      { path: "decor.opacity", label: "Opacity", type: "range", min: 0.05, max: 1, step: 0.01, when: (s) => s.decor.type !== "none" },
    ],
  },
  {
    title: "Quote mark",
    open: false,
    controls: [
      { path: "mark.type", label: "Mark", type: "select", options: [["none", "None"], ["top", "Above the text"], ["inline", "Around the text"], ["bar", "Bar beside the text"]] },
      { path: "mark.font", label: "Font", type: "font", when: (s) => s.mark.type === "top" },
      { path: "mark.size", label: "Size", type: "range", min: 60, max: 500, step: 5, when: (s) => s.mark.type === "top" },
      { path: "mark.color", label: "Colour", type: "color", when: (s) => ["top", "bar"].includes(s.mark.type) },
      { path: "mark.opacity", label: "Opacity", type: "range", min: 0.05, max: 1, step: 0.01, when: (s) => ["top", "bar"].includes(s.mark.type) },
    ],
  },
  {
    title: "Frame",
    open: false,
    controls: [
      { path: "frame.type", label: "Frame", type: "select", options: [["none", "None"], ["line", "Line"], ["double", "Double line"], ["corners", "Corners"], ["card", "Card"]] },
      { path: "frame.inset", label: "Inset", type: "range", min: 0, max: 240, step: 2, when: (s) => s.frame.type !== "none" },
      { path: "frame.color", label: "Colour", type: "color", when: (s) => !["none", "card"].includes(s.frame.type) },
      { path: "frame.width", label: "Thickness", type: "range", min: 0.5, max: 24, step: 0.5, when: (s) => !["none", "card"].includes(s.frame.type) },
      { path: "frame.cardColor", label: "Card colour", type: "color", when: (s) => s.frame.type === "card" },
      { path: "frame.cardOpacity", label: "Card opacity", type: "range", min: 0.1, max: 1, step: 0.01, when: (s) => s.frame.type === "card" },
      { path: "frame.radius", label: "Corner radius", type: "range", min: 0, max: 120, step: 1, when: (s) => s.frame.type === "card" },
      { path: "frame.cardShadow", label: "Shadow", type: "range", min: 0, max: 0.6, step: 0.01, when: (s) => s.frame.type === "card" },
    ],
  },
  {
    title: "Layout",
    open: false,
    controls: [
      { path: "layout.align", label: "Align", type: "select", options: ALIGN },
      { path: "layout.vAlign", label: "Position", type: "select", options: [["top", "Top"], ["center", "Middle"], ["bottom", "Bottom"]] },
      { path: "layout.margin", label: "Margin", type: "range", min: 20, max: 300, step: 2 },
      { path: "layout.textWidth", label: "Text width %", type: "range", min: 40, max: 100, step: 1 },
    ],
  },
];

export function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

export function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((target, key) => target[key], object)[last] = value;
}

function formatNumber(value, step) {
  const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return Number(value).toFixed(decimals);
}

function buildFontSelect(value) {
  const select = document.createElement("select");
  const groups = new Map();
  for (const font of FONTS) {
    if (!groups.has(font.group)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = font.group;
      groups.set(font.group, optgroup);
      select.append(optgroup);
    }
    groups.get(font.group).append(new Option(font.family, font.family));
  }
  select.value = value;
  return select;
}

function buildColor(value, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "control-color";
  const swatch = document.createElement("input");
  swatch.type = "color";
  swatch.value = value || "#000000";
  const hex = document.createElement("input");
  hex.type = "text";
  hex.value = value;
  hex.spellcheck = false;
  hex.maxLength = 7;
  swatch.addEventListener("input", () => {
    hex.value = swatch.value;
    onChange(swatch.value);
  });
  hex.addEventListener("input", () => {
    if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
      swatch.value = hex.value;
      onChange(hex.value.toLowerCase());
    }
  });
  wrap.append(swatch, hex);
  return { wrap, swatch, hex };
}

// Builds one control. Returns a row element, or null when it does not apply to this style.
function buildControl(control, style, onChange) {
  if (control.heading) {
    const heading = document.createElement("div");
    heading.className = "subhead";
    heading.textContent = control.heading;
    return heading;
  }
  if (control.when && !control.when(style)) return null;

  const value = getPath(style, control.path);
  const row = document.createElement("label");
  row.className = "control";
  const label = document.createElement("span");
  label.textContent = control.label;
  row.append(label);
  const change = (next, structural = false) => onChange(control.path, next, structural);

  if (control.type === "range") {
    const [min, max] = control.range ? control.range(style) : [control.min, control.max];
    const wrap = document.createElement("div");
    wrap.className = "control-range";
    const range = document.createElement("input");
    range.type = "range";
    range.min = min;
    range.max = max;
    range.step = control.step;
    range.value = value;
    const output = document.createElement("output");
    output.textContent = formatNumber(value, control.step);
    range.addEventListener("input", () => {
      output.textContent = formatNumber(range.value, control.step);
      // Shadow visibility depends on the blur value, so these can change which controls show.
      change(Number(range.value), control.path.startsWith("quote.shadow"));
    });
    wrap.append(range, output);
    row.append(wrap);
  } else if (control.type === "toggle") {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = !!value;
    box.addEventListener("change", () => change(box.checked));
    row.append(box);
  } else if (control.type === "select" || control.type === "font") {
    let select;
    if (control.type === "font") {
      select = buildFontSelect(value);
    } else {
      select = document.createElement("select");
      control.options.forEach(([key, text]) => select.append(new Option(text, key)));
      select.value = value;
    }
    select.addEventListener("change", () => change(select.value, true));
    row.append(select);
  } else if (control.type === "color") {
    row.append(buildColor(value, (next) => change(next)).wrap);
  } else if (control.type === "optionalColor") {
    const fallback = style.background.color2;
    const { wrap, swatch, hex } = buildColor(value || fallback, (next) => change(next));
    wrap.classList.add("optional");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = !!value;
    box.setAttribute("aria-label", "Use a third colour");
    swatch.disabled = hex.disabled = !value;
    box.addEventListener("change", () => change(box.checked ? swatch.value : "", true));
    wrap.prepend(box);
    row.append(wrap);
  }
  row.dataset.path = control.path;
  return row;
}

// Fills the Fine-tune pane. Keeps open sections, scroll position and focus across rebuilds.
export function renderControls(container, style, onChange) {
  const open = new Map(
    [...container.querySelectorAll("details")].map((d) => [d.dataset.title, d.open]),
  );
  const scroll = container.scrollTop;
  const focusPath = document.activeElement?.closest?.("[data-path]")?.dataset.path;
  container.replaceChildren();

  for (const group of CONTROL_GROUPS) {
    const details = document.createElement("details");
    details.className = "group";
    details.dataset.title = group.title;
    details.open = open.get(group.title) ?? group.open !== false;
    const summary = document.createElement("summary");
    summary.textContent = group.title;
    const body = document.createElement("div");
    body.className = "group-body";
    for (const control of group.controls) {
      const element = buildControl(control, style, onChange);
      if (element) body.append(element);
    }
    details.append(summary, body);
    container.append(details);
  }
  container.scrollTop = scroll;
  if (focusPath) {
    container.querySelector(`[data-path="${focusPath}"] select, [data-path="${focusPath}"] input`)?.focus();
  }
}
