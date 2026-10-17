/**
 * Biblioteca de estudio — tema, unidad, documento.
 * Module 0. Settings stays module 99.
 */

import { Module } from '../base.js';
import {
  course,
  docCount,
  docKey,
  findEntry,
  findUnit,
  kindLabel,
  neighbors,
  sequence,
  units,
} from '../../lib/catalog.js';
import { hydrateMath, plainText, prepareMarkdown, renderStudyHtml } from '../../lib/markdown.js';
import {
  getLast,
  getMode,
  isStudied,
  setLast,
  setMode,
  studiedCount,
  toggleStudied,
} from '../../lib/progress.js';
import { docHref, parseRoute, searchHref, unitHref } from '../../lib/router.js';

export class LibraryModule extends Module {
  /**
   * @param {import('../../orchestrator.js').orchestrator} orchestrator
   */
  constructor(orchestrator) {
    super({
      id: 0,
      name: 'Inicio',
      navLabel: 'Inicio',
      navOrder: 0,
    });
    this.orchestrator = orchestrator;
    /** @type {Map<string, { html: string, headings: {id: string, level: number, text: string}[], cardCount: number, plain: string, minutes: number }>} */
    this.cache = new Map();
    this._seq = 0;
    /** @type {IntersectionObserver | null} */
    this._spy = null;
    /** @type {MediaQueryList | null} */
    this._mq = null;
    /** @type {((event: MediaQueryListEvent) => void) | null} */
    this._mqSync = null;
  }

  render() {
    return `
      <div class="readbar" data-readbar hidden>
        <span data-readbar-fill></span>
      </div>
      <div class="lib-view" data-lib-view>
        <p class="lib-status" role="status">Cargando la biblioteca…</p>
      </div>
    `;
  }

  start() {
    if (!this.element) return;
    this.element.addEventListener('click', (event) => this.onClick(event));
    this.element.addEventListener('submit', (event) => this.onSubmit(event));
    window.addEventListener('hashchange', () => {
      this.go();
    });
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    this.go();
  }

  async go() {
    const seq = ++this._seq;
    const route = parseRoute();
    if (!location.hash) history.replaceState(null, '', '#/');

    if (route.name === 'settings') {
      this.cleanup();
      this.orchestrator.show(99);
      document.title = 'Ajustes · Estudio';
      return;
    }

    this.orchestrator.show(0);
    const view = this.element?.querySelector('[data-lib-view]');
    if (!view) return;

    this.cleanup();
    view.setAttribute('aria-busy', 'true');

    try {
      const html = await this.renderRoute(route);
      if (seq !== this._seq) return;
      view.innerHTML = html;
      hydrateMath(view);
      view.removeAttribute('aria-busy');
      this.afterRender(route, view);
    } catch (err) {
      console.error(err);
      if (seq !== this._seq) return;
      view.innerHTML = renderLoadError();
      view.removeAttribute('aria-busy');
    }
  }

  /**
   * @param {ReturnType<typeof parseRoute>} route
   */
  async renderRoute(route) {
    if (route.name === 'unit') return this.renderUnit(route.unitId || '');
    if (route.name === 'doc') return this.renderDoc(route.unitId || '', route.docId || '');
    if (route.name === 'search') return this.renderSearch(route.q || '');
    return this.renderHome();
  }

