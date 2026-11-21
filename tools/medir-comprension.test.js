import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { juzgar, medir } from './medir-comprension.mjs';

const corpus = JSON.parse(fs.readFileSync(new URL('../data/pruebas/corpus-comprension.json', import.meta.url), 'utf8'));

test('corpus: ≥500 casos, frases únicas, categorías pedidas', () => {
  assert.ok(corpus.casos.length >= 500);
  assert.equal(new Set(corpus.casos.map((c) => c.frase)).size, corpus.casos.length);
  const cats = new Set(corpus.casos.map((c) => c.cat));
  for (const c of ['verbos', 'conjugacion', 'encliticos', 'tipeos', 'referencias', 'npcs', 'escenas', 'ambiguas', 'sin_sentido', 'varias', 'negacion', 'modo', 'sinonimos']) assert.ok(cats.has(c), c);
});
test('juzgar: ok, no y mal', () => {
  assert.equal(juzgar({ accion: 'mirar', objetivo: 'x' }, { accion: 'mirar', objetivo: 'x' }), 'ok');
  assert.equal(juzgar({ accion: 'mirar', objetivo: 'x' }, { accion: 'no_entendido' }), 'no');
  assert.equal(juzgar({ accion: 'mirar', objetivo: 'x' }, { accion: 'aclarar' }), 'no');
  assert.equal(juzgar({ accion: 'mirar', objetivo: 'x' }, { accion: 'mirar', objetivo: 'y' }), 'mal');
  assert.equal(juzgar({ accion: 'no_entendido' }, { accion: 'seguir', objetivo: 'y' }), 'mal');
  assert.equal(juzgar({ accion: 'aclarar', opciones: ['a', 'b'] }, { accion: 'aclarar', opciones: ['b', 'a'] }), 'ok');
  assert.equal(juzgar({ accion: 'tomar', luego: { accion: 'mirar' } }, { accion: 'tomar', luego: { accion: 'tocar' } }), 'mal');
});
test('medición determinista', async () => {
  const a = await medir(); const b = await medir();
  assert.equal(a.pct, b.pct); assert.deepEqual(a.estados, b.estados);
});
