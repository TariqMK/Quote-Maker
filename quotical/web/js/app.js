// Runs the Quotical window: holds the work for each mode, and connects every control.
// Single image makes one quote image. Carousel splits an article into a set of slides.
// Post makes one image that looks like a social media post.

import * as bridge from "./bridge.js";
import { CAROUSEL_PRESETS, withCarouselDefaults } from "./carousel-presets.js";
import { ensureCarouselFonts, layoutCarousel, renderSlide } from "./carousel.js";
import { CAROUSEL_CONTROL_GROUPS, CONTROL_GROUPS, POST_CONTROL_GROUPS, renderControls, setPath } from "./controls.js";
import { ensurePostFonts, renderPost } from "./post.js";
import { POST_CATEGORIES, POST_PRESETS, withPostDefaults } from "./post-presets.js";
import { CATEGORIES, PRESETS, mergeDeep, withDefaults } from "./presets.js";
import { ensureFonts, renderQuote } from "./render.js";
import { DEFAULT_MODE, buildSavedState, readSavedState } from "./state.js";
import { HIGHLIGHTS, SLIDE_MARK, applyHighlight, cleanLine, stripHighlights, suggestFilename } from "./text.js";

const SCALES = [1, 2, 3];
const FORMATS = [["png", "PNG"], ["jpg", "JPG"]];
const QUALITY = { min: 60, max: 100 };
const SIZE_LIMIT = { min: 200, max: 6000 };
const MINE = "My styles";
const WRITE_FAILED = "Could not write to the Quotical Data folder. Move the app to a folder you can change.";
const THUMB = { quote: "Words *worth* keeping", author: "Author", source: "", size: 400, textScale: 1.7 };
const CAROUSEL_THUMB = {
  width: 320,
  title: "Words worth keeping",
  text: "Clear writing is a set of *small habits* that anyone can learn, one paragraph at a time.",
};
const POST_THUMB = {
  size: 400,
  name: "Alex Rivera",
  handle: "@alexwrites",
  date: "2h",
  text: "Words *worth* keeping.",
};
// A post picture is stored at this size, which keeps state.json small.
const AVATAR_SIZE = 256;
const FILM_HEIGHT = 128; // Thumbnail canvases are drawn at 2x their 64 px display height.

const SAMPLE_ARTICLE = `Clear writing is not a talent. It is a set of *small habits* that anyone can learn.

**Lead with the point.** Say the most important thing first, then explain it. Readers who stop early still leave with the idea.

**Use short sentences.** One idea per sentence. If a sentence needs a second breath, split it.

[slide]
**Choose plain words.** Write *use*, not *utilise*. Write *help*, not *facilitate*.

**Cut what does not earn its place.** Read each paragraph and ask whether the piece would miss it.

**Read it aloud.** Your ear finds the clumsy line that your eye forgives.`;

const SAMPLE_POST = `Clear writing is not a talent.

It is a set of *small habits* that anyone can learn: lead with the point, use short sentences, and cut what does not earn its place.`;

