import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerContenido } from '../cargarContenido.js';
import { validarCasos } from './validador.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const RUTA_CASOS = fileURLToPath(new URL('../../data/contenido/casos.json', import.meta.url));

test('los casos de data/contenido/casos.json pasan el validador', async () => {
  const contenido = await leerContenido();
  const { casos } = JSON.parse(await readFile(RUTA_CASOS, 'utf8'));
  assert.deepEqual(validarCasos(casos, contenido), []);
});

test('h5 y h6 (reparación sobre p1) van en dos escenas distintas, en la ruta de cada dueño posible de p1', async () => {
  const contenido = await leerContenido();
  const { casos } = JSON.parse(await readFile(RUTA_CASOS, 'utf8'));
  for (const caso of casos) {
    const [h5, h6] = ['h5', 'h6'].map((id) => caso.hitos.find((h) => h.id === id));
    assert.notEqual(h5.escena_entrega, h6.escena_entrega, caso.id);
    const p1 = caso.ranuras_pista.find((r) => r.id === 'p1');
    for (const k of p1.conocimientos_validos) {
      const npc = contenido.npcs.find((n) => n.conocimientos.some((c) => c.id === k));
      const ruta = new Set([npc.escenaInicialId, ...(npc.movimiento?.caminos ?? [])]);
      for (const h of [h5, h6]) assert.ok(ruta.has(h.escena_entrega), `${caso.id} ${h.id}: ${npc.id} no pasa por ${h.escena_entrega}`);
      for (const r of caso.ranuras_pista.filter((x) => x.id !== 'p1')) {
        for (const o of r.conocimientos_validos) {
          assert.ok(!npc.conocimientos.some((c) => c.id === o), `${caso.id}: ${npc.id} repetido en ${r.id}`);
        }
      }
    }
  }
});
