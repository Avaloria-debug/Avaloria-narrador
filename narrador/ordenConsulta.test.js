// El _2 nunca se revela antes que el _1, tampoco por consulta de tema (0.0.43, ver SUPUESTOS-v3).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { anteriorSinRevelar, MOTIVOS_NO_REVELA } from './conocimientos.js';
import { completar } from './narracion.js';

const SEREL = 'serel_panadero';
const HARINA = 'conocimiento_serel_1';
const HORNOS = 'conocimiento_serel_2';
const serel = contenido.npcs.find((n) => n.id === SEREL);
const FALLO = contenido.plantillas.revelar_conocimiento.fallo.map((p) => completar(p, { npc: serel.nombre }));
const EXITO_HORNOS = contenido.plantillas.revelar_conocimiento.exito.map((p) => completar(p, { npc: serel.nombre, conocimiento: serel.conocimientos[1].contenido }));
const conSerel = (cambios) => {
  const e = crearPartida({ semilla: 11 });
  return { ...e, npcs: { ...e.npcs, [SEREL]: { ...e.npcs[SEREL], ...cambios } } };
};
const decir = (estado, texto) => narrar(estado, { tipo: 'texto', texto });
const PREGUNTA = '¿sabés algo de los hornos del alba?';

describe('orden _1 antes que _2 en la consulta', () => {
  test('con relación para el _2 (25) y el _1 sin revelar: fallo, no revela nada', async () => {
    for (const relacion of [25, 29, 100]) {
      const r = await decir(conSerel({ relacion }), PREGUNTA);
      assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, [], `relación ${relacion}`);
      assert.ok(FALLO.includes(r.texto), `relación ${relacion}: ${r.texto}`);
    }
  });

  test('con el _1 revelado, la misma consulta revela el _2', async () => {
    const r = await decir(conSerel({ relacion: 25, conocimientosRevelados: [HARINA] }), PREGUNTA);
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, [HARINA, HORNOS]);
    assert.ok(EXITO_HORNOS.includes(r.texto), r.texto);
  });

  test('anteriorSinRevelar en cada NPC: el _1 nunca, el _2 solo con el _1 pendiente', () => {
    assert.equal(MOTIVOS_NO_REVELA.ORDEN, 'orden');
    for (const npc of contenido.npcs) {
      const [k1, k2] = npc.conocimientos ?? [];
      if (!k1) continue;
      assert.equal(anteriorSinRevelar(npc, { conocimientosRevelados: [] }, k1), false, npc.id);
      if (!k2) continue;
      assert.equal(anteriorSinRevelar(npc, { conocimientosRevelados: [] }, k2), true, npc.id);
      assert.equal(anteriorSinRevelar(npc, { conocimientosRevelados: [k1.id] }, k2), false, npc.id);
    }
  });
});
