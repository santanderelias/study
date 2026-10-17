/**
 * Turns lab notes into study HTML.
 * Outline files (no Markdown headings) are promoted to headings first.
 * Leaf sections become recall cards; parent headings stay as groups.
 */

const TOKEN = '\uE000';

/**
 * @param {string} value
 */
export function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} raw
 */
export function prepareMarkdown(raw) {
  const text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[ \t]+$/gm, '')
    .trim();
  if (/(^|\n)#{1,6} /.test(text)) return `${demoteTopHeading(text)}\n`;
  return `${outlineToMarkdown(text)}\n`;
}

/**
 * @param {string} markdown
 * @returns {{ html: string, headings: { id: string, level: number, text: string }[], cardCount: number }}
 */
export function renderStudyHtml(markdown) {
  const blocks = parseBlocks(markdown);
  const rendered = renderPieces(blocks, 0, 0);
  return {
    html: `<div class="prose">${rendered.html}</div>`,
    headings: rendered.headings,
    cardCount: rendered.cardCount,
  };
}

/**
 * @param {string} markdown
 */
export function plainText(markdown) {
  return markdown
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/(^|\n)#{1,6} /g, ' ')
    .replace(/[*_`>#\[\]()]/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Replace formula nodes with KaTeX when it is available.
 * @param {ParentNode} root
 */
export function hydrateMath(root) {
  const katex = typeof window !== 'undefined' ? window.katex : null;
  root.querySelectorAll('.math, .math-display').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const tex = el.textContent || '';
    const display = el.classList.contains('math-display');
    if (katex) {
      try {
        katex.render(tex, el, {
          throwOnError: false,
          displayMode: display,
          strict: 'ignore',
        });
        return;
      } catch {
        /* fall through */
      }
    }
    el.textContent = texToPlain(tex);
    el.classList.add('math-fallback');
  });
}

/**
 * @param {string} text
 */
function demoteTopHeading(text) {
  const hasH1 = text.split('\n').some((line) => /^# /.test(line));
  if (!hasH1) return text;
  return text
    .split('\n')
    .map((line) => (/^#{1,5} /.test(line) ? `#${line}` : line))
    .join('\n');
}

/**
 * @param {string} text
 */
function outlineToMarkdown(text) {
  const lines = text.split('\n');
  /** @type {string[]} */
  const out = [];
  let i = 0;
  let previousWasList = false;

  const breakList = () => {
    if (previousWasList) out.push('');
    previousWasList = false;
  };

  while (i < lines.length) {
    if (!lines[i].trim()) {
      breakList();
      i += 1;
      continue;
    }

    const consumed = consumeWrapped(lines, i);
    i = consumed.next;
    const body = consumed.text.trim();
    if (!body) continue;

    if (isHeadingStart(body) && consumed.indent <= 6) {
      breakList();
      const level = headingLevel(body);
      out.push(`${'#'.repeat(level)} ${body}`);
      out.push('');
      continue;
    }

    if (/^[▪•]\s+/.test(body) || /^[-*]\s+/.test(body)) {
      const item = body.replace(/^[▪•]\s+/, '').replace(/^[-*]\s+/, '');
      out.push(`- ${formatLead(item)}`);
      previousWasList = true;
      continue;
    }

    if (isBareFormula(body)) {
      breakList();
      out.push(`$$${body}$$`);
      out.push('');
      continue;
    }

    breakList();
    out.push(formatLead(body));
    out.push('');
  }

  return out.join('\n').trim();
}

/**
 * Join a line with lowercase wraps. Stops before the next heading.
 * @param {string[]} lines
 * @param {number} index
 */
function consumeWrapped(lines, index) {
  const indent = (lines[index].match(/^ */) || [''])[0].length;
  let text = lines[index].trim();
  let j = index + 1;

  while (j < lines.length) {
    if (!lines[j].trim()) break;
    const nextIndent = (lines[j].match(/^ */) || [''])[0].length;
    const next = lines[j].trim();
    if (isHeadingStart(next) && nextIndent <= indent + 2) break;
    if (/^[▪•]\s+/.test(next) || /^[-*]\s+/.test(next)) break;
    const continues = /^[a-záéíóúñü(]/.test(next);
    if (!continues) break;
    text += ` ${next}`;
    j += 1;
  }

  return { text, next: j, indent };
}

/**
 * @param {string} text
 */
function isHeadingStart(text) {
  return /^(Capítulo\s+\d+\b|\d+\.\s+|[a-z]\)\s*\S)/i.test(text);
}

/**
 * @param {string} text
 */
function headingLevel(text) {
  if (/^Capítulo\s+\d+/i.test(text)) return 2;
  if (/^\d+\.\s+/.test(text)) return 2;
  return 3;
}

/**
 * @param {string} text
 */
function isBareFormula(text) {
  return /^[A-Z][A-Za-z0-9]*\s*=\s*\S/.test(text) && text.length < 100 && !/[.!?]$/.test(text);
}

/**
 * Bold a short label before a colon: "Consumo (C): …"
 * @param {string} text
 */
function formatLead(text) {
  const only = text.match(/^([^:]{2,72}):\s*$/);
  if (only && !/https?/i.test(only[1])) return `**${only[1].trim()}:**`;
  const lead = text.match(/^([^:]{2,72}):\s+(\S[\s\S]*)$/);
  if (lead && !/https?/i.test(lead[1]) && !lead[1].includes('?')) {
    return `**${lead[1].trim()}:** ${lead[2].trim()}`;
  }
  return text;
}

/**
 * @typedef {{ type: 'h', level: number, text: string, plain: string, id: string }
 *  | { type: 'p', html: string }
 *  | { type: 'ul', items: string[] }
 *  | { type: 'ol', items: string[] }
 *  | { type: 'math', tex: string }
 *  | { type: 'quote', html: string }
 *  | { type: 'pre', text: string }
 *  | { type: 'hr' }} Block
 */

/**
 * @param {string} markdown
 * @returns {Block[]}
 */
function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  /** @type {Block[]} */
  const blocks = [];
  /** @type {Map<string, number>} */
  const slugs = new Map();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'pre', text: buf.join('\n') });
      continue;
    }

    if (trimmed === '$$') {
      const buf = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '$$') {
        buf.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'math', tex: buf.join('\n').trim() });
      continue;
    }

    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      blocks.push({ type: 'math', tex: trimmed.slice(2, -2).trim() });
      i += 1;
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const plain = headingPlain(heading[2]);
      const id = uniqueSlug(plain || 'seccion', slugs);
      blocks.push({ type: 'h', level, text: heading[2], plain, id });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', html: inline(buf.join(' ')) });
      continue;
    }

    const ul = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      /** @type {string[]} */
      const items = [];
      while (i < lines.length && /^(\s*)[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items: items.map((item) => inline(item)) });
      continue;
    }

    const ol = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      /** @type {string[]} */
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items: items.map((item) => inline(item)) });
      continue;
    }

    const buf = [trimmed];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      buf.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'p', html: inline(buf.join(' ')) });
  }

  return blocks;
}