// What differs between the modes. The rest of this file works on whichever mode is open.
const MODES = {
  single: {
    presets: PRESETS,
    categories: CATEGORIES,
    withDefaults,
    controls: CONTROL_GROUPS,
    ensureFonts,
    sizes: [
      { id: "square", name: "Square", width: 1080, height: 1080 },
      { id: "portrait", name: "Portrait", width: 1080, height: 1350 },
      { id: "landscape", name: "Landscape", width: 1200, height: 675 },
      { id: "story", name: "Story", width: 1080, height: 1920 },
      { id: "custom", name: "Custom" },
    ],
    // Text fields: the state key and the element id.
    fields: { quote: "quote", author: "author", source: "source" },
    highlightFields: ["quote"],
    panels: ["fields-single", "fields-single-after"],
    highlightHint: "Select words in Quote, then select a colour",
    actions: { copy: "Copy image", save: "Save image" },
    defaults: {
      quote: "Paste your own *words* and make them look like they matter.",
      author: "Your name",
      source: "",
      sizeId: "portrait",
      customWidth: 1600,
      customHeight: 900,
      format: "png",
      quality: 90,
    },
  },
  carousel: {
    presets: CAROUSEL_PRESETS,
    categories: [],
    withDefaults: withCarouselDefaults,
    controls: CAROUSEL_CONTROL_GROUPS,
    ensureFonts: ensureCarouselFonts,
    sizes: [
      { id: "portrait", name: "Portrait", width: 1080, height: 1350 },
      { id: "square", name: "Square", width: 1080, height: 1080 },
      { id: "tall", name: "Tall", width: 1080, height: 1440 },
    ],
    fields: { title: "carousel-title", subtitle: "carousel-subtitle", text: "article" },
    highlightFields: ["article", "carousel-title", "carousel-subtitle"],
    panels: ["fields-carousel"],
    highlightHint: "Select words, then select a colour",
    actions: { copy: "Copy slide", save: "Save slide" },
    defaults: {
      title: "Five habits of clear writing",
      subtitle: "A short guide · 3 min read",
      text: SAMPLE_ARTICLE,
      keepLineBreaks: false,
      sizeId: "portrait",
      slide: 0,
      format: "png",
      quality: 90,
    },
  },
  post: {
    presets: POST_PRESETS,
    categories: POST_CATEGORIES,
    withDefaults: withPostDefaults,
    controls: POST_CONTROL_GROUPS,
    // The picture is loaded with the fonts, so the preview never draws without it.
    ensureFonts: async (style) => {
      await ensurePostFonts(style);
      await loadAvatar(work.post.avatar);
    },
    sizes: [
      { id: "square", name: "Square", width: 1080, height: 1080 },
      { id: "portrait", name: "Portrait", width: 1080, height: 1350 },
      { id: "landscape", name: "Landscape", width: 1200, height: 675 },
      { id: "story", name: "Story", width: 1080, height: 1920 },
    ],
    fields: { name: "post-name", handle: "post-handle", date: "post-date", text: "post-text" },
    highlightFields: ["post-text"],
    panels: ["fields-post", "fields-post-after"],
    highlightHint: "Select words in Post, then select a colour",
    actions: { copy: "Copy image", save: "Save image" },
    defaults: {
      name: "Alex Rivera",
      handle: "@alexwrites",
      date: "9:41 AM · Nov 17, 2026",
      text: SAMPLE_POST,
      verified: true,
      actions: true,
      avatar: "",
      sizeId: "square",
      format: "png",
      quality: 90,
    },
  },
};

// The keys of each mode's work that are saved in state.json.
const SAVED_KEYS = {
  single: [
    "quote", "author", "source", "sizeId", "customWidth", "customHeight", "scale", "format", "quality",
    "styleId", "style", "edited",
  ],
  carousel: [
    "title", "subtitle", "text", "keepLineBreaks", "sizeId", "scale", "format", "quality",
    "styleId", "style", "edited", "slide",
  ],
  post: [
    "name", "handle", "date", "text", "verified", "actions", "avatar", "sizeId", "scale", "format", "quality",
    "styleId", "style", "edited",
  ],
};

const $ = (id) => document.getElementById(id);

let mode = DEFAULT_MODE;
const work = {};
const customStyles = { single: [], carousel: [], post: [] };
const filters = { single: "All", carousel: "All", post: "All" };
const lastHighlightField = { single: "quote", carousel: "article", post: "post-text" };
// The loaded post picture, kept so each redraw does not decode it again.
let avatarImage = { src: "", image: null };
let carouselLayout = null;
let renderToken = 0;
let framePending = false;
let saveTimer = null;
let exporting = false;
const measureContext = document.createElement("canvas").getContext("2d");

const config = () => MODES[mode];
const state = () => work[mode];
const allStyles = () => [...config().presets, ...customStyles[mode]];
const findStyle = (id) => allStyles().find((s) => s.id === id);
const isCustom = (id) => customStyles[mode].some((s) => s.id === id);
const clone = (style) => mergeDeep(config().withDefaults(style), {});

function freshWork(name) {
  const modeConfig = MODES[name];
  return {
    ...modeConfig.defaults,
    scale: 1,
    styleId: modeConfig.presets[0].id,
    style: mergeDeep(modeConfig.withDefaults(modeConfig.presets[0]), {}),
    edited: false,
  };
}

function imageSize() {
  const current = state();
  const size = config().sizes.find((s) => s.id === current.sizeId) ?? config().sizes[0];
  if (size.id !== "custom") return { width: size.width, height: size.height };
  const clamp = (value) => Math.min(SIZE_LIMIT.max, Math.max(SIZE_LIMIT.min, Number(value) || 1080));
  return { width: clamp(current.customWidth), height: clamp(current.customHeight) };
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
    await config().ensureFonts(state().style);
    if (token !== renderToken) return;
    if (mode === "carousel") drawCarousel();
    else if (mode === "post") drawPost();
    else drawQuote();
  });
}

