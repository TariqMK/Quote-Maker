// Runs the Quotical product page: the working demo, the proof sheet and the download links.
// The demo has the app's three modes: Single image, Carousel and Post.

import { CAROUSEL_PRESETS, withCarouselDefaults } from "./engine/js/carousel-presets.js";
import { ensureCarouselFonts, layoutCarousel, renderSlide } from "./engine/js/carousel.js";
import { ensurePostFonts, renderPost } from "./engine/js/post.js";
import { POST_CATEGORIES, POST_PRESETS, withPostDefaults } from "./engine/js/post-presets.js";
import { CATEGORIES, PRESETS, mergeDeep, withDefaults } from "./engine/js/presets.js";
import { ensureFonts, renderQuote } from "./engine/js/render.js";
import { HIGHLIGHTS, applyHighlight } from "./engine/js/text.js";

const REPO = "TariqMK/Quotical";
const ASSET = { windows: /windows-x64\.exe$/i, macos: /macos-arm64\.zip$/i, linux: /linux-x64\.tar\.gz$/i };
const OS_NAME = { windows: "Windows", macos: "macOS", linux: "Linux" };

const SIZES = [
  { id: "square", name: "Square", width: 1080, height: 1080 },
  { id: "portrait", name: "Portrait", width: 1080, height: 1350 },
  { id: "landscape", name: "Landscape", width: 1200, height: 675 },
  { id: "story", name: "Story", width: 1080, height: 1920 },
];
const CAROUSEL_SIZES = [
  { id: "portrait", name: "Portrait", width: 1080, height: 1350 },
  { id: "square", name: "Square", width: 1080, height: 1080 },
  { id: "tall", name: "Tall", width: 1080, height: 1440 },
];
const THUMB = { quote: "Words *worth* keeping", author: "Author", size: 400, textScale: 1.7 };
const CAROUSEL_THUMB = {
  width: 320,
  title: "Words worth keeping",
  text: "Clear writing is a set of *small habits* that anyone can learn, one paragraph at a time.",
};
const POST_THUMB = { size: 400, name: "Alex Rivera", handle: "@alexwrites", date: "2h", text: "Words *worth* keeping." };
const FILM_HEIGHT = 112; // Slide thumbnails are drawn at 2x their 56 px display height.
const WALL = { width: 432, height: 540 };
const SIZE_PROOF_SCALE = 0.3;
const EMPHASIS_SAMPLE = "Start with the *best* line";
const HIGHLIGHT_SAMPLE = "Start with the [yellow: best] line";
const HIGHLIGHT_HINTS = {
  single: "Select words in Quote, then select a colour",
  carousel: "Select words, then select a colour",
  post: "Select words in Post, then select a colour",
};
const EMPHASIS_KINDS = [
  { name: "Italic", overrides: { emphasis: "italic" } },
  { name: "Bold", overrides: { emphasis: "bold" } },
  { name: "Colour", overrides: { emphasis: "color", emphasisColor: "#a2371f" } },
  { name: "Highlight", overrides: {}, sample: HIGHLIGHT_SAMPLE },
];

const $ = (id) => document.getElementById(id);
const presetById = (id) => withDefaults(PRESETS.find((p) => p.id === id));

// The sample words are made up. They match the README screenshots.
const state = {
  quote: "Keep the first draft. It remembers what you *meant* before you knew how to say it.",
  author: "Mara Ellison",
  source: "Notes from the Harbour",
  sizeId: "portrait",
  styleId: "oxblood",
  filter: "All",
  mode: "single",
};