/**
 * @param {string} line
 */
function isBlockStart(line) {
  const trimmed = line.trim();
  return (
    /^(#{2,4})\s+/.test(trimmed) ||
    trimmed.startsWith('```') ||
    trimmed.startsWith('$$') ||
    trimmed.startsWith('>') ||
    /^(\s*)[-*+]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^(-{3,}|\*{3,})$/.test(trimmed)
  );
}

/**
 * @param {string} text
 * @param {Map<string, number>} slugs
 */
function uniqueSlug(text, slugs) {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'seccion';
  const seen = slugs.get(base) || 0;
  slugs.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

/**
 * @param {string} text
 */
function headingPlain(text) {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} raw
 */
function inline(raw) {
  const { text, tokens } = extractInlineMath(raw);
  return formatInline(text, tokens);
}

/**
 * @param {string} raw
 */
function extractInlineMath(raw) {
  /** @type {string[]} */
  const tokens = [];
  let out = '';
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '$' && raw[i + 1] !== '$') {
      const close = raw.indexOf('$', i + 1);
      if (close !== -1) {
        const inner = raw.slice(i + 1, close);
        if (isInlineMath(inner)) {
          const id = `M${tokens.length}`;
          tokens.push(inner);
          out += `${TOKEN}${id}${TOKEN}`;
          i = close + 1;
          continue;
        }
      }
    }
    out += raw[i];
    i += 1;
  }
  return { text: out, tokens };
}

/**
 * Currency such as $3.000 is left as text. Formulas are captured.
 * @param {string} inner
 */
function isInlineMath(inner) {
  if (!inner || inner.length > 180 || /\n/.test(inner)) return false;
  if (/^\d[\d.,]*$/.test(inner)) return false;
  if (/^\d/.test(inner) && !/[\\^=_]/.test(inner)) return false;
  return /[\\^=_+]|[A-Za-z]/.test(inner);
}

/**
 * @param {string} text
 * @param {string[]} tokens
 */
