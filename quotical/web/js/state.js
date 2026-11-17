// Reads and builds the saved work in state.json. Each mode keeps its own work under its own key.

export const MODES = ["single", "carousel", "post"];
export const DEFAULT_MODE = "single";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Returns { mode, single, carousel, post }. Versions before modes saved the single image work at the
// top level, so a file without a "single" key is read as that older layout.
export function readSavedState(saved) {
  if (!isObject(saved)) return { mode: DEFAULT_MODE, single: {}, carousel: {}, post: {} };
  const mode = MODES.includes(saved.mode) ? saved.mode : DEFAULT_MODE;
  const single = isObject(saved.single) ? saved.single : saved;
  const carousel = isObject(saved.carousel) ? saved.carousel : {};
  const post = isObject(saved.post) ? saved.post : {};
  return { mode, single, carousel, post };
}

export function buildSavedState(mode, single, carousel, post = {}) {
  return { mode, single, carousel, post };
}
