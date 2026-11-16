// Barrido de comprensión por relación (tabla en barridoComprension.js). Cada caso dice qué frase probó,
// qué esperaba y qué obtuvo. Los casos que no dan lo esperado no se arreglan acá: están marcados como
// pendientes (test.skip con motivo, en pendientesComprension.json) y listados en docs/PENDIENTES.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { armarCasos, correrCaso } from './barridoComprension.js';

const PENDIENTES = JSON.parse(await readFile(new URL('./pendientesComprension.json', import.meta.url), 'utf8'));
const casos = armarCasos();

test('la tabla cubre Maren y Serel con relación 0, 39, 40 y 50 y no repite casos', () => {
  assert.equal(new Set(casos.map((c) => c.id)).size, casos.length);
  for (const npc of ['maren_archivista', 'serel_panadero']) {
    for (const relacion of [0, 39, 40, 50]) assert.ok(casos.some((c) => c.npc === npc && c.relacion === relacion), `${npc} ${relacion}`);
  }
  assert.ok(casos.some((c) => c.frases.length === 2));
});

test('todo pendiente corresponde a un caso de la tabla', () => {
  const ids = new Set(casos.map((c) => c.id));
  for (const id of Object.keys(PENDIENTES)) assert.ok(ids.has(id), `pendiente sin caso: ${id}`);
});

for (const caso of casos) {
  const nombre = caso.id;
  if (PENDIENTES[caso.id]) {
    test.skip(`${nombre} [pendiente: ${PENDIENTES[caso.id]}]`, () => {});
    continue;
  }
  test(nombre, async () => {
    const { obtenido, textos } = await correrCaso(caso);
    assert.deepEqual(
      obtenido,
      caso.esperado,
      `frase: "${caso.frases.join('" > "')}" | relación ${caso.relacion} | esperaba: ${caso.esperado.join(' > ')} | obtuvo: ${obtenido.join(' > ')} (${textos.join(' // ')})`,
    );
  });
}
