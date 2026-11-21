import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';
import { opcionesDeTurno, sugerencias, fraseDe, TEXTOS_SUGERENCIA } from './sugerencias.js';
import { leerAccion, contextoLectura } from './lectura.js';
import { crearRng } from './azar.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
async function conFocos(ids, extra = {}) {
  const r = await narrar(crearPartida({ semilla: 1 }), { tipo: 'texto', texto: 'observar' }, op);
  const e = structuredClone(r.estado);
  e.ext.focos = ids.map((id) => ({ id, visto: e.ext.turno, escena: e.jugador.escenaId, pasos: {}, agotado: false, ...extra }));
  return e;
}

test('opciones: focos activos con verbos de sus ramas, NPC presentes y salidas', async () => {
  const e = await conFocos(['gata_mercado']);
  const o = opcionesDeTurno(e, { amp, contenido });
  const gata = o.find((x) => x.id === 'gata_mercado');
  assert.ok(gata.verbos.some((v) => v.frase === 'seguir a la gata'));
  assert.ok(o.some((x) => x.tipo === 'npc' && x.verbos[0].frase === 'hablar con Serel'));
  assert.ok(o.some((x) => x.tipo === 'salida'));
});
test('nunca sugiere un foco no activo (agotado, vencido u otra escena)', async () => {
  for (const extra of [{ agotado: true }, { visto: -50 }, { escena: 'escena_lago_espejos' }]) {
    const e = await conFocos(['gata_mercado'], extra);
    assert.ok(!opcionesDeTurno(e, { amp, contenido }).some((x) => x.id === 'gata_mercado'), JSON.stringify(extra));
  }
});
test('cada frase sugerida la entiende la lectura', async () => {
  const e = await conFocos(['gata_mercado', 'moneda_suelo', 'campana_lejana']);
  const ctx = contextoLectura({ focos: amp.focos.defs, npcs: contenido.npcs, escenas: contenido.escenas, presentes: ['serel_panadero'] });
  for (const o of opcionesDeTurno(e, { amp, contenido })) for (const v of o.verbos) {
    const l = leerAccion(v.frase, ctx);
    assert.ok(!['no_entendido'].includes(l.accion), `${v.frase} → ${JSON.stringify(l)}`);
  }
});
test('sugerencias: 2–3, sin repetir la terna seguida si hay alternativas, plantilla prov', async () => {
  const e = await conFocos(['gata_mercado', 'moneda_suelo', 'campana_lejana']);
  const o = opcionesDeTurno(e, { amp, contenido });
  const rng = crearRng(9);
  let ant = null;
  for (let i = 0; i < 20; i++) {
    const s = sugerencias(o, rng, { anterior: ant });
    assert.ok(s.frases.length >= 2 && s.frases.length <= 3);
    assert.notEqual(s.clave, ant);
    assert.ok(s.texto.startsWith('Podrías '));
    ant = s.clave;
  }
  assert.ok(TEXTOS_SUGERENCIA.prov);
});
test('juego: algo sin sentido → texto base + «Podrías …» con ≥1 acción válida', async () => {
  const e = await conFocos(['gata_mercado']);
  const r = await narrar(e, { tipo: 'texto', texto: 'asdf qwer' }, op);
  assert.match(r.texto, /Podrías .+\./);
  const o = opcionesDeTurno(e, { amp, contenido }).flatMap((x) => x.verbos.map((v) => v.frase));
  assert.ok(o.some((f) => r.texto.includes(f)), r.texto);
});
test('sin ampliado: sin sugerencias', async () => {
  const r = await narrar(crearPartida({ semilla: 1 }), { tipo: 'texto', texto: 'asdf qwer' });
  assert.ok(!r.texto.includes('Podrías'));
});
test('fraseDe: artículos y «a»', () => {
  assert.equal(fraseDe('seguir', 'perro', { animado: true }), 'seguir al perro');
  assert.equal(fraseDe('mirar', 'lámpara'), 'mirar la lámpara');
});
