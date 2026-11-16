// Barrido de comprensión por relación (tabla en barridoComprension.js). Cada caso dice qué frase probó,
// qué esperaba y qué obtuvo. Un caso que no coincide con el diseño queda rojo: no se salta ni se ajusta
// al código. El detalle de los que fallan está en docs/PENDIENTES.md ("Diagnóstico de comprensión").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarCasos, correrCaso } from './barridoComprension.js';

const casos = armarCasos();

test('la tabla cubre Maren y Serel con relación 0, 39, 40 y 50 y no repite casos', () => {
  assert.equal(new Set(casos.map((c) => c.id)).size, casos.length);
  for (const npc of ['maren_archivista', 'serel_panadero']) {
    for (const relacion of [0, 39, 40, 50]) assert.ok(casos.some((c) => c.npc === npc && c.relacion === relacion), `${npc} ${relacion}`);
  }
  assert.ok(casos.some((c) => c.frases.length === 2));
});

for (const caso of casos) {
  test(caso.id, async () => {
    const { obtenido, textos } = await correrCaso(caso);
    assert.deepEqual(
      obtenido,
      caso.esperado,
      `frase: "${caso.frases.join('" > "')}" | relación ${caso.relacion} | esperaba: ${caso.esperado.join(' > ')} | obtuvo: ${obtenido.join(' > ')} (${textos.join(' // ')})`,
    );
  });
}
