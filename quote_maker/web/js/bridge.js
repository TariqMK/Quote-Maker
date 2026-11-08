// Connects the interface to the Python app. In a plain browser (for development) it falls
// back to browser storage and a normal download, so the interface runs without Python.

const STYLES_KEY = "quote-maker-styles";
const STATE_KEY = "quote-maker-state";
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

export async function listStyles() {
  return desktop ? desktop.list_styles() : readLocal(STYLES_KEY, []);
}

export async function saveStyle(style) {
  if (desktop) return desktop.save_style(style);
  const saved = { ...style, id: style.id || `custom-${Date.now()}` };
  const styles = readLocal(STYLES_KEY, []).filter((s) => s.id !== saved.id);
  writeLocal(STYLES_KEY, [...styles, saved]);
  return saved;
}

export async function deleteStyle(id) {
  if (desktop) return desktop.delete_style(id);
  writeLocal(STYLES_KEY, readLocal(STYLES_KEY, []).filter((s) => s.id !== id));
  return true;
}

export async function loadState() {
  return desktop ? desktop.load_state() : readLocal(STATE_KEY, {});
}

export async function saveState(state) {
  return desktop ? desktop.save_state(state) : writeLocal(STATE_KEY, state);
}

// Returns the saved path, or null if the user cancelled the save dialog.
export async function saveImage(dataUrl, filename) {
  if (desktop) return desktop.save_image(dataUrl, filename);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${filename}.png`;
  link.click();
  return link.download;
}