function sizeCanvas(canvas, width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function quoteInput() {
  const { quote, author, source, style } = state();
  return { quote, author, source, style };
}

function drawQuote() {
  const { width, height } = imageSize();
  const canvas = $("preview");
  sizeCanvas(canvas, width, height);
  const result = renderQuote(canvas.getContext("2d"), { ...quoteInput(), width, height });
  const note = `${width} × ${height} px`;
  $("proof-note").textContent = result.fittedDown
    ? `${note}  ·  text reduced to size ${Math.round(result.fontSize)} to fit`
    : note;
}

async function loadAvatar(src) {
  if (avatarImage.src === src) return;
  if (!src) {
    avatarImage = { src: "", image: null };
    return;
  }
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
    avatarImage = { src, image };
  } catch {
    avatarImage = { src, image: null };
  }
}

function postInput() {
  const { name, handle, date, text, verified, actions, style } = state();
  return { name, handle, date, text, verified, actions, style, avatar: avatarImage.image };
}

function drawPost() {
  const { width, height } = imageSize();
  const canvas = $("preview");
  sizeCanvas(canvas, width, height);
  const result = renderPost(canvas.getContext("2d"), { ...postInput(), width, height });
  const note = `${width} × ${height} px`;
  $("proof-note").textContent = result.fittedDown
    ? `${note}  ·  text reduced to size ${Math.round(result.fontSize)} to fit`
    : note;
}

// Carousel preview: lays the text out once, then draws the open slide and the filmstrip.
function drawCarousel() {
  const { width, height } = imageSize();
  const current = state();
  carouselLayout = layoutCarousel(measureContext, {
    width,
    height,
    title: current.title,
    subtitle: current.subtitle,
    text: current.text,
    keepLineBreaks: current.keepLineBreaks,
    style: current.style,
  });
  current.slide = Math.min(Math.max(0, current.slide), carouselLayout.slides.length - 1);
  drawFilmstrip();
  drawSlide();
}

