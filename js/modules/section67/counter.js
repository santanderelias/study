/**
 * Section 67 submodule — local interactive counter.
 * Only used inside the section67 package.
 */

/**
 * @param {HTMLElement} root  Element with [data-s67-counter]
 * @returns {{ destroy: () => void }}
 */
export function initCounter(root) {
  const valueEl = root.querySelector('[data-s67-counter-value]');
  const incBtn = root.querySelector('[data-s67-counter-inc]');
  const decBtn = root.querySelector('[data-s67-counter-dec]');
  const resetBtn = root.querySelector('[data-s67-counter-reset]');

  let value = 0;

  const render = () => {
    if (valueEl) valueEl.textContent = String(value);
  };

  const onInc = () => {
    value += 1;
    render();
  };
  const onDec = () => {
    value -= 1;
    render();
  };
  const onReset = () => {
    value = 0;
    render();
  };

  incBtn?.addEventListener('click', onInc);
  decBtn?.addEventListener('click', onDec);
  resetBtn?.addEventListener('click', onReset);
  render();

  return {
    destroy() {
      incBtn?.removeEventListener('click', onInc);
      decBtn?.removeEventListener('click', onDec);
      resetBtn?.removeEventListener('click', onReset);
    },
  };
}