function formatInline(text, tokens) {
  let html = '';
  let i = 0;

  // Highlight textbook / citation references e.g. (Mankiw, Cap. 31) or Mankiw, Cap. 31
  const bibMatch = /^(\((?:Mankiw|Blanchard|De Gregorio)[^)]+\)|(?:Mankiw|Blanchard|De Gregorio),\s*Cap\.?\s*\d+)/i.exec(text);
  if (bibMatch) {
    const citation = bibMatch[1];
    return `<cite class="bib-chip">${escapeHtml(citation)}</cite>` + formatInline(text.slice(citation.length), tokens);
  }

  while (i < text.length) {
    if (text.startsWith(TOKEN, i)) {
      const end = text.indexOf(TOKEN, i + 1);
      if (end !== -1) {
        const id = text.slice(i + TOKEN.length, end);
        const index = Number(id.slice(1));
        html += `<span class="math">${escapeHtml(tokens[index] || '')}</span>`;
        i = end + TOKEN.length;
        continue;
      }
    }
    if (text.startsWith('**', i) || text.startsWith('__', i)) {
      const mark = text.slice(i, i + 2);
      const end = text.indexOf(mark, i + 2);
      if (end !== -1) {
        html += `<strong>${formatInline(text.slice(i + 2, end), tokens)}</strong>`;
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '*' || text[i] === '_') {
      const mark = text[i];
      const end = text.indexOf(mark, i + 1);
      if (end > i + 1) {
        html += `<em>${formatInline(text.slice(i + 1, end), tokens)}</em>`;
        i = end + 1;
        continue;
      }
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        html += `<code>${escapeHtml(text.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }
    if (text[i] === '[') {
      const match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
      if (match) {
        const href = match[2];
        const safe = /^(https?:|mailto:|#)/.test(href) ? href : '#';
        html += `<a href="${escapeHtml(safe)}">${formatInline(match[1], tokens)}</a>`;
        i += match[0].length;
        continue;
      }
    }
    const next = nextSpecial(text, i);
    html += escapeHtml(text.slice(i, next));
    i = next;
  }
  return html;
}

/**
 * @param {string} text
 * @param {number} from
 */
function nextSpecial(text, from) {
  const specials = ['**', '__', '*', '_', '`', '[', TOKEN];
  let at = text.length;
  for (const mark of specials) {
    const found = text.indexOf(mark, from);
    if (found !== -1 && found < at) at = found;
  }
  return at === from ? from + 1 : at;
}

/**
 * @param {Block[]} blocks
 * @param {number} index
 * @param {number} parentLevel
 */
function renderPieces(blocks, index, parentLevel) {
  let html = '';
  /** @type {{ id: string, level: number, text: string }[]} */
  const headings = [];
  let cardCount = 0;
  let i = index;

  while (i < blocks.length) {
    const block = blocks[i];
    if (block.type === 'h') {
      if (parentLevel && block.level <= parentLevel) break;
      const group = hasChildHeading(blocks, i);
      headings.push({ id: block.id, level: block.level, text: block.plain });
      i += 1;
      let body = '';
      while (i < blocks.length) {
        const next = blocks[i];
        if (next.type === 'h' && next.level <= block.level) break;
        if (next.type === 'h') {
          const nested = renderPieces(blocks, i, block.level);
          body += nested.html;
          headings.push(...nested.headings);
          cardCount += nested.cardCount;
          i = nested.index;
          continue;
        }
        body += renderLeaf(next);
        i += 1;
      }
      const isChapter = /^Capítulo\s+\d+/i.test(block.plain);
      const chapterClass = isChapter ? ' piece--chapter' : '';
      const chapterBadge = isChapter ? `<span class="chapter-badge">Bibliografía de Estudio</span>` : '';

      if (group) {
        html += `<section class="piece${chapterClass}" data-piece="group" aria-labelledby="${block.id}">
          ${chapterBadge}
          <h${block.level} class="piece__title" id="${block.id}">${inline(block.text)}</h${block.level}>
          <div class="piece__body">${body}</div>
        </section>`;
      } else {
        cardCount += 1;
        const question = /[?¿]/.test(block.plain);
        const show = question ? 'Ver respuesta' : 'Mostrar';
        html += `<section class="piece${chapterClass}" data-piece="card">
          <div class="piece__bar">
            ${chapterBadge}
            <h${block.level} class="piece__title" id="${block.id}">${inline(block.text)}</h${block.level}>
            <button type="button" class="btn btn--secondary btn--sm piece__toggle" data-action="toggle-answer" data-label="${show}" aria-expanded="false" aria-controls="answer-${block.id}">${show}</button>
          </div>
          <div class="piece__answer" id="answer-${block.id}" hidden>${body || '<p class="muted-answer">Sin desarrollo en la nota.</p>'}</div>
        </section>`;
      }
      continue;
    }

    html += renderLeaf(block);
    i += 1;
  }

  return { html, headings, cardCount, index: i };
}

/**
 * @param {Block[]} blocks
 * @param {number} index
 */
function hasChildHeading(blocks, index) {
  const level = blocks[index].type === 'h' ? blocks[index].level : 0;
  for (let i = index + 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.type !== 'h') continue;
    if (block.level <= level) return false;
    return true;
  }
  return false;
}

/**
 * @param {Block} block
 */
function renderLeaf(block) {
  if (block.type === 'p') return `<p>${block.html}</p>`;
  if (block.type === 'ul') return `<ul>${block.items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
  if (block.type === 'ol') return `<ol>${block.items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
  if (block.type === 'math') return `<div class="math-display">${escapeHtml(block.tex)}</div>`;
  if (block.type === 'quote') return `<blockquote>${block.html}</blockquote>`;
  if (block.type === 'pre') return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
  if (block.type === 'hr') return '<hr />';
  return '';
}

/**
 * @param {string} tex
 */
function texToPlain(tex) {
  return tex
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1) / ($2)')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\\$/g, '$')
    .replace(/\\ /g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\^/g, '')
    .replace(/[_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
