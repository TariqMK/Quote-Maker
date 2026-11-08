// Runs the Quote-Maker window: holds the current quote and style, and connects every control.

import * as bridge from "./bridge.js";
import { renderControls, setPath } from "./controls.js";
import { CATEGORIES, PRESETS, mergeDeep, withDefaults } from "./presets.js";
import { ensureFonts, renderQuote } from "./render.js";
import { HIGHLIGHTS, applyHighlight, suggestFilename } from "./text.js";

const SIZES = [
  { id: "square", name: "Square", width: 1080, height: 1080 },
  { id: "portrait", name: "Portrait", width: 1080, height: 1350 },
  { id: "landscape", name: "Landscape", width: 1200, height: 675 },
  { id: "story", name: "Story", width: 1080, height: 1920 },
  { id: "custom", name: "Custom" },
];
const SCALES = [1, 2, 3];
const SIZE_LIMIT = { min: 200, max: 6000 };
const MINE = "My styles";
const WRITE_FAILED = "Could not write to the Quote-Maker Data folder. Move the app to a folder you can change.";
const SAMPLE = { quote: "Paste your own *words* and make them look like they matter.", author: "Your name", source: "" };
const THUMB = { quote: "Words *worth* keeping", author: "Author", source: "", size: 400, textScale: 1.7 };

const $ = (id) => document.getElementById(id);

const state = {
  quote: SAMPLE.quote,
  author: SAMPLE.author,
  source: SAMPLE.source,
  sizeId: "portrait",
  customWidth: 1600,
  customHeight: 900,
  scale: 1,
  styleId: PRESETS[0].id,
  style: null, // The working copy, including any edits.
  edited: false,
};
let customStyles = [];
let filter = "All";
let renderToken = 0;
let framePending = false;
let saveTimer = null;

const allStyles = () => [...PRESETS, ...customStyles];
const findStyle = (id) => allStyles().find((s) => s.id === id);
const isCustom = (id) => customStyles.some((s) => s.id === id);
const clone = (style) => mergeDeep(withDefaults(style), {});

function imageSize() {
  const size = SIZES.find((s) => s.id === state.sizeId);
  if (size.id !== "custom") return { width: size.width, height: size.height };
  const clamp = (value) => Math.min(SIZE_LIMIT.max, Math.max(SIZE_LIMIT.min, Number(value) || 1080));
  return { width: clamp(state.customWidth), height: clamp(state.customHeight) };
}

function setStatus(text) {
  $("status").textContent = text;
}

// Preview: several changes in one frame cause one redraw.
function requestRender() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(async () => {
    framePending = false;
    const token = ++renderToken;
    await ensureFonts(state.style);
    if (token !== renderToken) return;
    drawPreview();
  });
}

function drawPreview() {
  const { width, height } = imageSize();
  const canvas = $("preview");
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const result = renderQuote(canvas.getContext("2d"), { ...renderInput(), width, height });
  const note = `${width} × ${height} px`;
  $("proof-note").textContent = result.fittedDown
    ? `${note}  ·  text reduced to size ${Math.round(result.fontSize)} to fit`
    : note;
}

function renderInput() {
  return { quote: state.quote, author: state.author, source: state.source, style: state.style };
}

function exportCanvas() {
  const { width, height } = imageSize();
  const canvas = document.createElement("canvas");
  canvas.width = width * state.scale;
  canvas.height = height * state.scale;
  renderQuote(canvas.getContext("2d"), { ...renderInput(), width: canvas.width, height: canvas.height });
  return canvas;
}

async function saveImage() {
  await ensureFonts(state.style);
  try {
    const path = await bridge.saveImage(
      exportCanvas().toDataURL("image/png"),
      suggestFilename(state.quote, state.author),
    );
    if (path) setStatus(`Saved ${path}`);
  } catch (error) {
    setStatus(`Could not save the image: ${error.message ?? error}`);
  }
}

async function copyImage() {
  await ensureFonts(state.style);
  try {
    const blob = await new Promise((resolve) => exportCanvas().toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus("Image copied");
  } catch (error) {
    setStatus(`Could not copy the image: ${error.message ?? error}`);
  }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { quote, author, source, sizeId, customWidth, customHeight, scale, styleId, style, edited } = state;
    bridge
      .saveState({ quote, author, source, sizeId, customWidth, customHeight, scale, styleId, style, edited })
      .catch(() => setStatus(WRITE_FAILED));
  }, 500);
}

function changed() {
  requestRender();
  persist();
}

// Left panel

