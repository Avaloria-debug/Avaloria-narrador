// Fase 5 (R4): IA local enganchada en narrar() cuando no hay clave de Groq.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido, TIPOS_SALIDA } from './index.js';

const FRASE = 'opino que la lluvia viene del lago';
const LINEA = '«Del lago viene todo, hasta los rumores», dice Serel.';
async function dos(opciones) {
  const a = await narrar(crearPartida({ semilla: 7 }), { tipo: 'texto', texto: FRASE }, opciones);
  return narrar(a.estado, { tipo: 'texto', texto: FRASE }, opciones);
}
const local = (r, listo = true) => { const l = { llamadas: [], listo: () => listo, async pedir(o) { l.llamadas.push(o); return typeof r === 'function' ? r() : r; } }; return l; };

test('sin iaLocal: igual que antes (plantilla y sin_clave)', async () => {
  const a = await dos({});
  const b = await dos({ iaLocal: undefined });
  assert.deepEqual(b.texto, a.texto);
  assert.deepEqual(b.errores, a.errores);
  assert.ok(contenido.plantillas.reformulacion.no_entendido.includes(a.texto));
});
test('iaLocal lista con respuesta válida → dialogo_ia', async () => {
  const l = local({ ok: true, texto: LINEA });
  const r = await dos({ iaLocal: l });
  assert.equal(r.tipo, TIPOS_SALIDA.DIALOGO_IA);
  assert.equal(r.texto.startsWith(LINEA) || r.texto.includes(LINEA), true);
  assert.equal(l.llamadas.length, 1);
  assert.ok(l.llamadas[0].contexto.frase.includes('lluvia'));
});
test('iaLocal nunca recibe la clave ni se usa con clave', async () => {
  const l = local({ ok: true, texto: LINEA });
  const http = async () => ({ status: 200, json: async () => ({ choices: [{ message: { content: '«Puede ser», dice Serel.' } }] }) });
  const r = await dos({ iaLocal: l, groqKey: 'gsk_secreta', http });
  assert.equal(l.llamadas.length, 0);
  assert.equal(r.tipo, TIPOS_SALIDA.DIALOGO_IA);
  assert.ok(!JSON.stringify(l.llamadas).includes('gsk_secreta'));
});
test('falla local → plantilla y error anotado', async () => {
  const r = await dos({ iaLocal: local({ ok: false, error: null, motivo: 'local_tiempo', texto: null }) });
  assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
  assert.ok(contenido.plantillas.reformulacion.no_entendido.includes(r.texto));
  assert.ok(r.errores.some((e) => e.includes('local_tiempo')));
});
test('excepción local → plantilla', async () => {
  const r = await dos({ iaLocal: local(() => { throw new Error('gpu'); }) });
  assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
});
test('salida inválida aunque diga ok → plantilla', async () => {
  const r = await dos({ iaLocal: local({ ok: true, texto: 'ver {npc} [x]' }) });
  assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
});
test('iaLocal no lista → igual que sin iaLocal', async () => {
  const l = local({ ok: true, texto: LINEA }, false);
  const a = await dos({});
  const r = await dos({ iaLocal: l });
  assert.equal(l.llamadas.length, 0);
  assert.equal(r.texto, a.texto);
});
