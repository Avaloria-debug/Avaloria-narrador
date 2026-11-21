import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar } from '../index.js';
import { cargarAmpliadoNode } from '../contenidoAmpliado.js';
import { totalBronce, PRECIOS } from './monedas.js';
import { trabajo } from './trabajos.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
const en = (escenaId, semilla = 4) => { const e = crearPartida({ semilla }); return { ...e, jugador: { ...e.jugador, escenaId } }; };
async function decir(e, ...frases) { const out = []; for (const f of frases) { const r = await narrar(e, { tipo: 'texto', texto: f }, op); out.push(r); e = r.estado; } return out; }

test('ciclo completo con Brenn: oferta, aceptar, pasos, jornal en rango y reloj avanzado', async () => {
  const e = en('escena_camino_norte');
  const rs = await decir(e, 'busco trabajo', 'sí, acepto', 'sigo', 'sigo', 'sigo');
  assert.equal(rs[0].estado.ext.sistema.id, 'trabajo');
  const fin = rs.find((r) => !r.estado.ext.sistema && r !== rs[0]);
  assert.ok(fin, 'el trabajo termina');
  const ganado = totalBronce(fin.estado.jugador) - totalBronce(e.jugador);
  const [min, max] = PRECIOS.jornal.mulas_brenn;
  assert.ok(ganado >= Math.round(min * 0.6) && ganado <= max, String(ganado));
  assert.ok(fin.estado.reloj.hora > e.reloj.hora || fin.estado.reloj.dia > e.reloj.dia);
  assert.match(fin.texto, /de (bronce|plata)/);
});
test('un trabajo por NPC por día', async () => {
  let e = en('escena_lago_espejos');
  const rs = await decir(e, '¿tenés trabajo?', 'dale', 'sigo', 'sigo', 'sigo');
  e = rs.at(-1).estado;
  if (e.ext.sistema) e = (await decir(e, 'sigo')).at(-1).estado;
  const [r] = await decir(e, 'busco trabajo');
  assert.ok(!r.estado.ext.sistema);
});
test('abandonar a mitad: sin paga y baja la relación', async () => {
  const e = en('escena_archivo_real');
  const rs = await decir(e, 'busco trabajo', 'acepto', 'me voy');
  const r = rs.at(-1);
  assert.ok(!r.estado.ext.sistema);
  assert.equal(totalBronce(r.estado.jugador), totalBronce(e.jugador));
  assert.equal(r.estado.npcs.maren_archivista.relacion, Math.max(-2, e.npcs.maren_archivista.relacion - 1));
});
test('rechazar la oferta: nada cambia; sin trabajo en la escena: aviso', async () => {
  const e = en('escena_camino_norte');
  const rs = await decir(e, 'busco trabajo', 'no');
  assert.equal(totalBronce(rs[1].estado.jugador), totalBronce(e.jugador)); assert.ok(!rs[1].estado.ext.sistema);
  const [m] = await decir(crearPartida({ semilla: 4 }), 'busco trabajo');
  assert.ok(!m.estado.ext?.sistema);
});
test('módulo: contratiempo paga menos (determinista por semilla)', () => {
  let bajo = 0;
  for (let s = 0; s < 40; s++) {
    let sub = trabajo.iniciar(null, { trabajo: 'mulas_brenn', npc: 'brenn_arriero', escena: 'x', dia: 1, semillaBase: s });
    let r = trabajo.turno(sub, { texto: 'si' }, null, {});
    while (!r.terminado) r = trabajo.turno(r.sub, { texto: 'sigo' }, null, {});
    if (r.sub.contratiempo) { bajo++; assert.ok(r.sub.jornal <= Math.round(300 * 0.6)); }
    assert.ok(r.sub.jornal >= 0 && Number.isFinite(r.sub.jornal));
  }
  assert.ok(bajo > 0);
});