// The carousel sample matches the README screenshot.
const carousel = {
  title: "Six ways to read more books",
  subtitle: "Notes by Mara Ellison · 4 min read",
  text: `Most people who want to read more do not need more time. They need *fewer decisions* between them and the next page.

**Keep a book within reach.** On the table, in the bag, beside the bed. The book you can see is the book you open.

**Stop books you do not enjoy.** Finishing is not a duty. Put it down and start the next one.

**Read a little, often.** Ten pages a day is [yellow: more than 3,000 pages a year]. That is a dozen books.

[slide]
**Make it the default.** Read on the train instead of scrolling. Read for five minutes before you sleep.

**Talk about what you read.** Telling a friend about a chapter fixes it in your memory.

**Keep a short list.** Write down every title you finish. The list grows faster than you expect.`,
  sizeId: "portrait",
  styleId: "carousel-paper",
  slide: 0,
};
// The post sample matches the README screenshot.
const post = {
  name: "Mara Ellison",
  handle: "@maraellison",
  date: "8:15 AM · Nov 17, 2026",
  text: "Keep the first draft.\n\nIt remembers what you *meant* before you knew how to say it. The [yellow: second draft] only makes it clearer.",
  sizeId: "square",
  styleId: "post-short-dim",
  filter: "All",
};
let carouselLayout = null;
const measureContext = document.createElement("canvas").getContext("2d");
const lastField = { single: "quote", carousel: "article", post: "post-text" };

const words = () => ({ quote: state.quote, author: state.author, source: state.source });
const currentStyle = () => presetById(state.styleId);
const carouselStyle = () => withCarouselDefaults(CAROUSEL_PRESETS.find((p) => p.id === carousel.styleId));
const postStyle = () => withPostDefaults(POST_PRESETS.find((p) => p.id === post.styleId));
const isCarousel = () => state.mode === "carousel";
const isPost = () => state.mode === "post";
// The work of the open mode: its size, style and filter.
const modeWork = () => ({ single: state, carousel, post })[state.mode];
const currentSize = () => (isCarousel() ? CAROUSEL_SIZES : SIZES).find((s) => s.id === modeWork().sizeId);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function cropMarks(parent) {
  for (const corner of ["tl", "tr", "bl", "br"]) parent.append(el("span", `crop ${corner}`));
}

// Draw queue: only canvases on screen are drawn, and one per frame, so typing stays responsive
// and a visitor loads only the fonts of the styles they reach.
const drawers = new Map();
const onScreen = new Set();
const dirty = new Set();
let pumping = false;

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) onScreen.add(entry.target);
      else onScreen.delete(entry.target);
    }
    pump();
  },
  { rootMargin: "300px" },
);

function register(canvas, draw) {
  drawers.set(canvas, draw);
  dirty.add(canvas);
  observer.observe(canvas);
}

function invalidate(canvas) {
  dirty.add(canvas);
}

async function pump() {
  if (pumping) return;
  pumping = true;
  for (;;) {
    const next = [...dirty].find((canvas) => onScreen.has(canvas));
    if (!next) break;
    dirty.delete(next);
    if (next.isConnected) await drawers.get(next)(next);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  pumping = false;
}

async function drawStyled(canvas, width, height, style, text) {
  await ensureFonts(style);
  canvas.width = width;
  canvas.height = height;
  renderQuote(canvas.getContext("2d"), { width, height, style, ...text });
}

// Main preview

let previewToken = 0;
let previewPending = false;

function fitPreview() {
  const { width, height } = currentSize();
  const stage = $("stage");
  const narrow = matchMedia("(max-width: 860px)").matches;
  const styles = getComputedStyle(stage);
  const availableWidth = stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight) - 24;
  // In Carousel, the slide row under the proof takes space too.
  const below = 56 + (isCarousel() ? 56 : 0);
  const availableHeight = narrow ? 440 : stage.clientHeight - parseFloat(styles.paddingTop) * 2 - below;
  const scale = Math.min(availableWidth / width, availableHeight / height);
  const canvas = $("preview");
  canvas.style.width = `${Math.round(width * scale)}px`;
  canvas.style.height = `${Math.round(height * scale)}px`;
}