  renderHome() {
    const total = docCount();
    const keys = sequence().map((item) => docKey(item.unit.id, item.doc.id));
    const done = studiedCount(keys);
    const last = resolveLast();

    const continueBlock = last
      ? `<a class="continue" href="${docHref(last.unit.id, last.doc.id)}">
          <span>
            <span class="continue__kicker">Continuar</span>
            <span class="continue__title">${esc(last.doc.title)}</span>
            <span class="continue__meta">${esc(kindLabel[last.doc.kind])} · Unidad ${esc(last.unit.number)} · ${esc(last.unit.title)}</span>
          </span>
          <span class="continue__go" aria-hidden="true">Seguir</span>
        </a>`
      : '';

    const cards = units
      .map((unit) => {
        const unitKeys = unit.docs.map((doc) => docKey(unit.id, doc.id));
        const unitDone = studiedCount(unitKeys);
        return `<a class="unit-card" href="${unitHref(unit.id)}">
          <span class="unit-card__num" aria-hidden="true">${esc(unit.number)}</span>
          <span class="unit-card__body">
            <span class="kicker">Unidad</span>
            <span class="unit-card__title">${esc(unit.title)}</span>
            <span class="unit-card__sum">${esc(unit.summary)}</span>
            <span class="unit-card__meta" data-unit-label="${esc(unit.id)}">${unitDone} de ${unit.docs.length} estudiadas</span>
            <span class="meter" data-unit-meter="${esc(unit.id)}" role="presentation"><span style="width:${pct(unitDone, unit.docs.length)}%"></span></span>
          </span>
        </a>`;
      })
      .join('');

    return `
      <header class="lib-mast">
        <p class="kicker">Tema</p>
        <h1>${esc(course.title)}</h1>
        <p class="lede">${esc(course.summary)}</p>
      </header>
      <form class="lib-search" role="search" data-search-form>
        <label class="sr-only" for="home-q">Buscar en las notas</label>
        <input id="home-q" type="search" name="q" placeholder="Buscar en las notas" autocomplete="off" enterkeyhint="search" />
        <button type="submit" class="btn btn--primary">Buscar</button>
      </form>
      <div class="course-progress">
        <div class="meter meter--lg" data-course-meter role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="Notas estudiadas">
          <span style="width:${pct(done, total)}%"></span>
        </div>
        <p data-progress-label>${progressCopy(done, total)}</p>
      </div>
      ${continueBlock}
      <h2 class="lib-section-label">Unidades</h2>
      <div class="unit-grid">${cards}</div>
      <footer class="module-footer">${esc(course.title)} · ${total} documentos</footer>
    `;
  }

  /**
   * @param {string} unitId
   */
  renderUnit(unitId) {
    const unit = findUnit(unitId);
    if (!unit) return renderMissing('Esa unidad no está en el temario.');

    const rows = unit.docs
      .map((doc, index) => {
        const key = docKey(unit.id, doc.id);
        const studied = isStudied(key);
        return `<li class="doc-row ${studied ? 'is-studied' : ''}">
          <a class="doc-row__link" href="${docHref(unit.id, doc.id)}">
            <span class="doc-row__index">${String(index + 1).padStart(2, '0')}</span>
            <span class="doc-row__text">
              <span class="badge badge--${esc(doc.kind)}">${esc(kindLabel[doc.kind])}</span>
              <span class="doc-row__title">${esc(doc.title)}</span>
              <span class="doc-row__sum">${esc(doc.summary)}</span>
            </span>
          </a>
          ${markButton(key, doc.title, studied)}
        </li>`;
      })
      .join('');

    const done = studiedCount(unit.docs.map((doc) => docKey(unit.id, doc.id)));

    return `
      ${crumb([
        { href: '#/', label: course.title },
        { label: `Unidad ${unit.number}` },
      ])}
      <header class="lib-mast">
        <p class="kicker">Unidad ${esc(unit.number)}</p>
        <h1>${esc(unit.title)}</h1>
        <p class="lede">${esc(unit.summary)}</p>
      </header>
      <p class="unit-count" data-unit-label="${esc(unit.id)}">${done} de ${unit.docs.length} estudiadas</p>
      <ol class="doc-list">${rows}</ol>
    `;
  }

