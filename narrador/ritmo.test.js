import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hechosDe } from './seleccion.js';
import { fraseAmpliada, contexto, extInicial, PROB_SILENCIO } from './ampliado.js';
import { crearPartida, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const estado = (ext) => ({ ...crearPartida({ semilla: 1 }), ext });

test('ritmo: corto con tensión alta o repetición; largo con calma y visitas', () => {
  assert.equal(hechosDe(estado({ tension: 8 }), { contenido }).ritmo, 'corto');
  assert.equal(hechosDe(estado({ repeticion: { verbo: 'x', n: 3 } }), { contenido }).ritmo, 'corto');
  const e = estado({ visitas: { escena_mercado_circular: 4 } });
  assert.equal(hechosDe(e, { contenido }).ritmo, 'largo');
  assert.equal(hechosDe(estado({}), { contenido }).ritmo, undefined);
});

const turno = (verbo, npcId = null) => ({ tipo: 'accion', accion: { verbo, intencionId: `intencion_${verbo}`, resultado: 'exito', parametros: npcId ? { npcId } : {}, efectos: [] } });
const correr = (t, ext, s) => {
  const despues = estado({});
  const e = { ...extInicial({}, s), ...ext, turno: 1 };
  return fraseAmpliada({ amp, contenido, turno: t, ctx: contexto({ amp, contenido, despues, turno: t, ext: e }), aperturas: [] });
};

test('ritmo: con ritmo corto se eligen las variantes breves', () => {
  const cortas = new Set(amp.silencio.corto.intencion_observar.map((x) => x.t ?? x));
  for (let s = 0; s < 10; s++) assert.ok(cortas.has(correr(turno('observar'), { tension: 8 }, s).texto));
});

test('ritmo: el silencio queda acotado y es determinista', () => {
  const gestos = new Set();
  let n = 0;
  for (let s = 0; s < 300; s++) {
    const r = correr(turno('hablar_con', 'serel_panadero'), { tension: 8 }, s);
    if (r && /no dice nada|Se limita/.test(r.texto)) { n++; gestos.add(r.texto); }
  }
  assert.ok(n > 0 && n < 300 * PROB_SILENCIO * 2.5, String(n));
  assert.deepEqual(correr(turno('observar'), { tension: 8 }, 7), correr(turno('observar'), { tension: 8 }, 7));
});
