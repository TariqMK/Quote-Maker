// Connects the interface to the Python app. In a plain browser (for development) it falls
// back to browser storage and a normal download, so the interface runs without Python.

// Each mode keeps its saved styles apart, the same as the desktop app's files.
const STYLES_KEYS = { single: "quotical-styles", carousel: "quotical-carousel-styles", post: "quotical-post-styles" };
const STATE_KEY = "quotical-state";
const WAIT_FOR_DESKTOP_MS = 1500;

let desktop = null;

export function connect() {
  return new Promise((resolve) => {
    const done = () => {
      desktop = window.pywebview?.api ?? null;
      resolve(!!desktop);
    };
    if (window.pywebview?.api) return done();
    window.addEventListener("pywebviewready", done, { once: true });
    setTimeout(done, WAIT_FOR_DESKTOP_MS);
  });
}

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser storage is only the development fallback, so a failed write is harmless.
  }
}

export async function getVersion() {
  return desktop ? desktop.get_version() : "0.0.0.dev0";
}

// Asks GitHub for the latest release, through Python. Only the desktop app can do this, because
// the window itself is not allowed any network access.
export async function checkForUpdates() {
  return desktop ? desktop.check_for_updates() : { error: "The update check works in the desktop app only." };
}

export async function openReleasePage() {
  if (desktop) return desktop.open_release_page();
  return null;
}

// Opens the GitHub bug form in the user's browser. Python fills in the version and system.
export async function reportProblem() {
  if (desktop) return desktop.report_problem();
  window.open("https://github.com/TariqMK/Quotical/issues/new?template=bug.yml", "_blank", "noopener");
  return null;
}

export async function listStyles(kind = "single") {
  return desktop ? desktop.list_styles(kind) : readLocal(STYLES_KEYS[kind], []);
}

export async function saveStyle(style, kind = "single") {
  if (desktop) return desktop.save_style(style, kind);
  const saved = { ...style, id: style.id || `custom-${Date.now()}` };
  const styles = readLocal(STYLES_KEYS[kind], []).filter((s) => s.id !== saved.id);
  writeLocal(STYLES_KEYS[kind], [...styles, saved]);
  return saved;
}

export async function deleteStyle(id, kind = "single") {
  if (desktop) return desktop.delete_style(id, kind);
  writeLocal(STYLES_KEYS[kind], readLocal(STYLES_KEYS[kind], []).filter((s) => s.id !== id));
  return true;
}

// Asks for a text file and returns { name, text }, or null if the user cancelled.
export async function openTextFile() {
  if (desktop) return desktop.open_text_file();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,.md,text/plain,text/markdown";
  const file = await new Promise((resolve) => {
    input.addEventListener("change", () => resolve(input.files[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
  if (!file) return null;
  return { name: file.name.replace(/\.[^.]+$/, ""), text: await file.text() };
}

// Asks for a picture and returns { name, dataUrl }, or null if the user cancelled.
export async function openImageFile() {
  if (desktop) return desktop.open_image_file();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif";
  const file = await new Promise((resolve) => {
    input.addEventListener("change", () => resolve(input.files[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
  if (!file) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
  return { name: file.name.replace(/\.[^.]+$/, ""), dataUrl };
}

export async function loadState() {
  return desktop ? desktop.load_state() : readLocal(STATE_KEY, {});
}

export async function saveState(state) {
  return desktop ? desktop.save_state(state) : writeLocal(STATE_KEY, state);
}

function download(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${filename}.${dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png"}`;
  link.click();
  return link.download;
}

// Returns the saved path, or null if the user cancelled the save dialog.
export async function saveImage(dataUrl, filename) {
  return desktop ? desktop.save_image(dataUrl, filename) : download(dataUrl, filename);
}

// Asks where to save a set of slides and makes a new folder named after it.
// Returns the folder's path, or null if the user cancelled.
export async function chooseExportFolder(name) {
  return desktop ? desktop.choose_export_folder(name) : name;
}

// Writes one slide into the folder from chooseExportFolder. Returns the file's path.
export async function saveExportImage(dataUrl, filename) {
  return desktop ? desktop.save_export_image(dataUrl, filename) : download(dataUrl, filename);
}
