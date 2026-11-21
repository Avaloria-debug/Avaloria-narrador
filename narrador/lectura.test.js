import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lematizar, separarEncliticos, NO_VERBOS } from './lectura.js';

const FORMAS = {
  mirar: ['mirá', 'mira', 'mire', 'mirar', 'miro', 'miré', 'mirando', 'miras', 'miraste'],
  seguir: ['seguí', 'sigue', 'siga', 'seguir', 'sigo', 'siguiendo', 'siguió'],
  tocar: ['tocá', 'toca', 'toque', 'tocar', 'toco', 'toqué', 'tocando'],
  escuchar: ['escuchá', 'escucha', 'escuche', 'escuchar', 'escucho', 'escuché', 'escuchando'],
  hablar: ['hablá', 'habla', 'hable', 'hablar', 'hablo', 'hablé', 'hablando'],
  preguntar: ['preguntá', 'pregunta', 'pregunte', 'preguntar', 'pregunto', 'pregunté', 'preguntando'],
  ignorar: ['ignorá', 'ignora', 'ignore', 'ignorar', 'ignoro', 'ignoré'],
  tomar: ['tomá', 'toma', 'tome', 'tomar', 'tomo', 'tomé', 'tomando'],
  llamar: ['llamá', 'llama', 'llame', 'llamar', 'llamo', 'llamé'],
  agarrar: ['agarrá', 'agarra', 'agarre', 'agarro', 'agarré'],
  oir: ['oír', 'oigo', 'oye', 'oí', 'oyendo'],
  ir: ['ir', 'voy', 'vas', 'va', 'vamos', 'fui', 'yendo', 'andá'],
  recoger: ['recojo', 'recoge', 'recogí'],
};
for (const [inf, fs] of Object.entries(FORMAS)) {
  test(`V2 lematizar: ${inf}`, () => { for (const f of fs) assert.equal(lematizar(f), inf, f); });
}
test('V2 enclíticos: mirala, agarralo, preguntale, dáselo, hablarle, seguila', () => {
  assert.deepEqual(separarEncliticos('mirala'), { verbo: 'mirar', forma: 'mira', pronombres: ['la'] });
  assert.equal(separarEncliticos('agarralo').verbo, 'agarrar');
  assert.deepEqual(separarEncliticos('preguntale').pronombres, ['le']);
  assert.deepEqual(separarEncliticos('dáselo'), { verbo: 'dar', forma: 'da', pronombres: ['se', 'lo'] });
  assert.equal(separarEncliticos('hablarle').verbo, 'hablar');
  assert.equal(separarEncliticos('seguila').verbo, 'seguir');
});
test('V2 excepciones: no son verbos', () => {
  for (const w of ['mesa', 'vale', 'sale', 'vela', 'sola', 'gata', 'carta', 'puerta', 'campana', 'a', 'e', 'o', 'de', 'la', 'el', 'casa', 'pelo']) {
    assert.equal(lematizar(w), null, w);
    assert.equal(separarEncliticos(w), null, w);
  }
  assert.ok(NO_VERBOS.has('vale'));
});

// ---- V3: tipeo ----
import { corregirTipeo, toleranciaTipeo } from './lectura.js';
const vocab = new Map([['seguir', 'v:seguir'], ['gata', 'f:gata'], ['lampara', 'f:lampara'], ['misa', 'f:misa'], ['puerta', 'f:puerta'], ['casa', 'x:casa'], ['cosa', 'x:cosa']]);
test('V3 tolerancia por largo', () => { assert.equal(toleranciaTipeo(3), 0); assert.equal(toleranciaTipeo(5), 1); assert.equal(toleranciaTipeo(7), 2); });
test('V3 segir→seguir, gatta→gata, lampra→lámpara, pueta→puerta', () => {
  assert.equal(corregirTipeo('segir', vocab).clave, 'v:seguir');
  assert.equal(corregirTipeo('gatta', vocab).clave, 'f:gata');
  assert.equal(corregirTipeo('lampra', vocab).clave, 'f:lampara');
  assert.equal(corregirTipeo('lámpara', vocab).distancia, 0);
  assert.equal(corregirTipeo('pueta', vocab).clave, 'f:puerta');
});
test('V3 «mesa» no se corrige a «misa»; ≤3 letras no se corrigen', () => {
  assert.equal(corregirTipeo('mesa', vocab), null);
  assert.equal(corregirTipeo('gat', vocab), null);
});
test('V3 empate entre claves distintas → sin corregir', () => {
  assert.equal(corregirTipeo('cesa', new Map([['casa', 'a'], ['cosa', 'b']])), null);
});

// ---- V4: referencias ----
import { resolverReferencia, referenciasVigentes, anotarReferencias, leerAccion, contextoLectura } from './lectura.js';
const ctx4 = (reciente = {}) => contextoLectura({
  focos: { gata_mercado: { alias: ['gata'], clase: 'animal' }, burro_atado: { alias: ['burro'], clase: 'animal' } },
  npcs: [{ id: 'serel_panadero', nombre: 'Serel Norlen', alias: ['serel', 'panadero'] }], reciente,
});
const g = (id) => ({ gata_mercado: 'f', burro_atado: 'm' })[id];
test('V4 pronombres por género y recencia', () => {
  assert.equal(resolverReferencia('la', { foco: 'gata_mercado' }, { genero: g }), 'gata_mercado');
  assert.equal(resolverReferencia('lo', { foco: 'gata_mercado' }, { genero: g }), null);
  assert.equal(resolverReferencia('eso', { foco: 'burro_atado' }), 'burro_atado');
  assert.equal(resolverReferencia('le', { npc: 'serel_panadero' }, { tipo: 'npc' }), 'serel_panadero');
});
test('V4 enclítico y pronombre usan la memoria; sin candidato compatible → aclaración', () => {
  assert.deepEqual(leerAccion('seguila', ctx4({ foco: 'gata_mercado' })), { accion: 'seguir', objetivo: 'gata_mercado' });
  assert.deepEqual(leerAccion('lo miro', ctx4({ foco: 'burro_atado' })), { accion: 'mirar', objetivo: 'burro_atado' });
  assert.equal(leerAccion('lo sigo', ctx4({ foco: 'gata_mercado' })).accion, 'aclarar');
  assert.equal(leerAccion('mirala', ctx4()).accion, 'aclarar');
});
test('V4 memoria con tiempo de vida', () => {
  const m = anotarReferencias({}, { accion: 'mirar', objetivo: 'gata_mercado' }, ctx4(), 3);
  assert.deepEqual(referenciasVigentes(m, 5), { foco: 'gata_mercado' });
  assert.deepEqual(referenciasVigentes(m, 20), {});
});
test('V4 varias acciones: la 2.ª usa la referencia de la 1.ª', () => {
  const l = leerAccion('miro la gata y la sigo', ctx4(), { etapas: { varias: true } });
  assert.equal(l.luego?.objetivo, 'gata_mercado');
});
