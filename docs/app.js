// Runs the Quote-Maker product page: the working demo, the proof sheet and the download links.

import { CATEGORIES, PRESETS, mergeDeep, withDefaults } from "./engine/js/presets.js";
import { ensureFonts, renderQuote } from "./engine/js/render.js";

const REPO = "TariqMK/Quote-Maker";
const ASSET = { windows: /windows-x64\.exe$/i, macos: /macos-arm64\.zip$/i, linux: /linux-x64\.tar\.gz$/i };
const OS_NAME = { windows: "Windows", macos: "macOS", linux: "Linux" };

const SIZES = [
  { id: "square", name: "Square", width: 1080, height: 1080 },
  { id: "portrait", name: "Portrait", width: 1080, height: 1350 },
  { id: "landscape", name: "Landscape", width: 1200, height: 675 },
  { id: "story", name: "Story", width: 1080, height: 1920 },
];
const THUMB = { quote: "Words *worth* keeping", author: "Author", size: 400, textScale: 1.7 };
const WALL = { width: 432, height: 540 };
const SIZE_PROOF_SCALE = 0.3;
const EMPHASIS_SAMPLE = "Start with the *best* line";
const EMPHASIS_KINDS = [
  { name: "Italic", overrides: { emphasis: "italic" } },
  { name: "Bold", overrides: { emphasis: "bold" } },
  { name: "Colour", overrides: { emphasis: "color", emphasisColor: "#a2371f" } },
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
};

const words = () => ({ quote: state.quote, author: state.author, source: state.source });
const currentStyle = () => presetById(state.styleId);
const currentSize = () => SIZES.find((s) => s.id === state.sizeId);

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
  const availableHeight = narrow ? 440 : stage.clientHeight - parseFloat(styles.paddingTop) * 2 - 56;
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

// Window controls

function renderSizes() {
  $("sizes").replaceChildren(
    ...SIZES.map((size) => {
      const button = el("button", "size-option");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(size.id === state.sizeId));
      button.append(el("span", "", size.name), el("small", "", `${size.width} × ${size.height}`));
      button.addEventListener("click", () => {
        state.sizeId = size.id;
        renderSizes();
        requestPreview();
      });
      return button;
    }),
  );
}

function renderFilters() {
  $("filters").replaceChildren(
    ...["All", ...CATEGORIES].map((name) => {
      const button = el("button", "filter", name);
      button.type = "button";
      button.setAttribute("aria-pressed", String(name === state.filter));
      button.addEventListener("click", () => {
        state.filter = name;
        renderFilters();
        renderGallery();
      });
      return button;
    }),
  );
}

function renderGallery() {
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
  document.querySelectorAll("[data-style-id]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.styleId === state.styleId));
  });
  $("style-name").textContent = PRESETS.find((p) => p.id === state.styleId).name;
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
        drawStyled(target, 480, 480, style, { quote: EMPHASIS_SAMPLE, author: "", source: "" }),
      );
      return item;
    }),
  );
}

let textTimer = null;

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