function requestPreview() {
  if (previewPending) return;
  previewPending = true;
  requestAnimationFrame(async () => {
    previewPending = false;
    const token = ++previewToken;
    if (isCarousel()) {
      const style = carouselStyle();
      await ensureCarouselFonts(style);
      if (token !== previewToken) return;
      drawCarousel(style);
      return;
    }
    if (isPost()) {
      const style = postStyle();
      await ensurePostFonts(style);
      if (token !== previewToken) return;
      const { width, height } = currentSize();
      const canvas = $("preview");
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      fitPreview();
      // The demo has no picture, so the post shows the initials. The app can add a picture.
      const result = renderPost(canvas.getContext("2d"), { width, height, ...post, verified: true, style });
      const note = `${width} × ${height} px`;
      $("proof-note").textContent = result.fittedDown
        ? `${note}  ·  text reduced to size ${Math.round(result.fontSize)} to fit`
        : note;
      return;
    }
    const style = currentStyle();
    await ensureFonts(style);
    if (token !== previewToken) return;
    const { width, height } = currentSize();
    const canvas = $("preview");
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    fitPreview();
    const result = renderQuote(canvas.getContext("2d"), { width, height, style, ...words() });
    const note = `${width} × ${height} px`;
    $("proof-note").textContent = result.fittedDown
      ? `${note}  ·  text reduced to size ${Math.round(result.fontSize)} to fit`
      : note;
  });
}

// Carousel: lays the article out once, then draws the open slide and the slide row.
function drawCarousel(style) {
  const { width, height } = currentSize();
  carouselLayout = layoutCarousel(measureContext, {
    width,
    height,
    title: carousel.title,
    subtitle: carousel.subtitle,
    text: carousel.text,
    style,
  });
  carousel.slide = Math.min(carousel.slide, carouselLayout.slides.length - 1);
  const strip = $("filmstrip");
  const { slides } = carouselLayout;
  while (strip.children.length > slides.length) strip.lastElementChild.remove();
  while (strip.children.length < slides.length) {
    const index = strip.children.length;
    const button = el("button", "thumb");
    button.type = "button";
    button.append(el("canvas"));
    button.addEventListener("click", () => goToSlide(index));
    strip.append(button);
  }
  const scale = FILM_HEIGHT / height;
  [...strip.children].forEach((button, i) => {
    button.setAttribute("aria-label", `Slide ${i + 1} of ${slides.length}`);
    const canvas = button.firstElementChild;
    canvas.width = Math.round(width * scale);
    canvas.height = FILM_HEIGHT;
    renderSlide(canvas.getContext("2d"), carouselLayout, i, scale);
  });
  drawSlide();
}

function drawSlide() {
  const { width, height, slides } = carouselLayout;
  const canvas = $("preview");
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  fitPreview();
  renderSlide(canvas.getContext("2d"), carouselLayout, carousel.slide);
  $("proof-note").textContent = `Slide ${carousel.slide + 1} of ${slides.length}  ·  ${width} × ${height} px`;
  $("prev-slide").disabled = carousel.slide === 0;
  $("next-slide").disabled = carousel.slide === slides.length - 1;
  [...$("filmstrip").children].forEach((button, i) => {
    button.setAttribute("aria-current", String(i === carousel.slide));
  });
}

function goToSlide(index) {
  if (!carouselLayout) return;
  carousel.slide = Math.min(Math.max(0, index), carouselLayout.slides.length - 1);
  drawSlide();
}

function setMode(mode) {
  if (mode === state.mode) return;
  state.mode = mode;
  document.querySelectorAll("#modes [data-mode]").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.mode === mode));
  });
  document.querySelectorAll("[data-mode-field]").forEach((field) => {
    field.hidden = field.dataset.modeField !== mode;
  });
  $("slide-bar").hidden = mode !== "carousel";
  $("filters").hidden = mode === "carousel";
  renderFilters();
  $("highlight-hint").textContent = HIGHLIGHT_HINTS[mode];
  renderSizes();
  renderGallery();
  markSelected();
  requestPreview();
}

// Window controls

