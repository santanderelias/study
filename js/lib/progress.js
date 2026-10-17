/**
 * Study progress in localStorage: studied notes, last opened note, reading mode.
 */

const KEY = 'study-library-v1';

/**
 * @typedef {{ studied: Record<string, number>, last: string | null, mode: 'auto' | 'repaso' | 'lectura' }} Progress
 */

/** @returns {Progress} */
function empty() {
  return { studied: {}, last: null, mode: 'auto' };
}

/** @returns {Progress} */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    const studied = data && typeof data.studied === 'object' && data.studied ? data.studied : {};
    const mode = data?.mode === 'repaso' || data?.mode === 'lectura' ? data.mode : 'auto';
    const last = typeof data?.last === 'string' ? data.last : null;
    return { studied, last, mode };
  } catch {
    return empty();
  }
}

/** @param {Progress} data */
function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

/** @param {string} key */
export function isStudied(key) {
  return Boolean(loadProgress().studied[key]);
}

/** @param {string} key @returns {boolean} next studied state */
export function toggleStudied(key) {
  const data = loadProgress();
  if (data.studied[key]) delete data.studied[key];
  else data.studied[key] = Date.now();
  save(data);
  return Boolean(data.studied[key]);
}

/** @param {string | null} key */
export function setLast(key) {
  const data = loadProgress();
  data.last = key;
  save(data);
}

/** @returns {string | null} */
export function getLast() {
  return loadProgress().last;
}

/** @returns {'auto' | 'repaso' | 'lectura'} */
export function getMode() {
  return loadProgress().mode;
}

/** @param {'auto' | 'repaso' | 'lectura'} mode */
export function setMode(mode) {
  const data = loadProgress();
  data.mode = mode;
  save(data);
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** @param {string[]} keys */
export function studiedCount(keys) {
  const studied = loadProgress().studied;
  return keys.filter((key) => studied[key]).length;
}
