import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandir, variantesDe, aplicarGenero } from './gramatica.js';
import { crearRng } from './azar.js';
import { leerArchivosAmpliado, fusionarAmpliado } from './contenidoAmpliado.js';
import { leerContenido } from './cargarContenido.js';

const sim = { 'luz.noche.lluvia': ['A'], 'luz.noche': ['B'], 'luz.lluvia': ['C'], luz: ['D'], frase: ['hay #luz# y #luz#'], ciclo: ['#ciclo#'] };

test('gramatica: orden de resolución', () => {
  assert.deepEqual(variantesDe('luz', sim, { f: 'noche', cl: 'lluvia' }), ['A']);
  assert.deepEqual(variantesDe('luz', sim, { f: 'noche', cl: 'niebla' }), ['B']);
  assert.deepEqual(variantesDe('luz', sim, { f: 'tarde', cl: 'lluvia' }), ['C']);
  assert.deepEqual(variantesDe('luz', sim, { f: 'tarde' }), ['D']);
  assert.deepEqual(variantesDe('x', { 'x.noche': ['n'], 'x.tarde': ['t'] }, {}), ['n', 't']);
});

test('gramatica: recursión', () => {
  assert.equal(expandir('#frase#.', sim, { rng: crearRng(1), hechos: { f: 'noche', cl: 'lluvia' } }), 'hay A y A.');
});

test('gramatica: tope de profundidad y símbolo faltante no rompen', () => {
  const avisos = [];
  assert.equal(expandir('a #ciclo# b', sim, { rng: crearRng(1), avisos }), 'a b');
  assert.ok(avisos.some((a) => a.tipo === 'gramatica_tope'));
  const av2 = [];
  assert.equal(expandir('a #nada#.', sim, { rng: crearRng(1), avisos: av2 }), 'a.');
  assert.equal(av2[0].simbolo, 'nada');
});

test('gramatica: misma semilla, mismo texto', () => {
  const s = { x: ['1', '2', '3', '4', '5'] };
  assert.equal(expandir('#x##x##x#', s, { rng: crearRng(9) }), expandir('#x##x##x#', s, { rng: crearRng(9) }));
});

test('gramatica: género con y sin dato', () => {
  const genero = { npcs: { a: 'f' }, objetos: { o: ['la', 'una'] } };
  assert.equal(aplicarGenero('{npc.el} y {objeto.un}', { npcId: 'a', objetoId: 'o', genero }), 'la y una');
  assert.equal(aplicarGenero('{npc.el} {objeto.de}', { npcId: 'z', objetoId: 'z', genero }), 'el del');
});

test('gramatica: t01 y t15 expanden sin avisos; 500 expansiones sin "#"', async () => {
  const v3 = await leerContenido();
  const amp = fusionarAmpliado(await leerArchivosAmpliado(), v3, { cargarPendientes: true, incluirCanon: true });
  const avisos = [];
  const rng = crearRng(3);
  const SUF = new Set(['madrugada', 'manana', 'tarde', 'noche', 'despejado', 'nublado', 'lluvia', 'niebla', 'alta', 'baja']);
  const base = (k) => { const p = k.split('.'); while (p.length > 1 && SUF.has(p.at(-1))) p.pop(); return p.join('.'); };
  const claves = Object.keys(amp.simbolos).map(base);
  const hechosPosibles = [{ f: 'noche', cl: 'lluvia', ts: 'alta' }, { f: 'manana', cl: 'despejado', ts: 'baja' }, { f: 'madrugada' }, {}];
  for (let i = 0; i < 500; i++) {
    const k = claves[i % claves.length];
    const t = expandir(`#${k}#`, amp.simbolos, { rng, hechos: hechosPosibles[i % 4], avisos });
    assert.ok(!t.includes('#'), t);
  }
  for (const k of claves) expandir(`#${k}#`, amp.simbolos, { rng, hechos: {}, avisos });
  assert.deepEqual(avisos, []);
});