// Applies a colour to the words selected in Quote. A null colour removes the highlight.
function highlightSelection(color) {
  const field = $(lastField[state.mode]);
  const result = applyHighlight(field.value, field.selectionStart, field.selectionEnd, color);
  $("highlight-hint").textContent = result ? HIGHLIGHT_HINTS[state.mode] : "Select words first";
  if (!result) return;
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
    const button = el("button", "highlight-swatch");
    button.type = "button";
    button.style.backgroundColor = color;
    const label = `${name[0].toUpperCase()}${name.slice(1)}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("mousedown", keepSelection);
    button.addEventListener("click", () => highlightSelection(name));
    return button;
  });
  const custom = el("input");
  custom.type = "color";
  custom.value = "#7fd1ae";
  custom.title = "Custom colour";
  custom.setAttribute("aria-label", "Custom colour");
  // "change" waits for the colour picker to close, because moving focus could close it early.
  custom.addEventListener("change", () => highlightSelection(custom.value));
  const clear = el("button", "highlight-clear", "Clear");
  clear.type = "button";
  clear.addEventListener("mousedown", keepSelection);
  clear.addEventListener("click", () => highlightSelection(null));
  $("highlights").replaceChildren(...swatches, custom, clear);
}

function renderSizes() {
  const target = modeWork();
  $("sizes").replaceChildren(
    ...(isCarousel() ? CAROUSEL_SIZES : SIZES).map((size) => {
      const button = el("button", "size-option");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(size.id === target.sizeId));
      button.append(el("span", "", size.name), el("small", "", `${size.width} × ${size.height}`));
      button.addEventListener("click", () => {
        target.sizeId = size.id;
        renderSizes();
        requestPreview();
      });
      return button;
    }),
  );
}

function renderFilters() {
  const target = isPost() ? post : state;
  $("filters").replaceChildren(
    ...["All", ...(isPost() ? POST_CATEGORIES : CATEGORIES)].map((name) => {
      const button = el("button", "filter", name);
      button.type = "button";
      button.setAttribute("aria-pressed", String(name === target.filter));
      button.addEventListener("click", () => {
        target.filter = name;
        renderFilters();
        renderGallery();
      });
      return button;
    }),
  );
}

function renderCarouselGallery() {
  $("gallery").classList.add("portrait");
  $("gallery").replaceChildren(
    ...CAROUSEL_PRESETS.map((preset) => {
      const button = el("button", "swatch");
      button.type = "button";
      button.dataset.styleId = preset.id;
      const canvas = el("canvas");
      canvas.setAttribute("aria-hidden", "true");
      button.append(canvas, el("span", "", preset.name));
      button.addEventListener("click", () => {
        carousel.styleId = preset.id;
        markSelected();
        requestPreview();
      });
      // Thumbnails are small, so the type is enlarged, the same as in the app.
      const style = mergeDeep(withCarouselDefaults(preset), {
        title: { size: preset.title.size * 1.4 },
        body: { size: preset.body.size * 1.9 },
      });
      register(canvas, async (target) => {
        await ensureCarouselFonts(style);
        target.width = CAROUSEL_THUMB.width;
        target.height = (CAROUSEL_THUMB.width * 5) / 4;
        const layout = layoutCarousel(measureContext, {
          width: 1080,
          height: 1350,
          title: CAROUSEL_THUMB.title,
          text: CAROUSEL_THUMB.text,
          style,
        });
        renderSlide(target.getContext("2d"), layout, 0, CAROUSEL_THUMB.width / 1080);
      });
      return button;
    }),
  );
  pump();
}

function renderPostGallery() {
  $("gallery").classList.remove("portrait");
  const shown = post.filter === "All" ? POST_PRESETS : POST_PRESETS.filter((p) => p.category === post.filter);
  $("gallery").replaceChildren(
    ...shown.map((preset) => {
      const button = el("button", "swatch");
      button.type = "button";
      button.dataset.styleId = preset.id;
      button.setAttribute("aria-pressed", String(preset.id === post.styleId));
      const canvas = el("canvas");
      canvas.setAttribute("aria-hidden", "true");
      button.append(canvas, el("span", "", preset.name));
      button.addEventListener("click", () => {
        post.styleId = preset.id;
        markSelected();
        requestPreview();
      });
      // Thumbnails are small, so the margin shrinks and the type is enlarged, the same as in the app.
      const style = mergeDeep(withPostDefaults(preset), {
        layout: { margin: preset.layout.margin * 0.5 },
        profile: { size: preset.profile.size * 1.5 },
        body: { size: preset.body.size * 1.7 },
      });
      register(canvas, async (target) => {
        await ensurePostFonts(style);
        target.width = target.height = POST_THUMB.size;
        renderPost(target.getContext("2d"), {
          ...POST_THUMB,
          width: POST_THUMB.size,
          height: POST_THUMB.size,
          verified: true,
          style,
        });
      });
      return button;
    }),
  );
  pump();
}

function renderGallery() {
  if (isCarousel()) {
    renderCarouselGallery();
    return;
  }
  if (isPost()) {
    renderPostGallery();
    return;
  }
  $("gallery").classList.remove("portrait");
  const shown = state.filter === "All" ? PRESETS : PRESETS.filter((p) => p.category === state.filter);
  $("gallery").replaceChildren(
    ...shown.map((preset) => {
      const button = el("button", "swatch");
      button.type = "button";
      button.dataset.styleId = preset.id;
      button.setAttribute("aria-pressed", String(preset.id === state.styleId));
      const canvas = el("canvas");
      canvas.setAttribute("aria-hidden", "true");
      button.append(canvas, el("span", "", preset.name));
      button.addEventListener("click", () => selectStyle(preset.id));
      // Thumbnails are small, so the type is enlarged, the same as in the app.
      const style = mergeDeep(withDefaults(preset), {
        quote: { size: preset.quote.size * THUMB.textScale },
        author: { size: preset.author.size * 1.6 },
      });
      register(canvas, (target) =>
        drawStyled(target, THUMB.size, THUMB.size, style, { quote: THUMB.quote, author: THUMB.author, source: "" }),
      );
      return button;
    }),
  );
  pump();
}

function markSelected() {
  const selected = modeWork().styleId;
  document.querySelectorAll("[data-style-id]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.styleId === selected));
  });
  const presets = { single: PRESETS, carousel: CAROUSEL_PRESETS, post: POST_PRESETS }[state.mode];
  $("style-name").textContent = presets.find((p) => p.id === selected).name;
}

const sizeProofs = [];

function selectStyle(id) {
  state.styleId = id;
  markSelected();
  requestPreview();
  sizeProofs.forEach(invalidate);
  pump();
}

// Features: the proof sheet and the two panels

const wallCanvases = [];

function buildWall() {
  $("wall").replaceChildren(
    ...PRESETS.map((preset) => {
      const button = el("button", "wall-item");
      button.type = "button";
      button.dataset.styleId = preset.id;
      button.setAttribute("aria-pressed", String(preset.id === state.styleId));
      const canvas = el("canvas");
      canvas.setAttribute("aria-hidden", "true");
      const name = el("span", "wall-name");
      name.append(el("span", "", preset.name), el("small", "", preset.category));
      button.append(canvas, name);
      button.addEventListener("click", () => {
        // The proof sheet shows quote styles, so a proof opens in Single image.
        setMode("single");
        selectStyle(preset.id);
        const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
        $("demo").scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      });
      const style = withDefaults(preset);
      register(canvas, (target) => drawStyled(target, WALL.width, WALL.height, style, words()));
      wallCanvases.push(canvas);
      return button;
    }),
  );
}

function buildSizeProofs() {
  const totalWidth = SIZES.reduce((sum, size) => sum + size.width, 0);
  $("size-proofs").replaceChildren(
    ...SIZES.map((size) => {
      const item = el("div", "size-proof");
      item.style.flex = `${size.width / totalWidth} 1 0`;
      const frame = el("div", "frame");
      const canvas = el("canvas");
      canvas.width = Math.round(size.width * SIZE_PROOF_SCALE);
      canvas.height = Math.round(size.height * SIZE_PROOF_SCALE);
      canvas.setAttribute("aria-hidden", "true");
      frame.append(canvas);
      cropMarks(frame);
      const label = el("p", "", size.name);
      label.append(el("small", "", `${size.width} × ${size.height}`));
      item.append(frame, label);
      register(canvas, (target) => drawStyled(target, target.width, target.height, currentStyle(), words()));
      sizeProofs.push(canvas);
      return item;
    }),
  );
}

function buildEmphasis() {
  const base = presetById("margin-note");
  $("emphasis").replaceChildren(
    ...EMPHASIS_KINDS.map((kind) => {
      const item = el("div");
      const canvas = el("canvas");
      canvas.setAttribute("aria-hidden", "true");
      item.append(canvas, el("p", "", kind.name));
      const style = mergeDeep(base, { quote: { ...kind.overrides, size: 150 }, layout: { margin: 70 } });
      register(canvas, (target) =>
        drawStyled(target, 480, 480, style, { quote: kind.sample ?? EMPHASIS_SAMPLE, author: "", source: "" }),
      );
      return item;
    }),
  );
}

let textTimer = null;

function bindCarousel() {
  for (const [id, key] of [["carousel-title", "title"], ["carousel-subtitle", "subtitle"], ["article", "text"]]) {
    const field = $(id);
    field.value = carousel[key];
    field.addEventListener("input", () => {
      carousel[key] = field.value;
      requestPreview();
    });
    field.addEventListener("focus", () => {
      lastField.carousel = id;
    });
  }
  document.querySelectorAll("#modes [data-mode]").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.mode === state.mode));
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  for (const [id, key] of [["post-name", "name"], ["post-handle", "handle"], ["post-text", "text"]]) {
    const field = $(id);
    field.value = post[key];
    field.addEventListener("input", () => {
      post[key] = field.value;
      requestPreview();
    });
  }
  $("prev-slide").addEventListener("click", () => goToSlide(carousel.slide - 1));
  $("next-slide").addEventListener("click", () => goToSlide(carousel.slide + 1));
}

function bindWords() {
  for (const key of ["quote", "author", "source"]) {
    const field = $(key);
    field.value = state[key];
    field.addEventListener("input", () => {
      state[key] = field.value;
      requestPreview();
      // The sheet follows shortly after typing stops, so each key press stays quick.
      clearTimeout(textTimer);
      textTimer = setTimeout(() => {
        [...wallCanvases, ...sizeProofs].forEach(invalidate);
        pump();
      }, 250);
    });
  }
}

// Downloads

function visitorOs() {
  const ua = navigator.userAgent;
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return null;
  if (/windows/i.test(ua)) return "windows";
  if (/mac os x|macintosh/i.test(ua)) return "macos";
  if (/linux|x11/i.test(ua)) return "linux";
  return null;
}

function setUpDownloads() {
  const os = visitorOs();
  const hero = $("hero-download");
  if (os) {
    hero.textContent = `Download for ${OS_NAME[os]}`;
    document.querySelector(`.download-card[data-os="${os}"]`).classList.add("is-yours");
  } else {
    // Phones and unknown systems go to the cards, which say what each download needs.
    hero.textContent = "See downloads";
    hero.href = "#download";
  }
  // On any failure (offline, rate limit, no release yet) the links keep pointing to the Releases page.
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    .then((response) => (response.ok ? response.json() : null))
    .then((release) => {
      if (!release) return;
      for (const [name, pattern] of Object.entries(ASSET)) {
        const asset = release.assets?.find((a) => pattern.test(a.name));
        if (!asset) continue;
        const card = document.querySelector(`.download-card[data-os="${name}"]`);
        card.href = asset.browser_download_url;
        card.querySelector(".card-size").textContent = `${(asset.size / 1048576).toFixed(1)} MB`;
        if (name === os) hero.href = asset.browser_download_url;
      }
      if (!release.tag_name) return;
      const date = new Date(release.published_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      $("hero-version").textContent = `${release.tag_name} · `;
      $("window-version").textContent = release.tag_name;
      $("download-version").textContent =
        `${release.tag_name}, released ${date}. Free, under the GNU General Public License v3.0.`;
    })
    .catch(() => {});
}

function start() {
  bindWords();
  bindCarousel();
  renderHighlights();
  renderSizes();
  renderFilters();
  renderGallery();
  buildWall();
  buildSizeProofs();
  buildEmphasis();
  markSelected();
  setUpDownloads();
  requestPreview();
  new ResizeObserver(fitPreview).observe($("stage"));
}

start();
