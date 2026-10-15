/**
 * Helpers for loading submodule package assets (HTML, CSS, images).
 * Paths are resolved relative to the calling module via import.meta.url.
 */

const loadedStyles = new Set();

/**
 * Resolve a path relative to a module URL base.
 * @param {string} relativePath  e.g. './content.html'
 * @param {string | URL} baseUrl  typically import.meta.url
 * @returns {string}
 */
export function resolveAsset(relativePath, baseUrl) {
  return new URL(relativePath, baseUrl).href;
}

/**
 * Fetch text content (HTML fragments, etc.).
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Inject a stylesheet once (idempotent by URL).
 * @param {string} href
 * @param {string} [id]
 * @returns {Promise<void>}
 */
export function loadStylesheet(href, id) {
  if (loadedStyles.has(href)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = id ? document.getElementById(id) : null;
    if (existing) {
      loadedStyles.add(href);
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    if (id) link.id = id;
    link.onload = () => {
      loadedStyles.add(href);
      resolve();
    };
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
    document.head.appendChild(link);
  });
}

/**
 * Rewrite [data-s67-asset] (or custom attr) image sources to absolute module URLs.
 * @param {HTMLElement} root
 * @param {string | URL} baseUrl  import.meta.url of the package entry
 * @param {string} [attr='data-s67-asset']
 * @param {string} [assetsDir='./assets/']
 */
export function bindAssets(root, baseUrl, attr = 'data-s67-asset', assetsDir = './assets/') {
  root.querySelectorAll(`[${attr}]`).forEach((el) => {
    const name = el.getAttribute(attr);
    if (!name) return;
    const href = resolveAsset(`${assetsDir}${name}`, baseUrl);
    if (el instanceof HTMLImageElement || el instanceof HTMLSourceElement) {
      el.src = href;
    } else if (el instanceof HTMLElement) {
      el.style.backgroundImage = `url("${href}")`;
    }
  });
}