function drawSlide() {
  const { width, height } = carouselLayout;
  const canvas = $("preview");
  sizeCanvas(canvas, width, height);
  renderSlide(canvas.getContext("2d"), carouselLayout, state().slide);

  const total = carouselLayout.slides.length;
  const index = state().slide;
  const overflow = carouselLayout.slides.findIndex((s) => s.overflow);
  let note = `Slide ${index + 1} of ${total}  ·  ${width} × ${height} px`;
  if (overflow >= 0) note += `  ·  text too large for slide ${overflow + 1}`;
  $("proof-note").textContent = note;
  $("prev-slide").disabled = index === 0;
  $("next-slide").disabled = index === total - 1;
  $("filmstrip").querySelectorAll(".thumb").forEach((thumb, i) => {
    thumb.setAttribute("aria-current", String(i === index));
  });
  $("filmstrip").children[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function drawFilmstrip() {
  const strip = $("filmstrip");
  const { width, height, slides } = carouselLayout;
  // Thumbnails are reused while the slide count stays the same, so typing does not rebuild them.
  while (strip.children.length > slides.length) strip.lastElementChild.remove();
  while (strip.children.length < slides.length) {
    const i = strip.children.length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb";
    button.append(document.createElement("canvas"));
    button.addEventListener("click", () => goToSlide(i));
    strip.append(button);
  }
  const scale = FILM_HEIGHT / height;
  [...strip.children].forEach((button, i) => {
    button.setAttribute("aria-label", `Slide ${i + 1} of ${slides.length}`);
    button.title = `Slide ${i + 1}`;
    const canvas = button.firstElementChild;
    sizeCanvas(canvas, Math.round(width * scale), FILM_HEIGHT);
    renderSlide(canvas.getContext("2d"), carouselLayout, i, scale);
  });
}

function goToSlide(index) {
  if (!carouselLayout) return;
  const next = Math.min(Math.max(0, index), carouselLayout.slides.length - 1);
  if (next === state().slide) return;
  state().slide = next;
  drawSlide();
  persist();
}

// Export: a slide (the open one unless given) or the quote image, at the chosen scale.
function exportCanvas(slide = state().slide) {
  const { width, height } = imageSize();
  const scale = state().scale;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  if (mode === "carousel") {
    renderSlide(canvas.getContext("2d"), carouselLayout, slide, scale);
  } else if (mode === "post") {
    renderPost(canvas.getContext("2d"), { ...postInput(), width: canvas.width, height: canvas.height });
  } else {
    renderQuote(canvas.getContext("2d"), { ...quoteInput(), width: canvas.width, height: canvas.height });
  }
  return canvas;
}

// The image in the chosen file type. JPG files are smaller; PNG keeps every pixel exact.
function encode(canvas, { format, quality } = state()) {
  return format === "jpg" ? canvas.toDataURL("image/jpeg", quality / 100) : canvas.toDataURL("image/png");
}

const slideBase = () => suggestFilename(state().title || state().text, "");
const slideName = (index) => `${slideBase()}-${String(index + 1).padStart(2, "0")}`;

function exportName() {
  const current = state();
  if (mode === "carousel") return slideName(current.slide);
  if (mode === "post") return suggestFilename(current.text, current.name);
  return suggestFilename(current.quote, current.author);
}

// Stops a second save from starting while slides are still being written.
function setExporting(busy) {
  exporting = busy;
  for (const id of ["save-image", "save-all", "copy-image"]) $(id).disabled = busy;
}

async function ready() {
  await config().ensureFonts(state().style);
  if (mode === "carousel" && !carouselLayout) drawCarousel();
}

async function saveImage() {
  if (exporting) return;
  await ready();
  try {
    const path = await bridge.saveImage(encode(exportCanvas()), exportName());
    if (path) setStatus(`Saved ${path}`);
  } catch (error) {
    setStatus(`Could not save the image: ${error.message ?? error}`);
  }
}

// Saves every slide into a new folder named after the title. Existing files are never replaced.
async function saveAllSlides() {
  if (exporting) return;
  await ready();
  // Settings are fixed when the save starts, so a change made meanwhile cannot mix two sizes.
  const layout = carouselLayout;
  const total = layout.slides.length;
  const { scale, format, quality } = state();
  const names = layout.slides.map((_, index) => slideName(index));
  const slideCanvas = (index) => {
    const canvas = document.createElement("canvas");
    canvas.width = layout.width * scale;
    canvas.height = layout.height * scale;
    renderSlide(canvas.getContext("2d"), layout, index, scale);
    return canvas;
  };
  const folderName = cleanLine(stripHighlights(state().title)).replace(/\*/g, "").trim() || slideBase();
  let folder;
  try {
    folder = await bridge.chooseExportFolder(folderName);
  } catch (error) {
    setStatus(`Could not make the folder: ${error.message ?? error}`);
    return;
  }
  if (!folder) return;
  setExporting(true);
  let index = 0;
  try {
    for (; index < total; index += 1) {
      setStatus(`Saving slide ${index + 1} of ${total}`);
      await bridge.saveExportImage(encode(slideCanvas(index), { format, quality }), names[index]);
      // Let the window redraw between slides, so the status stays current.
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    setStatus(`Saved ${total} ${total === 1 ? "slide" : "slides"} to ${folder}`);
  } catch (error) {
    setStatus(`Could not save slide ${index + 1}: ${error.message ?? error}`);
  } finally {
    setExporting(false);
  }
}

async function copyImage() {
  await ready();
  try {
    const blob = await new Promise((resolve) => exportCanvas().toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus(mode === "carousel" ? `Slide ${state().slide + 1} copied` : "Image copied");
  } catch (error) {
    setStatus(`Could not copy the image: ${error.message ?? error}`);
  }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const pick = (name) => Object.fromEntries(SAVED_KEYS[name].map((key) => [key, work[name][key]]));
    const saved = buildSavedState(mode, pick("single"), pick("carousel"), pick("post"));
    bridge.saveState(saved).catch(() => setStatus(WRITE_FAILED));
  }, 500);
}

function changed() {
  requestRender();
  persist();
}

// Left panel

// Applies a colour to the words selected in the last text field used. A null colour removes it.
function highlightSelection(color) {
  const field = $(lastHighlightField[mode]);
  const result = applyHighlight(field.value, field.selectionStart, field.selectionEnd, color);
  if (!result) {
    setStatus("Select words first");
    return;
  }
  setStatus("");
  replaceFieldText(field, result.text);
  // The selection stays on the words, so another colour can be tried straight away.
  field.setSelectionRange(result.start, result.end);
}

// Replaces all text in a field. insertText keeps Ctrl+Z working and sends the input event.
function replaceFieldText(field, text) {
  field.focus();
  field.select();
  if (!document.execCommand("insertText", false, text)) {
    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function renderHighlights() {
  // The selection in the text field must stay in place while a colour button is pressed.
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

// Puts [slide] on a line of its own at the cursor.
function insertSlideBreak() {
  const field = $("article");
  field.focus();
  const { selectionStart: start, selectionEnd: end, value } = field;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const insert = `${before && !before.endsWith("\n") ? "\n" : ""}${SLIDE_MARK}${after.startsWith("\n") ? "" : "\n"}`;
  if (!document.execCommand("insertText", false, insert)) {
    field.setRangeText(insert, start, end, "end");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

async function openTextFile() {
  let file;
  try {
    file = await bridge.openTextFile();
  } catch (error) {
    setStatus(`Could not open the file: ${error.message ?? error}`);
    return;
  }
  if (!file) return;
  const current = state();
  if (current.text.trim() && current.text !== SAMPLE_ARTICLE) {
    const confirmed = await askDialog({
      title: "Replace the article?",
      text: `The text of ${file.name} replaces the text in Article. Ctrl+Z in Article brings it back.`,
      confirm: "Replace",
    });
    if (!confirmed) return;
  }
  replaceFieldText($("article"), file.text);
  if (!current.title.trim() || current.title === MODES.carousel.defaults.title) {
    $("carousel-title").value = file.name;
    current.title = file.name;
  }
  current.slide = 0;
  setStatus(`Opened ${file.name}`);
  changed();
}

// Asks for a picture, then keeps the middle square of it at AVATAR_SIZE. The file is only read.
async function chooseAvatar() {
  let file;
  try {
    file = await bridge.openImageFile();
  } catch (error) {
    setStatus(`Could not open the picture: ${error.message ?? error}`);
    return;
  }
  if (!file) return;
  const image = new Image();
  image.src = file.dataUrl;
  try {
    await image.decode();
  } catch {
    setStatus(`Could not read ${file.name} as a picture`);
    return;
  }
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  canvas.getContext("2d").drawImage(
    image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE,
  );
  work.post.avatar = canvas.toDataURL("image/png");
  renderAvatar();
  setStatus(`Picture set from ${file.name}`);
  changed();
}

function removeAvatar() {
  work.post.avatar = "";
  renderAvatar();
  changed();
}

function renderAvatar() {
  const src = work.post.avatar;
  $("avatar-preview").hidden = !src;
  if (src) $("avatar-preview").src = src;
  else $("avatar-preview").removeAttribute("src");
  $("avatar-empty").hidden = !!src;
  $("remove-avatar").hidden = !src;
  $("choose-avatar").textContent = src ? "Change picture" : "Choose picture";
}

function renderSizes() {
  const current = state();
  $("sizes").replaceChildren(
    ...config().sizes.map((size) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "size-option";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(size.id === current.sizeId));
      const name = document.createElement("span");
      name.textContent = size.name;
      button.append(name);
      if (size.width) {
        const pixels = document.createElement("small");
        pixels.textContent = `${size.width} × ${size.height}`;
        button.append(pixels);
      }
      button.addEventListener("click", () => {
        current.sizeId = size.id;
        renderSizes();
        changed();
      });
      return button;
    }),
  );
  $("custom-size").hidden = current.sizeId !== "custom";
  if (mode === "single") {
    $("custom-width").value = current.customWidth;
    $("custom-height").value = current.customHeight;
  }
}

function renderFormats() {
  const current = state();
  $("formats").replaceChildren(
    ...FORMATS.map(([format, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(format === current.format));
      button.textContent = label;
      button.addEventListener("click", () => {
        current.format = format;
        renderFormats();
        persist();
      });
      return button;
    }),
  );
  $("quality-row").hidden = current.format !== "jpg";
  $("quality").value = current.quality;
  $("quality-value").textContent = current.quality;
}

function renderScales() {
  $("scales").replaceChildren(
    ...SCALES.map((scale) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(scale === state().scale));
      button.textContent = `${scale}x`;
      button.addEventListener("click", () => {
        state().scale = scale;
        renderScales();
        persist();
      });
      return button;
    }),
  );
}

// Right panel

function renderFilters() {
  const names = ["All", ...config().categories, MINE];
  $("filters").replaceChildren(
    ...names.map((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter";
      button.textContent = name;
      button.setAttribute("aria-pressed", String(name === filters[mode]));
      button.addEventListener("click", () => {
        filters[mode] = name;
        renderFilters();
        renderGallery();
      });
      return button;
    }),
  );
}

function visibleStyles() {
  const filter = filters[mode];
  if (filter === "All") return allStyles();
  if (filter === MINE) return customStyles[mode];
  return config().presets.filter((p) => p.category === filter);
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

async function drawCarouselThumbnail(canvas, style) {
  await ensureCarouselFonts(style);
  canvas.width = CAROUSEL_THUMB.width;
  canvas.height = (CAROUSEL_THUMB.width * 5) / 4;
  const enlarged = mergeDeep(style, {
    title: { size: style.title.size * 1.4 },
    body: { size: style.body.size * 1.9 },
  });
  const layout = layoutCarousel(measureContext, {
    width: 1080,
    height: 1350,
    title: CAROUSEL_THUMB.title,
    text: CAROUSEL_THUMB.text,
    style: enlarged,
  });
  renderSlide(canvas.getContext("2d"), layout, 0, CAROUSEL_THUMB.width / 1080);
}

async function drawPostThumbnail(canvas, style) {
  await ensurePostFonts(style);
  canvas.width = canvas.height = POST_THUMB.size;
  // Thumbnails are small, so the margin shrinks and the type is enlarged.
  const enlarged = mergeDeep(style, {
    layout: { margin: style.layout.margin * 0.5 },
    profile: { size: style.profile.size * 1.5 },
    body: { size: style.body.size * 1.7 },
  });
  renderPost(canvas.getContext("2d"), {
    ...POST_THUMB,
    width: POST_THUMB.size,
    height: POST_THUMB.size,
    verified: true,
    style: enlarged,
  });
}

function renderGallery() {
  const styles = visibleStyles();
  const draw = { carousel: drawCarouselThumbnail, post: drawPostThumbnail }[mode] ?? drawThumbnail;
  $("gallery").classList.toggle("portrait", mode === "carousel");
  $("gallery-empty").hidden = !(filters[mode] === MINE && styles.length === 0);
  const items = styles.map((raw) => {
    const style = config().withDefaults(raw);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.dataset.styleId = raw.id;
    button.setAttribute("aria-pressed", String(raw.id === state().styleId));
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
      await draw(item.canvas, item.style);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  })();
}

function markSelected() {
  document.querySelectorAll(".swatch").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.styleId === state().styleId));
  });
}