  /**
   * @param {string} unitId
   * @param {string} docId
   */
  async renderDoc(unitId, docId) {
    const entry = findEntry(unitId, docId);
    if (!entry) return renderMissing('Esa nota no está en la biblioteca.');

    const { unit, doc } = entry;
    const loaded = await this.ensure(doc);
    const key = docKey(unit.id, doc.id);
    setLast(key);
    const studied = isStudied(key);
    const mode = effectiveMode(doc.kind);
    const around = neighbors(unit.id, doc.id);
    const toc = loaded.headings.filter((heading) => heading.level === 2 || heading.level === 3);

    const tocLinks = toc
      .map(
        (heading) => `<a class="lib-toc__link" href="${docHref(unit.id, doc.id)}" data-action="toc" data-target="${esc(heading.id)}" data-level="${heading.level}">${esc(heading.text)}</a>`
      )
      .join('');

    const tocBlock = toc.length
      ? `<details class="lib-toc">
          <summary>En esta nota</summary>
          <nav aria-label="En esta nota">${tocLinks}</nav>
        </details>`
      : '';

    return `
      ${crumb([
        { href: '#/', label: course.title },
        { href: unitHref(unit.id), label: `Unidad ${unit.number}` },
        { label: doc.title },
      ])}
      <div class="lib-reader">
        ${tocBlock}
        <article class="lib-article">
          <header class="reader-head ${studied ? 'is-studied' : ''}">
            <p class="reader-kicker">
              <span class="badge badge--${esc(doc.kind)}">${esc(kindLabel[doc.kind])}</span>
              <span>Unidad ${esc(unit.number)}</span>
              <span>${loaded.minutes} min</span>
              <span>${loaded.cardCount} ${loaded.cardCount === 1 ? 'parte' : 'partes'}</span>
            </p>
            <h1>${esc(doc.title)}</h1>
            <p class="reader-sum">${esc(doc.summary)}</p>
            <div class="reader-tools">
              <div class="seg" role="group" aria-label="Modo de estudio">
                <button type="button" data-action="mode" data-mode="repaso" aria-pressed="${mode === 'repaso'}">Repaso</button>
                <button type="button" data-action="mode" data-mode="lectura" aria-pressed="${mode === 'lectura'}">Lectura</button>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" data-action="show-all" ${mode === 'lectura' ? 'hidden' : ''}>Mostrar todas</button>
              <button type="button" class="btn btn--ghost btn--sm" data-action="hide-all" ${mode === 'lectura' ? 'hidden' : ''}>Ocultar todas</button>
              ${markButton(key, doc.title, studied, true)}
            </div>
            <p class="mode-note">${modeNote(doc.kind)}</p>
          </header>
          <div class="reader-body ${mode === 'lectura' ? 'is-reading' : ''}" data-mode="${mode}">
            ${loaded.html}
          </div>
          ${pager(around)}
        </article>
      </div>
    `;
  }

