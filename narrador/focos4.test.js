import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargarAmpliadoNode, fusionarAmpliado } from './contenidoAmpliado.js';
import { contenido } from './index.js';
import { tieneAlias } from './focos.js';
import { normalizar } from './comprension.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const F = amp.focos;

test('U1: t32 cargado: carta_suelta e isla_lago existen y se detectan por alias', () => {
  for (const id of ['carta_suelta', 'isla_lago']) {
    assert.ok(F.defs[id], id);
    const a = F.defs[id].alias[0];
    assert.ok(tieneAlias(normalizar(`Ves ${a} a lo lejos.`), normalizar(a)), id);
  }
  assert.ok(Object.keys(F.defs).length >= 61);
});

test('U1: id de foco repetido entre tandas falla la carga', () => {
  const t = { tanda: 'tx', estado: 'a_aprobar', focos: { carta_suelta: { alias: ['x'], clase: 'objeto' } } };
  assert.throws(() => fusionarAmpliado([['t30.json', t], ['t32.json', t]], contenido, { cargarPendientes: true }), /foco repetido/);
});

test('U1: el manifest incluye t31 y t32', () => {
  const m = fs.readFileSync(new URL('../data/contenido/ampliado/manifest.json', import.meta.url), 'utf8');
  assert.match(m, /t31-preguntar\.json/);
  assert.match(m, /t32-focos2\.json/);
});

test('U1: t31 cargado en focos.preguntar', () => {
  assert.ok(F.preguntar.serel_panadero?.animal?.length >= 2);
});