function renderCurrent() {
  const current = state();
  const base = findStyle(current.styleId);
  $("style-name").textContent = current.style.name ?? base?.name ?? "";
  $("style-edited").hidden = !current.edited;
  $("reset-style").hidden = !current.edited;
  $("update-style").hidden = !(current.edited && isCustom(current.styleId));
  $("delete-style").hidden = !isCustom(current.styleId);
}

function renderTune() {
  renderControls($("pane-tune"), state().style, onControlChange, config().controls);
}

function onControlChange(path, value, structural) {
  setPath(state().style, path, value);
  state().edited = true;
  renderCurrent();
  if (structural) renderTune();
  changed();
}

function selectStyle(id) {
  const style = findStyle(id);
  if (!style) return;
  const current = state();
  current.styleId = id;
  current.style = clone(style);
  current.edited = false;
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
  const current = state();
  const name = await askDialog({
    title: "Save as a new style",
    confirm: "Save style",
    input: `${current.style.name ?? "My style"} copy`,
  });
  if (!name) return;
  const { id: _id, category: _category, ...values } = current.style;
  let saved;
  try {
    saved = await bridge.saveStyle({ ...values, name }, mode);
  } catch {
    setStatus(WRITE_FAILED);
    return;
  }
  customStyles[mode] = await bridge.listStyles(mode);
  current.styleId = saved.id;
  current.style = clone(saved);
  current.edited = false;
  filters[mode] = MINE;
  renderFilters();
  renderGallery();
  renderCurrent();
  showTab("styles");
  setStatus(`Saved style ${saved.name}`);
  persist();
}