  /**
   * @param {string} query
   */
  async renderSearch(query) {
    const form = `
      <form class="lib-search" role="search" data-search-form>
        <label class="sr-only" for="search-q">Buscar en las notas</label>
        <input id="search-q" type="search" name="q" value="${esc(query)}" placeholder="Buscar en las notas" autocomplete="off" enterkeyhint="search" />
        <button type="submit" class="btn btn--primary">Buscar</button>
      </form>
    `;

    if (query.length < 2) {
      return `
        ${crumb([{ href: '#/', label: course.title }, { label: 'Buscar' }])}
        <header class="lib-mast">
          <p class="kicker">Biblioteca</p>
          <h1>Buscar</h1>
          <p class="lede">Buscá por una idea, un capítulo o una palabra. Por ejemplo: PBI, Phillips, tipo de cambio.</p>
        </header>
        ${form}
      `;
    }

    const hits = [];
    for (const { unit, doc } of sequence()) {
      const loaded = await this.ensure(doc);
      const hayTitle = fold(`${doc.title} ${doc.summary} ${unit.title}`);
      const hayBody = fold(loaded.plain);
      const terms = fold(query).split(/\s+/).filter((term) => term.length > 1);
      const blob = `${hayTitle} ${hayBody}`;
      if (!terms.every((term) => blob.includes(term))) continue;
      const inTitle = terms.every((term) => hayTitle.includes(term));
      hits.push({ unit, doc, inTitle, snippet: makeSnippet(loaded.plain, query) });
    }

    hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle));

    const list = hits.length
      ? `<ol class="search-list">${hits
          .map(
            (hit) => `<li>
              <a class="search-hit" href="${docHref(hit.unit.id, hit.doc.id)}">
                <span class="search-hit__meta">
                  <span class="badge badge--${esc(hit.doc.kind)}">${esc(kindLabel[hit.doc.kind])}</span>
                  <span>Unidad ${esc(hit.unit.number)} · ${esc(hit.unit.title)}</span>
                </span>
                <span class="search-hit__title">${esc(hit.doc.title)}</span>
                <span class="search-hit__snip">${hit.snippet}</span>
              </a>
            </li>`
          )
          .join('')}</ol>`
      : `<p class="lib-empty">Ninguna nota contiene «${esc(query)}».</p>`;

    return `
      ${crumb([{ href: '#/', label: course.title }, { label: 'Buscar' }])}
      <header class="lib-mast">
        <p class="kicker">Biblioteca</p>
        <h1>${hits.length} ${hits.length === 1 ? 'resultado' : 'resultados'}</h1>
        <p class="lede">para «${esc(query)}»</p>
      </header>
      ${form}
      ${list}
    `;
  }

  /**
   * @param {{ path: string }} doc
   */
  async ensure(doc) {
    const cached = this.cache.get(doc.path);
    if (cached) return cached;
    const response = await fetch(doc.path);
    if (!response.ok) {
      throw new Error(`No se pudo leer ${doc.path} (${response.status})`);
    }
    const raw = await response.text();
    const md = prepareMarkdown(raw);
    const rendered = renderStudyHtml(md);
    const plain = plainText(raw);
    const words = plain.split(/\s+/).filter(Boolean).length;
    const value = {
      ...rendered,
      plain,
      minutes: Math.max(1, Math.round(words / 180)),
    };
    this.cache.set(doc.path, value);
    return value;
  }

  /**
   * @param {ReturnType<typeof parseRoute>} route
   * @param {HTMLElement} view
   */
  afterRender(route, view) {
    if (route.name === 'doc' && route.unitId && route.docId) {
      const entry = findEntry(route.unitId, route.docId);
      document.title = entry ? `${entry.doc.title} · Economía II` : 'Estudio';
      const mode = entry ? effectiveMode(entry.doc.kind) : 'lectura';
      applyReadingMode(view, mode);
      this.watchToc(view);
      this.onScroll();
    } else if (route.name === 'unit') {
      const unit = findUnit(route.unitId || '');
      document.title = unit ? `${unit.title} · Economía II` : 'Estudio';
      this.hideReadbar();
    } else if (route.name === 'search') {
      document.title = 'Buscar · Estudio';
      this.hideReadbar();
      if (!route.q) view.querySelector('input[type="search"]')?.focus();
    } else {
      document.title = 'Economía II · Estudio';
      this.hideReadbar();
    }

    if (!(route.name === 'search' && !route.q)) {
      const heading = view.querySelector('h1');
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
    window.scrollTo(0, 0);
  }

  /**
   * @param {HTMLElement} view
   */
  watchToc(view) {
    const toc = view.querySelector('.lib-toc');
    if (toc instanceof HTMLDetailsElement) {
      this._mq = window.matchMedia('(min-width: 960px)');
      this._mqSync = () => {
        toc.open = this._mq?.matches ?? false;
      };
      this._mqSync();
      this._mq.addEventListener('change', this._mqSync);
    }

    const links = [...view.querySelectorAll('.lib-toc__link')];
    if (!links.length) return;
    const byId = new Map(links.map((link) => [link.getAttribute('data-target'), link]));
    this._spy = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach((link) => {
          link.classList.remove('is-active');
          link.removeAttribute('aria-current');
        });
        const current = byId.get(visible.target.id);
        current?.classList.add('is-active');
        current?.setAttribute('aria-current', 'true');
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 1] }
    );
    view.querySelectorAll('.piece__title').forEach((heading) => {
      if (byId.has(heading.id)) this._spy?.observe(heading);
    });
  }

  /**
   * @param {Event} event
   */
  onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('[data-action]');
    if (!(control instanceof HTMLElement) || !this.element?.contains(control)) return;

    const action = control.dataset.action;
    if (action === 'toc') {
      event.preventDefault();
      const id = control.dataset.target || '';
      const heading = document.getElementById(id);
      heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const toc = control.closest('.lib-toc');
      if (toc instanceof HTMLDetailsElement && window.matchMedia('(max-width: 959px)').matches) {
        toc.open = false;
      }
      return;
    }

    if (action === 'toggle-answer') {
      const card = control.closest('[data-piece="card"]');
      const answer = card?.querySelector('.piece__answer');
      if (!(answer instanceof HTMLElement)) return;
      const open = control.getAttribute('aria-expanded') === 'true';
      setAnswer(control, answer, !open);
      return;
    }

    if (action === 'show-all' || action === 'hide-all') {
      const open = action === 'show-all';
      this.element?.querySelectorAll('[data-piece="card"]').forEach((card) => {
        const toggle = card.querySelector('.piece__toggle');
        const answer = card.querySelector('.piece__answer');
        if (toggle instanceof HTMLElement && answer instanceof HTMLElement) setAnswer(toggle, answer, open);
      });
      return;
    }

    if (action === 'mode') {
      const mode = control.dataset.mode === 'lectura' ? 'lectura' : 'repaso';
      setMode(mode);
      const view = this.element?.querySelector('[data-lib-view]');
      if (view instanceof HTMLElement) applyReadingMode(view, mode);
      return;
    }

    if (action === 'studied') {
      const key = control.dataset.key || '';
      const on = toggleStudied(key);
      syncMark(control, on);
      control.closest('.doc-row, .reader-head')?.classList.toggle('is-studied', on);
      this.refreshProgress();
    }
  }

  /**
   * @param {Event} event
   */
  onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-search-form')) return;
    event.preventDefault();
    const data = new FormData(form);
    const query = String(data.get('q') || '').trim();
    location.hash = searchHref(query);
  }

  refreshProgress() {
    if (!this.element) return;
    const allKeys = sequence().map((item) => docKey(item.unit.id, item.doc.id));
    const done = studiedCount(allKeys);
    const total = allKeys.length;

    this.element.querySelectorAll('[data-progress-label]').forEach((label) => {
      label.textContent = progressCopy(done, total);
    });
    this.element.querySelectorAll('[data-course-meter]').forEach((meter) => {
      meter.setAttribute('aria-valuenow', String(done));
      const fill = meter.querySelector('span');
      if (fill instanceof HTMLElement) fill.style.width = `${pct(done, total)}%`;
    });

    for (const unit of units) {
      const keys = unit.docs.map((doc) => docKey(unit.id, doc.id));
      const unitDone = studiedCount(keys);
      this.element.querySelectorAll(`[data-unit-label="${unit.id}"]`).forEach((label) => {
        label.textContent = `${unitDone} de ${unit.docs.length} estudiadas`;
      });
      this.element.querySelectorAll(`[data-unit-meter="${unit.id}"] > span`).forEach((fill) => {
        if (fill instanceof HTMLElement) fill.style.width = `${pct(unitDone, unit.docs.length)}%`;
      });
    }
  }

  onScroll() {
    const route = parseRoute();
    const bar = this.element?.querySelector('[data-readbar]');
    const fill = this.element?.querySelector('[data-readbar-fill]');
    if (!(bar instanceof HTMLElement) || !(fill instanceof HTMLElement)) return;
    if (route.name !== 'doc') {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const amount = height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0;
    fill.style.width = `${amount * 100}%`;
  }

  hideReadbar() {
    const bar = this.element?.querySelector('[data-readbar]');
    if (bar instanceof HTMLElement) bar.hidden = true;
  }

  cleanup() {
    this._spy?.disconnect();
    this._spy = null;
    if (this._mq && this._mqSync) this._mq.removeEventListener('change', this._mqSync);
    this._mq = null;
    this._mqSync = null;
  }
}

