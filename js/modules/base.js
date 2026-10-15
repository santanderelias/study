/**
 * Base module interface.
 * Subclasses implement render() and optionally override show/hide/load.
 *
 * Submodule packages can implement async load() to fetch external
 * HTML/CSS/assets after the shell is mounted.
 */

export class Module {
  /**
   * @param {{
   *   id: number,
   *   name: string,
   *   navLabel?: string | null,
   *   navOrder?: number
   * }} options
   */
  constructor({ id, name, navLabel = null, navOrder = id }) {
    this.id = id;
    this.name = name;
    this.navLabel = navLabel;
    this.navOrder = navOrder;
    /** @type {HTMLElement | null} */
    this.element = null;
    this.isVisible = false;
  }

  /**
   * Create the module DOM and append to parent.
   * If the subclass defines load(), it runs after the shell is in the document.
   * @param {HTMLElement} parent
   * @returns {Promise<HTMLElement>}
   */
  async mount(parent) {
    this.element = document.createElement('section');
    this.element.id = `module-${this.id}`;
    this.element.setAttribute('aria-label', this.name);
    this.element.innerHTML = this.render();
    parent.appendChild(this.element);

    if (typeof this.load === 'function') {
      await this.load();
    }

    this.afterMount();
    return this.element;
  }

  /**
   * @returns {string} Initial HTML (placeholder or full markup)
   */
  render() {
    return `<div class="page-header"><h1>${this.name}</h1></div>`;
  }

  /**
   * Optional async bootstrap for submodule packages (HTML/CSS/assets).
   * Override in package modules; default is a no-op.
   * @returns {Promise<void>}
   */
  async load() {}

  /** Hook after DOM is in the document (and load() finished) */
  afterMount() {}

  show() {
    this.isVisible = true;
  }

  hide() {
    this.isVisible = false;
  }
}