async function updateCustom() {
  const current = state();
  let saved;
  try {
    saved = await bridge.saveStyle({ ...current.style, id: current.styleId }, mode);
  } catch {
    setStatus(WRITE_FAILED);
    return;
  }
  customStyles[mode] = await bridge.listStyles(mode);
  current.style = clone(saved);
  current.edited = false;
  renderGallery();
  renderCurrent();
  setStatus(`Updated style ${saved.name}`);
  persist();
}

async function deleteCustom() {
  const style = findStyle(state().styleId);
  const confirmed = await askDialog({
    title: `Delete ${style.name}?`,
    text: "This removes the saved style. You cannot undo this.",
    confirm: "Delete style",
  });
  if (!confirmed) return;
  try {
    await bridge.deleteStyle(style.id, mode);
  } catch {
    setStatus(WRITE_FAILED);
    return;
  }
  customStyles[mode] = await bridge.listStyles(mode);
  renderGallery();
  selectStyle(config().presets[0].id);
  setStatus(`Deleted style ${style.name}`);
}

// Check for updates: runs only when the user selects the version number.

const UPDATE_TEXT = {
  newer: (r) => [`Quotical ${r.latest} is available.`, `You have ${r.current}. Open the release page to download the new version.`],
  current: (r) => ["Quotical is up to date.", `${r.current} is the latest release.`],
  dev: (r) => ["This is a development build.", `You are running ${r.current}. The latest release is ${r.latest}.`],
  branch: (r) => ["This is a test build.", `You are running ${r.current}. The latest release is ${r.latest}.`],
};

