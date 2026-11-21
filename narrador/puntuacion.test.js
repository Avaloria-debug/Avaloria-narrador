// Sin "..": el punto de la plantilla no se agrega si el valor ya cierra con puntuación final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sinPuntoDoble, CIERRA_CON_PUNTUACION } from './puntuacion.js';
import { completar } from './narracion.js';
import { completarMarcadores } from './casos/narrar.js';
import { contenido } from './index.js';

const ejemplos = JSON.parse(fs.readFileSync(new URL('./ejemplosPuntoDoble.json', import.meta.url), 'utf8')).textos;
const EXITO = contenido.plantillas.revelar_conocimiento.exito;
const conocimientos = contenido.npcs.flatMap((n) => (n.conocimientos ?? []).map((k) => ({ npc: n, k })));

test('sinPuntoDoble: punto, suspensivos, ? y !, con cierre de comillas o paréntesis', () => {
  for (const v of ['hola.', 'hola…', '¿hola?', '¡hola!', '«hola.»', '(hola.)', 'dijo "hola."']) assert.equal(sinPuntoDoble(v, '.'), v, v);
  assert.equal(sinPuntoDoble('hola', '.'), 'hola.');
  assert.equal(sinPuntoDoble('hola.', ''), 'hola.');
  assert.ok(CIERRA_CON_PUNTUACION.test('fin.'));
});

test(`los ${ejemplos.length} textos con ".." de los lotes del simulador ya no se producen`, () => {
  assert.equal(ejemplos.length, 18);
  for (const viejo of ejemplos) {
    assert.ok(viejo.includes('..'));
    // Rearma el tramo de revelado con la plantilla y el conocimiento que nombra.
    const { npc, k } = conocimientos.find(({ k: x }) => viejo.includes(x.contenido));
    const plantilla = EXITO.find((p) => viejo.includes(p.split('{npc}')[1].split('{conocimiento}')[0]));
    const nuevo = completar(plantilla, { npc: npc.nombre, conocimiento: k.contenido });
    assert.ok(!nuevo.includes('..'), nuevo);
    assert.ok(viejo.includes(nuevo + '.'), `${viejo} / ${nuevo}`);
  }
});

test('ninguna respuesta de revelado de los conocimientos reales termina en ".."', () => {
  const plantillas = Object.values(contenido.plantillas.revelar_conocimiento).flat();
  let n = 0;
  for (const { npc, k } of conocimientos) {
    for (const p of plantillas) {
      const t = completar(p, { npc: npc.nombre, conocimiento: k.contenido });
      if (t === null) continue;
      n += 1;
      assert.ok(!/\.\.$/.test(t) && !t.includes('..'), t);
      assert.match(t, /[.!?…]["»”’')\]]*$/, t);
    }
  }
  assert.ok(n >= conocimientos.length * 2);
});

test('textos de hito: {conocimiento:pN}. sin punto doble con un _2 que termina en punto', () => {
  const npc = contenido.npcs.find((n) => n.id === 'serel_panadero');
  const k2 = npc.conocimientos[1];
  assert.match(k2.contenido, /\.$/);
  const estado = { instancia: { pistas: [{ ranura: 'p2', conocimientoId: k2.id, npcId: npc.id }] } };
  const t = completarMarcadores('Te enterás: {conocimiento:p2}. Y {npc:p2} se va.', estado, contenido);
  assert.equal(t, `Te enterás: ${k2.contenido} Y ${npc.nombre} se va.`);
});