// Applies a colour to the words selected in Quote. A null colour removes the highlight.
function highlightSelection(color) {
  const field = $("quote");
  const result = applyHighlight(field.value, field.selectionStart, field.selectionEnd, color);
  if (!result) {
    setStatus("Select words in Quote first");
    return;
  }
  setStatus("");
  field.focus();
  field.select();
  // insertText keeps Ctrl+Z working and sends the input event that updates the preview.
  if (!document.execCommand("insertText", false, result.text)) {
    field.value = result.text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // The selection stays on the words, so another colour can be tried straight away.
  field.setSelectionRange(result.start, result.end);
}

function renderHighlights() {
  // The selection in Quote must stay in place while a colour button is pressed.
  const keepSelection = (event) => event.preventDefault();
  const swatches = Object.entries(HIGHLIGHTS).map(([name, color]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "highlight-swatch";
    button.style.backgroundColor = color;
    const label = `${name[0].toUpperCase()}${name.slice(1)}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("mousedown", keepSelection);
    button.addEventListener("click", () => highlightSelection(name));
    return button;
  });
  const custom = document.createElement("input");
  custom.type = "color";
  custom.value = "#7fd1ae";
  custom.className = "highlight-custom";
  custom.title = "Custom colour";
  custom.setAttribute("aria-label", "Custom colour");
  // "change" waits for the colour picker to close, because moving focus could close it early.
  custom.addEventListener("change", () => highlightSelection(custom.value));
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "link";
  clear.textContent = "Clear";
  clear.addEventListener("mousedown", keepSelection);
  clear.addEventListener("click", () => highlightSelection(null));
  $("highlights").replaceChildren(...swatches, custom, clear);
}

function renderSizes() {
  const list = $("sizes");
  list.replaceChildren(
    ...SIZES.map((size) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "size-option";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(size.id === state.sizeId));
      const name = document.createElement("span");
      name.textContent = size.name;
      button.append(name);
      if (size.width) {
        const pixels = document.createElement("small");
        pixels.textContent = `${size.width} × ${size.height}`;
        button.append(pixels);
      }
      button.addEventListener("click", () => {
        state.sizeId = size.id;
        renderSizes();
        changed();
      });
      return button;
    }),
  );
  $("custom-size").hidden = state.sizeId !== "custom";
  $("custom-width").value = state.customWidth;
  $("custom-height").value = state.customHeight;
}

function renderScales() {
  $("scales").replaceChildren(
    ...SCALES.map((scale) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(scale === state.scale));
      button.textContent = `${scale}x`;
      button.addEventListener("click", () => {
        state.scale = scale;
        renderScales();
        persist();
      });
      return button;
    }),
  );
}

// Right panel

function renderFilters() {
  $("filters").replaceChildren(
    ...["All", ...CATEGORIES, MINE].map((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter";
      button.textContent = name;
      button.setAttribute("aria-pressed", String(name === filter));
      button.addEventListener("click", () => {
        filter = name;
        renderFilters();
        renderGallery();
      });
      return button;
    }),
  );
}

function visibleStyles() {
  if (filter === "All") return allStyles();
  if (filter === MINE) return customStyles;
  return PRESETS.filter((p) => p.category === filter);
}

async function drawThumbnail(canvas, style) {
  await ensureFonts(style);
  canvas.width = canvas.height = THUMB.size;
  // Thumbnails are small, so the type is enlarged to show the character of each style.
  const enlarged = mergeDeep(style, {
    quote: { size: style.quote.size * THUMB.textScale },
    author: { size: style.author.size * 1.6 },
  });
  renderQuote(canvas.getContext("2d"), {
    width: THUMB.size,
    height: THUMB.size,
    quote: THUMB.quote,
    author: THUMB.author,
    source: THUMB.source,
    style: enlarged,
  });
}

function renderGallery() {
  const styles = visibleStyles();
  $("gallery-empty").hidden = !(filter === MINE && styles.length === 0);
  const items = styles.map((raw) => {
    const style = withDefaults(raw);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.dataset.styleId = raw.id;
    button.setAttribute("aria-pressed", String(raw.id === state.styleId));
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = raw.name;
    button.append(canvas, label);
    button.addEventListener("click", () => selectStyle(raw.id));
    return { button, canvas, style };
  });
  $("gallery").replaceChildren(...items.map((item) => item.button));
  // One thumbnail per frame, so the window stays responsive while they draw.
  (async () => {
    for (const item of items) {
      if (!item.button.isConnected) return;
      await drawThumbnail(item.canvas, item.style);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  })();
}

function markSelected() {
  document.querySelectorAll(".swatch").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.styleId === state.styleId));
  });
}

function renderCurrent() {
  const base = findStyle(state.styleId);
  $("style-name").textContent = state.style.name ?? base?.name ?? "";
  $("style-edited").hidden = !state.edited;
  $("reset-style").hidden = !state.edited;
  $("update-style").hidden = !(state.edited && isCustom(state.styleId));
  $("delete-style").hidden = !isCustom(state.styleId);
}

function renderTune() {
  renderControls($("pane-tune"), state.style, onControlChange);
}

function onControlChange(path, value, structural) {
  setPath(state.style, path, value);
  state.edited = true;
  renderCurrent();
  if (structural) renderTune();
  changed();
}

function selectStyle(id) {
  const style = findStyle(id);
  if (!style) return;
  state.styleId = id;
  state.style = clone(style);
  state.edited = false;
  markSelected();
  renderCurrent();
  renderTune();
  changed();
}

function showTab(tab) {
  const tune = tab === "tune";
  $("pane-tune").hidden = !tune;
  $("pane-styles").hidden = tune;
  $("tab-tune").setAttribute("aria-selected", String(tune));
  $("tab-styles").setAttribute("aria-selected", String(!tune));
}

// Dialog: asks for a name, or asks to confirm. Resolves to the text or true; null on cancel.
function askDialog({ title, text = "", confirm, input = null }) {
  const dialog = $("dialog");
  $("dialog-title").textContent = title;
  $("dialog-text").textContent = text;
  $("dialog-text").hidden = !text;
  $("dialog-confirm").textContent = confirm;
  const field = $("dialog-input");
  field.hidden = input === null;
  field.required = input !== null;
  field.value = input ?? "";
  const form = $("dialog-form");
  return new Promise((resolve) => {
    // The result comes from the button or Esc key, not the close event, which browsers
    // delay until the next animation frame and never send while the window is hidden.
    const finish = (result) => {
      form.removeEventListener("submit", onSubmit);
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
      resolve(result);
    };
    const onSubmit = (event) => {
      event.preventDefault();
      if (event.submitter?.value !== "confirm") return finish(null);
      finish(input === null ? true : field.value.trim() || null);
    };
    const onCancel = (event) => {
      event.preventDefault();
      finish(null);
    };
    form.addEventListener("submit", onSubmit);
    dialog.addEventListener("cancel", onCancel);
    dialog.showModal();
    if (input !== null) field.select();
  });
}

async function saveAsNew() {
  const name = await askDialog({
    title: "Save as a new style",
    confirm: "Save style",
    input: `${state.style.name ?? "My style"} copy`,
  });
  if (!name) return;
  const { id: _id, category: _category, ...values } = state.style;
  let saved;
  try {
    saved = await bridge.saveStyle({ ...values, name });
  } catch {
    setStatus(WRITE_FAILED);
    return;
  }
  customStyles = await bridge.listStyles();
  state.styleId = saved.id;
  state.style = clone(saved);
  state.edited = false;
  filter = MINE;
  renderFilters();
  renderGallery();
  renderCurrent();
  showTab("styles");
  setStatus(`Saved style ${saved.name}`);
  persist();
}

async function updateCustom() {
  let saved;
  try {
    saved = await bridge.saveStyle({ ...state.style, id: state.styleId });
  } catch {
    setStatus(WRITE_FAILED);
    return;
  }
  customStyles = await bridge.listStyles();
  state.style = clone(saved);
  state.edited = false;
  renderGallery();
  renderCurrent();
  setStatus(`Updated style ${saved.name}`);
  persist();
}

async function deleteCustom() {
  const style = findStyle(state.styleId);
  const confirmed = await askDialog({
    title: `Delete ${style.name}?`,
    text: "This removes the saved style. You cannot undo this.",
    confirm: "Delete style",
  });
  if (!confirmed) return;
  try {
    await bridge.deleteStyle(style.id);
  } catch {
    setStatus(WRITE_FAILED);
    return;
  }
  customStyles = await bridge.listStyles();
  renderGallery();
  selectStyle(PRESETS[0].id);
  setStatus(`Deleted style ${style.name}`);
}

function bindEvents() {
  for (const key of ["quote", "author", "source"]) {
    $(key).addEventListener("input", (event) => {
      state[key] = event.target.value;
      changed();
    });
  }
  for (const [id, key] of [["custom-width", "customWidth"], ["custom-height", "customHeight"]]) {
    $(id).addEventListener("input", (event) => {
      state[key] = event.target.value;
      changed();
    });
  }
  $("save-image").addEventListener("click", saveImage);
  $("copy-image").addEventListener("click", copyImage);
  $("tab-styles").addEventListener("click", () => showTab("styles"));
  $("tab-tune").addEventListener("click", () => showTab("tune"));
  $("reset-style").addEventListener("click", () => selectStyle(state.styleId));
  $("save-style").addEventListener("click", saveAsNew);
  $("update-style").addEventListener("click", updateCustom);
  $("delete-style").addEventListener("click", deleteCustom);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveImage();
    }
  });
}

function applySavedState(saved) {
  for (const key of ["quote", "author", "source", "customWidth", "customHeight"]) {
    if (saved[key] !== undefined) state[key] = saved[key];
  }
  if (SIZES.some((s) => s.id === saved.sizeId)) state.sizeId = saved.sizeId;
  if (SCALES.includes(saved.scale)) state.scale = saved.scale;
  if (findStyle(saved.styleId)) {
    state.styleId = saved.styleId;
    state.style = clone(saved.edited && saved.style ? saved.style : findStyle(saved.styleId));
    state.edited = !!saved.edited;
  }
}

function renderAll() {
  $("quote").value = state.quote;
  $("author").value = state.author;
  $("source").value = state.source;
  renderSizes();
  renderScales();
  renderFilters();
  renderGallery();
  renderCurrent();
  renderTune();
  requestRender();
}

async function start() {
  state.style = clone(PRESETS[0]);
  bindEvents();
  renderHighlights();
  showTab("styles");
  renderAll(); // Show the window content straight away, then restore saved work.
  await bridge.connect();
  $("version").textContent = `v${await bridge.getVersion()}`;
  customStyles = await bridge.listStyles();
  applySavedState(await bridge.loadState());
  renderAll();
}

start();
