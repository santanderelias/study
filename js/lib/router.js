/**
 * Hash routes for the library.
 *   #/                     tema (inicio)
 *   #/unidad/:id           unidad
 *   #/doc/:unit/:doc       documento
 *   #/buscar?q=            búsqueda
 *   #/ajustes              ajustes
 */

/**
 * @param {string} [hash]
 * @returns {{ name: 'home' | 'unit' | 'doc' | 'search' | 'settings', unitId?: string, docId?: string, q?: string }}
 */
export function parseRoute(hash = typeof location !== 'undefined' ? location.hash : '') {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryPart || '');

  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'ajustes') return { name: 'settings' };
  if (parts[0] === 'buscar') return { name: 'search', q: (query.get('q') || '').trim() };
  if (parts[0] === 'unidad' && parts[1]) return { name: 'unit', unitId: parts[1] };
  if (parts[0] === 'doc' && parts[1] && parts[2]) {
    return { name: 'doc', unitId: parts[1], docId: parts[2] };
  }
  return { name: 'home' };
}

/**
 * @param {string} unitId
 */
export function unitHref(unitId) {
  return `#/unidad/${encodeURIComponent(unitId)}`;
}

/**
 * @param {string} unitId
 * @param {string} docId
 */
export function docHref(unitId, docId) {
  return `#/doc/${encodeURIComponent(unitId)}/${encodeURIComponent(docId)}`;
}

/**
 * @param {string} q
 */
export function searchHref(q) {
  return `#/buscar?q=${encodeURIComponent(q)}`;
}
