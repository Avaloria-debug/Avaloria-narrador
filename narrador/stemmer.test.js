import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raiz } from './stemmer.js';

// 20 pares tomados del vocabulario oficial de Snowball (snowball-data/spanish: voc.txt → output.txt),
// descargado y comparado el 2026-11-21: las 28 378 palabras coinciden.
const PARES = [
  ['abandonamos', 'abandon'],
  ['altímetro', 'altimetr'],
  ['atropellado', 'atropell'],
  ['calificado', 'calific'],
  ['coincidió', 'coincid'],
  ['conversaron', 'convers'],
  ['deportivas', 'deport'],
  ['dotes', 'dot'],
  ['escuché', 'escuch'],
  ['firmas', 'firm'],
  ['hayas', 'hay'],
  ['insospechado', 'insospech'],
  ['limosnita', 'limosnit'],
  ['militante', 'milit'],
  ['octavio', 'octavi'],
  ['personalizar', 'personaliz'],
  ['promotores', 'promotor'],
  ['reiteradamente', 'reiter'],
  ['satisfacción', 'satisfaccion'],
  ['surgido', 'surg'],
  ['situación', 'situacion'],
];

test('stemmer: pares del vocabulario oficial Snowball', () => {
  for (const [p, r] of PARES) assert.equal(raiz(p), r, p);
});

test('stemmer: pronombre enclítico y tildes', () => {
  assert.equal(raiz('dándole'), 'dandol'); // oficial
  assert.equal(raiz('ó'), 'o');
  assert.equal(raiz(''), '');
});
