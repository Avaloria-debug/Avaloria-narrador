// X1 (fase 8): prioridad de narración código → Groq → IA local → plantilla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido, TIPOS_SALIDA } from './index.js';

const FRASE = 'opino que la lluvia viene del lago';
const LOCAL = '«Del lago viene todo, hasta los rumores», dice Serel.';
const GROQ = '«Puede ser, quién sabe», dice Serel.';
const T0 = Date.parse('2026-11-21T12:00:00Z');
const local = (r, listo = true) => { const l = { llamadas: [], listo: () => listo, async pedir(o) { l.llamadas.push(o); return typeof r === 'function' ? r() : r; } }; return l; };
const httpOk = (txt = GROQ) => { const f = async () => { f.n++; return { status: 200, json: async () => ({ choices: [{ message: { content: txt } }] }) }; }; f.n = 0; return f; };
const http429 = (retry) => { const f = async () => { f.n++; return { status: 429, headers: retry ? { 'retry-after': String(retry) } : {}, json: async () => ({ error: { message: 'rate limit per minute' } }) }; }; f.n = 0; return f; };
const httpCae = () => { const f = async () => { f.n++; throw new Error('red'); }; f.n = 0; return f; };
const esperar = async () => {};
async function dos(op, estado = crearPartida({ semilla: 7 }), frase = FRASE) {
  const a = await narrar(estado, { tipo: 'texto', texto: frase }, op);
  return narrar(a.estado, { tipo: 'texto', texto: frase }, op);
}
const esPlantilla = (t) => contenido.plantillas.reformulacion.no_entendido.includes(t);
const sinAvisos = (t) => assert.ok(!/token|cupo|groq|429|límite|api/i.test(t), t);

test('código entiende → ni Groq ni local', async () => {
  const l = local({ ok: true, texto: LOCAL }); const h = httpOk();
  await narrar(crearPartida({ semilla: 7 }), { tipo: 'texto', texto: 'miro alrededor' }, { groqKey: 'k', http: h, iaLocal: l });
  assert.equal(h.n, 0); assert.equal(l.llamadas.length, 0);
});
test('Groq ok → no local', async () => {
  const l = local({ ok: true, texto: LOCAL }); const h = httpOk();
  const r = await dos({ groqKey: 'k', http: h, iaLocal: l, esperar });
  assert.equal(r.tipo, TIPOS_SALIDA.DIALOGO_IA); assert.equal(l.llamadas.length, 0); assert.ok(h.n >= 1);
});
test('Groq falla (red) → local, sin clave en el pedido local', async () => {
  const l = local({ ok: true, texto: LOCAL });
  const r = await dos({ groqKey: 'gsk_x', http: httpCae(), iaLocal: l, esperar });
  assert.equal(r.tipo, TIPOS_SALIDA.DIALOGO_IA); assert.ok(r.texto.includes(LOCAL));
  assert.ok(!JSON.stringify(l.llamadas).includes('gsk_x'));
});
test('Groq falla y local no lista → plantilla', async () => {
  const r = await dos({ groqKey: 'k', http: httpCae(), iaLocal: local({ ok: true, texto: LOCAL }, false), esperar });
  assert.ok(esPlantilla(r.texto));
});
test('sin clave → local', async () => {
  const r = await dos({ iaLocal: local({ ok: true, texto: LOCAL }) });
  assert.equal(r.tipo, TIPOS_SALIDA.DIALOGO_IA);
});
test('ambas fallan → plantilla', async () => {
  const r = await dos({ groqKey: 'k', http: httpCae(), iaLocal: local({ ok: false, motivo: 'local_error' }), esperar });
  assert.ok(esPlantilla(r.texto));
});
test('eco rechazado en Groq → local', async () => {
  const l = local({ ok: true, texto: LOCAL });
  const r = await dos({ groqKey: 'k', http: httpOk('ver {npc} [x]'), iaLocal: l, esperar });
  assert.equal(l.llamadas.length, 1); assert.ok(r.texto.includes(LOCAL));
});
test('429 → local sin aviso; en la espera no se llama a Groq; pasada vuelve', async () => {
  const l = local({ ok: true, texto: LOCAL }); const h = http429(60);
  const r = await dos({ groqKey: 'k', http: h, iaLocal: l, esperar, ahora: () => T0 });
  assert.ok(r.texto.includes(LOCAL)); sinAvisos(r.texto);
  const n = h.n;
  const r2 = await dos({ groqKey: 'k', http: h, iaLocal: l, esperar, ahora: () => T0 + 30_000 }, r.estado, 'opino que el puente es viejo');
  assert.equal(h.n, n); sinAvisos(r2.texto);
  const h2 = httpOk();
  const r3 = await dos({ groqKey: 'k', http: h2, iaLocal: l, esperar, ahora: () => T0 + 120_000 }, r2.estado, 'opino que el río suena raro');
  assert.ok(h2.n >= 1); assert.equal(r3.tipo, TIPOS_SALIDA.DIALOGO_IA);
});
test('429 sin retry-after → pausa de 10 min', async () => {
  const l = local({ ok: true, texto: LOCAL }); const h = http429();
  const r = await dos({ groqKey: 'k', http: h, iaLocal: l, esperar, ahora: () => T0 });
  const n = h.n;
  await dos({ groqKey: 'k', http: h, iaLocal: l, esperar, ahora: () => T0 + 9 * 60_000 }, r.estado, 'opino que el puente es viejo');
  assert.equal(h.n, n);
});