/**
 * @param {string} kind
 */
function effectiveMode(kind) {
  const saved = getMode();
  if (saved === 'repaso' || saved === 'lectura') return saved;
  return kind === 'teoria' ? 'lectura' : 'repaso';
}

/**
 * @param {string} kind
 */
function modeNote(kind) {
  if (getMode() !== 'auto') return 'La elección queda guardada para todas las notas.';
  if (kind === 'teoria') return 'En teoría se abre en lectura. Repaso esconde cada parte hasta que la pidas.';
  return 'En repaso, la respuesta está oculta hasta que la pedís.';
}

/**
 * @param {HTMLElement} view
 * @param {'repaso' | 'lectura'} mode
 */
function applyReadingMode(view, mode) {
  const reading = mode === 'lectura';
  view.querySelectorAll('[data-mode]').forEach((node) => {
    node.setAttribute('data-mode', mode);
    node.classList.toggle('is-reading', reading);
  });
  view.querySelectorAll('[data-action="mode"]').forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  view.querySelectorAll('[data-action="show-all"], [data-action="hide-all"]').forEach((button) => {
    if (button instanceof HTMLElement) button.hidden = reading;
  });
  view.querySelectorAll('[data-piece="card"]').forEach((card) => {
    const toggle = card.querySelector('.piece__toggle');
    const answer = card.querySelector('.piece__answer');
    if (!(toggle instanceof HTMLElement) || !(answer instanceof HTMLElement)) return;
    if (reading) {
      answer.hidden = false;
      toggle.hidden = true;
    } else {
      toggle.hidden = false;
      const open = toggle.getAttribute('aria-expanded') === 'true';
      answer.hidden = !open;
    }
  });
  const note = view.querySelector('.mode-note');
  if (note) {
    note.textContent =
      getMode() === 'auto'
        ? note.textContent
        : 'La elección queda guardada para todas las notas.';
  }
}

