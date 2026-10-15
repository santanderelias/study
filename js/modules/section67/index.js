/**
 * Section 67 — module 67 (submodule package)
 *
 * Folder layout:
 *   section67/
 *     index.js       ← this file (orchestrator entry)
 *     content.html   ← markup injected here (no HTML strings in JS)
 *     section67.css   ← module-local styles
 *     counter.js     ← optional behavior submodule
 *     loader.js      ← shared load helpers for this package
 *     assets/
 *       banner.svg
 */

import { Module } from '../base.js';
import { bindAssets, fetchText, loadStylesheet, resolveAsset } from './loader.js';
import { initCounter } from './counter.js';

export class Section67Module extends Module {
  constructor() {
    super({
      id: 67,
      name: 'Section 67',
      navLabel: 'Section 67',
      navOrder: 67,
    });
    /** @type {{ destroy: () => void } | null} */
    this._counter = null;
    this._loaded = false;
  }

  /**
   * Placeholder only — real markup comes from content.html via load().
   * @returns {string}
   */
  render() {
    return `
      <div class="s67-status" data-s67-status role="status">
        Loading Section 67…
      </div>
    `;
  }

  /**
   * Async package bootstrap: CSS + HTML + assets + submodules.
   * Called by Module.mount when present.
   */
  async load() {
    if (!this.element || this._loaded) return;

    const status = this.element.querySelector('[data-s67-status]');

    try {
      const cssUrl = resolveAsset('./section67.css', import.meta.url);
      const htmlUrl = resolveAsset('./content.html', import.meta.url);

      await loadStylesheet(cssUrl, 'module-css-section67');
      const html = await fetchText(htmlUrl);

      this.element.innerHTML = html;
      this.element.classList.add('s67-ready');

      // Point images at package assets (paths relative to page won't work for injected HTML)
      bindAssets(this.element, import.meta.url);

      // Wire extra JS submodule
      const counterRoot = this.element.querySelector('[data-s67-counter]');
      if (counterRoot instanceof HTMLElement) {
        this._counter = initCounter(counterRoot);
      }

      this._loaded = true;
    } catch (err) {
      console.error('[Section67]', err);
      if (status) {
        status.classList.add('s67-status--error');
        status.textContent =
          'Could not load Section 67 package. Serve the app over HTTP so content.html and CSS can be fetched.';
      } else if (this.element) {
        this.element.innerHTML = `
          <div class="s67-status s67-status--error" role="alert">
            Could not load Section 67 package.
          </div>
        `;
      }
    }
  }

  hide() {
    super.hide();
  }

  destroy() {
    this._counter?.destroy();
    this._counter = null;
  }
}