// Puts the version button beside the wordmark. The button sits at the end of the page, so it
// comes after the main content in the tab order.
function placeVersion() {
  const mark = $("wordmark").getBoundingClientRect();
  const button = $("version");
  button.style.left = `${Math.round(mark.right + 6)}px`;
  button.style.top = `${Math.round(mark.top + (mark.height - button.offsetHeight) / 2 + 2)}px`;
  // Report a Problem sits right after the version, on the same line.
  const report = $("report-problem");
  report.style.left = `${Math.round(button.getBoundingClientRect().right + 2)}px`;
  report.style.top = button.style.top;
}

function setVersionLabel(version) {
  const button = $("version");
  button.textContent = version;
  button.setAttribute("aria-label", `Version ${version}`);
  placeVersion();
}

async function checkForUpdates() {
  const button = $("version");
  if (button.disabled) return;
  const version = button.textContent;
  button.disabled = true;
  button.textContent = "checking…";
  placeVersion();
  let result;
  try {
    result = await bridge.checkForUpdates();
  } catch (error) {
    result = { error: `Can't reach GitHub: ${error.message ?? error}. Check the internet connection.` };
  } finally {
    button.disabled = false;
    setVersionLabel(version);
  }
  showUpdateResult(result);
}

function showUpdateResult(result) {
  const text = result.error ? [result.error, ""] : UPDATE_TEXT[result.kind]?.(result);
  const [headline, detail] = text ?? ["GitHub sent an answer Quotical can't read. Try again later.", ""];
  $("update-headline").textContent = headline;
  $("update-detail").textContent = detail;
  $("update-detail").hidden = !detail;
  const offer = !result.error && result.kind !== "current";
  $("update-open").hidden = !offer;
  $("update-notes").hidden = !(offer && result.notes);
  $("update-notes").open = false;
  // The notes are Markdown. Shown as plain text, so the bold marks are removed.
  $("update-notes-text").textContent = (result.notes ?? "").replace(/\*\*(.+?)\*\*/g, "$1");
  if (result.kind === "newer") {
    $("version").classList.add("has-update");
    $("version").title = `${result.latest} is available. Click for details.`;
  }
  const dialog = $("update-dialog");
  dialog.showModal();
  // Open release page is the default button when it is offered.
  (offer ? $("update-open") : dialog.querySelector("[value=close]")).focus();
}

// Modes

function setMode(next) {
  if (next === mode || !MODES[next] || exporting) return;
  mode = next;
  carouselLayout = null;
  setStatus("");
  renderAll();
  persist();
}

function renderMode() {
  document.querySelectorAll("#modes [data-mode]").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.mode === mode));
  });
  for (const [name, modeConfig] of Object.entries(MODES)) {
    modeConfig.panels.forEach((id) => {
      $(id).hidden = name !== mode;
    });
  }
  const carousel = mode === "carousel";
  $("stage").classList.toggle("carousel", carousel);
  $("slide-bar").hidden = !carousel;
  if (!carousel) $("filmstrip").replaceChildren();
  $("highlight-hint").textContent = config().highlightHint;
  $("copy-image").textContent = config().actions.copy;
  $("save-image").textContent = config().actions.save;
  // In Carousel, Save all slides is the main action and Save slide is a second choice.
  $("save-all").hidden = !carousel;
  $("save-image").classList.toggle("primary", !carousel);
}

// True while the user types in a field, so the arrow keys keep their usual job there.
const isTyping = (target) => !!target.closest?.("input, textarea, select, [contenteditable]");