/**
 * @param {HTMLElement} toggle
 * @param {HTMLElement} answer
 * @param {boolean} open
 */
function setAnswer(toggle, answer, open) {
  toggle.setAttribute('aria-expanded', String(open));
  answer.hidden = !open;
  const label = toggle.dataset.label || 'Mostrar';
  toggle.textContent = open ? 'Ocultar' : label;
}

/**
 * @param {HTMLElement} button
 * @param {boolean} on
 */
function syncMark(button, on) {
  button.setAttribute('aria-pressed', String(on));
  const text = button.querySelector('.mark-btn__text');
  if (text) text.textContent = on ? 'Estudiada' : button.dataset.short === '1' ? 'Estudiar' : 'Marcar como estudiada';
  const title = button.dataset.title || 'esta nota';
  button.setAttribute('aria-label', on ? `Quitar «${title}» de estudiadas` : `Marcar «${title}» como estudiada`);
}

/**
 * @param {string} key
 * @param {string} title
 * @param {boolean} studied
 * @param {boolean} [verbose]
 */
function markButton(key, title, studied, verbose = false) {
  const short = verbose ? '0' : '1';
  const text = studied ? 'Estudiada' : verbose ? 'Marcar como estudiada' : 'Estudiar';
  const label = studied ? `Quitar «${title}» de estudiadas` : `Marcar «${title}» como estudiada`;
  return `<button type="button" class="mark-btn" data-action="studied" data-key="${esc(key)}" data-title="${esc(title)}" data-short="${short}" data-label="Mostrar" aria-pressed="${studied}" aria-label="${esc(label)}">
    <span class="mark-btn__box" aria-hidden="true"></span>
    <span class="mark-btn__text">${text}</span>
  </button>`;
}

/**
 * @param {{ href?: string, label: string }[]} items
 */
function crumb(items) {
  const parts = items
    .map((item, index) => {
      const node = item.href
        ? `<a href="${item.href}">${esc(item.label)}</a>`
        : `<span aria-current="page">${esc(item.label)}</span>`;
      const sep = index > 0 ? '<span class="crumb__sep" aria-hidden="true">/</span>' : '';
      return `${sep}${node}`;
    })
    .join('');
  return `<nav class="crumb" aria-label="Tema, unidad y documento">${parts}</nav>`;
}

/**
 * @param {ReturnType<typeof neighbors>} around
 */
