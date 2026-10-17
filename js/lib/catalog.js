/**
 * Tema → unidad → documento.
 * The notes stay in lab/. This catalog is the library index.
 */

export const course = {
  id: 'economia-2',
  title: 'Economía II',
  field: 'Macroeconomía',
  summary:
    'Notas para estudiar la medición del producto, la demanda y la oferta agregadas, el dinero y la inflación, y la economía abierta.',
};

/** @type {Record<string, string>} */
export const kindLabel = {
  teoria: 'Teoría',
  repaso: 'Repaso',
  ejercicio: 'Ejercicio',
};

export const units = [
  {
    id: 'se0',
    number: '0',
    title: 'Medición de la actividad económica',
    summary:
      'Flujo circular, las tres formas de medir el PBI, la diferencia entre nominal y real, y los límites del producto como medida de bienestar.',
    docs: [
      {
        id: 'ex1',
        path: 'lab/Economia2_se0_id_ex1.md',
        title: 'Flujo circular y producto bruto',
        kind: 'repaso',
        summary:
          'Seis preguntas sobre el circuito, el PBI, sus formas de medición y lo que el producto no captura.',
      },
      {
        id: 'ex2',
        path: 'lab/Economia2_se0_id_ex2.md',
        title: 'PBI, inflación y desarrollo',
        kind: 'ejercicio',
        summary:
          'Casos sobre producción interna, precios corrientes y la diferencia entre crecimiento y desarrollo.',
      },
    ],
  },
  {
    id: 'se1',
    number: '1',
    title: 'Demanda agregada y oferta agregada',
    summary:
      'La curva de demanda, los shocks de oferta y de demanda, y el papel de la política fiscal y monetaria.',
    docs: [
      {
        id: 'teoria',
        path: 'lab/Economia2_DemandaAgregada.md',
        title: 'La demanda agregada',
        kind: 'teoria',
        summary:
          'Componentes, pendiente de la curva, desplazamientos y uso en la política económica.',
      },
      {
        id: 'ex1',
        path: 'lab/Economia2_se1_id_ex1.md',
        title: 'Capítulos 33 y 34',
        kind: 'repaso',
        summary:
          'Oferta y demanda agregadas, fases del ciclo y política de estabilización.',
      },
      {
        id: 'ex2',
        path: 'lab/Economia2_se1_id_ex2.md',
        title: 'Shocks y actividad',
        kind: 'ejercicio',
        summary:
          'Por qué cae la demanda, oferta de corto y de largo plazo, y dos shocks al mismo tiempo.',
      },
    ],
  },
  {
    id: 'se3',
    number: '3',
    title: 'Dinero, inflación y desempleo',
    summary:
      'Sistema monetario, creación de dinero, teoría cuantitativa y la curva de Phillips.',
    docs: [
      {
        id: 'ex1',
        path: 'lab/Economia2_se3_id_ex1.md',
        title: 'Capítulos 29, 30 y 35',
        kind: 'repaso',
        summary:
          'Funciones del dinero, multiplicador bancario, costos de la inflación y tasa natural de desempleo.',
      },
      {
        id: 'ex2',
        path: 'lab/Economia2_se3_id_ex2.md',
        title: 'Dinero, bancos e inflación',
        kind: 'ejercicio',
        summary:
          'Tres actividades: funciones del dinero, reserva fraccionaria y teoría cuantitativa.',
      },
    ],
  },
  {
    id: 'se4',
    number: '4',
    title: 'Economía abierta',
    summary:
      'Comercio, cuenta corriente, tipo de cambio real, balanza de pagos y regímenes cambiarios.',
    docs: [
      {
        id: 'ex1',
        path: 'lab/Economia2_se4_id_ex1.md',
        title: 'Apertura, comercio y tipo de cambio',
        kind: 'repaso',
        summary:
          'Economía abierta, balanza comercial, ahorro e inversión, tipo de cambio nominal y real.',
      },
      {
        id: 'ex2',
        path: 'lab/Economia2_se4_id_ex2.md',
        title: 'Capítulos 44 y 47',
        kind: 'repaso',
        summary:
          'Restricción externa, competitividad, balanza de pagos y tipo de cambio fijo o flexible.',
      },
      {
        id: 'ex3',
        path: 'lab/Economia2_se4_id_ex3.md',
        title: 'Balanza, tipo de cambio y competitividad',
        kind: 'ejercicio',
        summary:
          'La cuenta corriente en un ejemplo, la trampa del dólar nominal y un caso de tasas.',
      },
    ],
  },
];

/**
 * @returns {{ unit: (typeof units)[number], doc: (typeof units)[number]['docs'][number] }[]}
 */
export function sequence() {
  const list = [];
  for (const unit of units) {
    for (const doc of unit.docs) list.push({ unit, doc });
  }
  return list;
}

export function docCount() {
  return sequence().length;
}

/**
 * @param {string} unitId
 */
export function findUnit(unitId) {
  return units.find((unit) => unit.id === unitId) || null;
}

/**
 * @param {string} unitId
 * @param {string} docId
 */
export function findEntry(unitId, docId) {
  const unit = findUnit(unitId);
  if (!unit) return null;
  const doc = unit.docs.find((item) => item.id === docId);
  if (!doc) return null;
  return { unit, doc };
}

/**
 * @param {string} unitId
 * @param {string} docId
 */
export function docKey(unitId, docId) {
  return `${unitId}/${docId}`;
}

/**
 * @param {string} unitId
 * @param {string} docId
 */
export function neighbors(unitId, docId) {
  const list = sequence();
  const index = list.findIndex((item) => item.unit.id === unitId && item.doc.id === docId);
  if (index === -1) return { prev: null, next: null, index: -1, total: list.length };
  return {
    prev: index > 0 ? list[index - 1] : null,
    next: index < list.length - 1 ? list[index + 1] : null,
    index,
    total: list.length,
  };
}
