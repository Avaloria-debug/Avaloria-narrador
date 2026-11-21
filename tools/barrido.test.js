import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barrer } from './barrido.mjs';

// B: el bot registra lo visto/oído y falla si la fila o las sugerencias nombran algo no visto; también coherencia,
// eco/vacío y respuestas de NPC.
test('barrido (4 escenas × 60 turnos): sin hallazgos', async () => {
  const r = await barrer({ turnos: 60, semilla: 3, escenas: ['escena_mercado_circular', 'escena_archivo_real', 'escena_camino_sur', 'escena_lago_espejos'] });
  assert.deepEqual(r.conteo, {}, JSON.stringify(r.hallazgos.slice(0, 5)));
});