function pager(around) {
  const prev = around.prev
    ? `<a class="pager__link" href="${docHref(around.prev.unit.id, around.prev.doc.id)}">
        <span class="pager__dir">Anterior</span>
        <span class="pager__name">${esc(around.prev.doc.title)}</span>
        <span class="pager__unit">Unidad ${esc(around.prev.unit.number)}</span>
      </a>`
    : '<span></span>';
  const next = around.next
    ? `<a class="pager__link pager__link--next" href="${docHref(around.next.unit.id, around.next.doc.id)}">
        <span class="pager__dir">Siguiente</span>
        <span class="pager__name">${esc(around.next.doc.title)}</span>
        <span class="pager__unit">Unidad ${esc(around.next.unit.number)}</span>
      </a>`
    : '<span></span>';
  return `<nav class="pager" aria-label="Notas anterior y siguiente">
    ${prev}
    ${next}
    <p class="pager__pos">Nota ${around.index + 1} de ${around.total}</p>
  </nav>`;
}

function resolveLast() {
  const last = getLast();
  if (!last) return null;
  const [unitId, docId] = last.split('/');
  if (!unitId || !docId) return null;
  return findEntry(unitId, docId);
}

/**
 * @param {number} done
 * @param {number} total
 */
function progressCopy(done, total) {
  if (done === 0) return `Todavía no marcaste ninguna nota. Son ${total}.`;
  if (done === total) return `Las ${total} notas están marcadas como estudiadas.`;
  return `${done} de ${total} notas estudiadas.`;
}

/**
 * @param {number} done
 * @param {number} total
 */
function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

/**
 * @param {string} message
 */
function renderMissing(message) {
  return `
    <header class="lib-mast">
      <p class="kicker">Biblioteca</p>
      <h1>No está en el temario</h1>
      <p class="lede">${esc(message)}</p>
      <p><a class="btn btn--secondary" href="#/">Volver al tema</a></p>
    </header>
  `;
}

function renderLoadError() {
  return `
    <header class="lib-mast">
      <p class="kicker">Biblioteca</p>
      <h1>No se pudo abrir la nota</h1>
      <p class="lede">Las notas se leen por HTTP. Si abriste el archivo directo, serví la carpeta y entrá de nuevo.</p>
      <pre class="lib-code">python3 -m http.server 8080</pre>
      <p><a class="btn btn--secondary" href="#/">Volver al tema</a></p>
    </header>
  `;
}

/**
 * @param {string} plain
 * @param {string} query
 */
function makeSnippet(plain, query) {
  const folded = fold(plain);
  const terms = fold(query).split(/\s+/).filter((term) => term.length > 1);
  let at = folded.indexOf(fold(query));
  if (at < 0) {
    for (const term of terms) {
      const found = folded.indexOf(term);
      if (found >= 0) {
        at = found;
        break;
      }
    }
  }
  if (at < 0) at = 0;
  const start = Math.max(0, at - 48);
  const end = Math.min(plain.length, at + 140);
  const slice = `${start > 0 ? '…' : ''}${plain.slice(start, end).trim()}${end < plain.length ? '…' : ''}`;
  return highlight(slice, terms);
}

/**
 * @param {string} text
 * @param {string[]} terms
 */
function highlight(text, terms) {
  if (!terms.length) return esc(text);
  const pattern = terms.map(accentPattern).join('|');
  const re = new RegExp(pattern, 'giu');
  let html = '';
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    html += esc(text.slice(last, index));
    html += `<mark>${esc(match[0])}</mark>`;
    last = index + match[0].length;
  }
  html += esc(text.slice(last));
  return html;
}

/**
 * @param {string} term
 */
function accentPattern(term) {
  const classes = { a: '[aáàä]', e: '[eéèë]', i: '[iíìï]', o: '[oóòö]', u: '[uúùü]', n: '[nñ]' };
  return [...term]
    .map((char) => {
      const key = fold(char);
      return classes[key] || char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
}

/**
 * @param {string} value
 */
function fold(value) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * @param {string} value
 */
function esc(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
