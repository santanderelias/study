/**
 * Section 2 — module 2 (submodule package)
 *
 * Folder layout:
 *   section2/
 *     index.js       ← this file (orchestrator entry)
 *     content.html   ← markup injected here (no HTML strings in JS)
 *     section2.css   ← module-local styles
 *     counter.js     ← optional behavior submodule
 *     loader.js      ← shared load helpers for this package
 *     assets/
 *       banner.svg
 */

import { Module } from '../base.js';
import { bindAssets, fetchText, loadStylesheet, resolveAsset } from './loader.js';
import { initCounter } from './counter.js';

export class Section2Module extends Module {
  constructor() {
    super({
      id: 2,
      name: 'Section 2',
      navLabel: 'Section 2',
      navOrder: 2,
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
      <div class="s2-status" data-s2-status role="status">
        Loading Section 2…
      </div>
    `;
  }

  /**
   * Async package bootstrap: CSS + HTML + assets + submodules.
   * Called by Module.mount when present.
   */
  async load() {
    if (!this.element || this._loaded) return;

    const status = this.element.querySelector('[data-s2-status]');

    try {
      const cssUrl = resolveAsset('./section2.css', import.meta.url);
      const htmlUrl = resolveAsset('./content.html', import.meta.url);

      await loadStylesheet(cssUrl, 'module-css-section2');
      const html = await fetchText(htmlUrl);

      this.element.innerHTML = html;
      this.element.classList.add('s2-ready');

      // Point images at package assets (paths relative to page won't work for injected HTML)
      bindAssets(this.element, import.meta.url);

      // Wire extra JS submodule
      const counterRoot = this.element.querySelector('[data-s2-counter]');
      if (counterRoot instanceof HTMLElement) {
        this._counter = initCounter(counterRoot);
      }

      this._loaded = true;
    } catch (err) {
      console.error('[Section2]', err);
      if (status) {
        status.classList.add('s2-status--error');
        status.textContent =
          'Could not load Section 2 package. Serve the app over HTTP so content.html and CSS can be fetched.';
      } else if (this.element) {
        this.element.innerHTML = `
          <div class="s2-status s2-status--error" role="alert">
            Could not load Section 2 package.
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