function bindEvents() {
  for (const [name, modeConfig] of Object.entries(MODES)) {
    for (const [key, id] of Object.entries(modeConfig.fields)) {
      $(id).addEventListener("input", (event) => {
        work[name][key] = event.target.value;
        changed();
      });
    }
    for (const id of modeConfig.highlightFields) {
      $(id).addEventListener("focus", () => {
        lastHighlightField[name] = id;
      });
    }
  }
  for (const [id, key] of [["custom-width", "customWidth"], ["custom-height", "customHeight"]]) {
    $(id).addEventListener("input", (event) => {
      work.single[key] = event.target.value;
      changed();
    });
  }
  $("keep-breaks").addEventListener("change", (event) => {
    work.carousel.keepLineBreaks = event.target.checked;
    changed();
  });
  $("post-verified").addEventListener("change", (event) => {
    work.post.verified = event.target.checked;
    changed();
  });
  $("post-actions").addEventListener("change", (event) => {
    work.post.actions = event.target.checked;
    changed();
  });
  $("choose-avatar").addEventListener("click", chooseAvatar);
  $("version").addEventListener("click", checkForUpdates);
  $("report-problem").addEventListener("click", () => bridge.reportProblem());
  $("update-form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "open") bridge.openReleasePage();
  });
  new ResizeObserver(placeVersion).observe($("wordmark"));
  window.addEventListener("resize", placeVersion);
  $("remove-avatar").addEventListener("click", removeAvatar);
  document.querySelectorAll("#modes [data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  $("insert-break").addEventListener("click", insertSlideBreak);
  $("open-text").addEventListener("click", openTextFile);
  $("prev-slide").addEventListener("click", () => goToSlide(state().slide - 1));
  $("next-slide").addEventListener("click", () => goToSlide(state().slide + 1));
  $("save-image").addEventListener("click", saveImage);
  $("save-all").addEventListener("click", saveAllSlides);
  $("quality").addEventListener("input", (event) => {
    state().quality = Number(event.target.value);
    $("quality-value").textContent = event.target.value;
    persist();
  });
  $("copy-image").addEventListener("click", copyImage);
  $("tab-styles").addEventListener("click", () => showTab("styles"));
  $("tab-tune").addEventListener("click", () => showTab("tune"));
  $("reset-style").addEventListener("click", () => selectStyle(state().styleId));
  $("save-style").addEventListener("click", saveAsNew);
  $("update-style").addEventListener("click", updateCustom);
  $("delete-style").addEventListener("click", deleteCustom);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (mode === "carousel") saveAllSlides();
      else saveImage();
      return;
    }
    if (mode !== "carousel" || !carouselLayout || isTyping(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey || $("dialog").open) return;
    const moves = {
      ArrowLeft: -1,
      ArrowRight: 1,
      PageUp: -1,
      PageDown: 1,
      Home: -Infinity,
      End: Infinity,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const step = moves[event.key];
    goToSlide(Number.isFinite(step) ? state().slide + step : step < 0 ? 0 : carouselLayout.slides.length - 1);
  });
}

function applySavedWork(name, saved) {
  const target = work[name];
  const modeConfig = MODES[name];
  for (const key of Object.keys(modeConfig.defaults)) {
    if (key === "sizeId" || saved[key] === undefined) continue;
    // The custom size fields save what was typed, which can be a string.
    const numeric = ["customWidth", "customHeight"].includes(key) && ["string", "number"].includes(typeof saved[key]);
    if (numeric || typeof saved[key] === typeof modeConfig.defaults[key]) target[key] = saved[key];
  }
  if (modeConfig.sizes.some((s) => s.id === saved.sizeId)) target.sizeId = saved.sizeId;
  // Only a picture this window made itself is accepted.
  if (name === "post" && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(target.avatar)) target.avatar = "";
  if (SCALES.includes(saved.scale)) target.scale = saved.scale;
  if (!FORMATS.some(([format]) => format === target.format)) target.format = modeConfig.defaults.format;
  target.quality = Math.min(QUALITY.max, Math.max(QUALITY.min, Math.round(Number(target.quality)) || 90));
  const all = [...modeConfig.presets, ...customStyles[name]];
  const base = all.find((s) => s.id === saved.styleId);
  if (base) {
    target.styleId = saved.styleId;
    target.style = mergeDeep(modeConfig.withDefaults(saved.edited && saved.style ? saved.style : base), {});
    target.edited = !!saved.edited;
  }
}

function renderAll() {
  for (const [name, modeConfig] of Object.entries(MODES)) {
    for (const [key, id] of Object.entries(modeConfig.fields)) $(id).value = work[name][key];
  }
  $("keep-breaks").checked = work.carousel.keepLineBreaks;
  $("post-verified").checked = work.post.verified;
  $("post-actions").checked = work.post.actions;
  renderAvatar();
  renderMode();
  renderSizes();
  renderScales();
  renderFormats();
  renderFilters();
  renderGallery();
  renderCurrent();
  renderTune();
  requestRender();
}

async function start() {
  work.single = freshWork("single");
  work.carousel = freshWork("carousel");
  work.post = freshWork("post");
  bindEvents();
  renderHighlights();
  showTab("styles");
  renderAll(); // Show the window content straight away, then restore saved work.
  await bridge.connect();
  setVersionLabel(`v${await bridge.getVersion()}`);
  document.fonts.ready.then(placeVersion);
  customStyles.single = await bridge.listStyles("single");
  customStyles.carousel = await bridge.listStyles("carousel");
  customStyles.post = await bridge.listStyles("post");
  const saved = readSavedState(await bridge.loadState());
  applySavedWork("single", saved.single);
  applySavedWork("carousel", saved.carousel);
  applySavedWork("post", saved.post);
  mode = saved.mode;
  renderAll();
}

start();
