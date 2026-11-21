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
