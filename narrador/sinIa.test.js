// Diagnóstico de sin_ia: sin clave, el segundo texto no entendido devuelve plantilla y sin_ia en errores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido, TIPOS_SALIDA } from './index.js';

// En la escena inicial está Serel: una pregunta sin tema ahora la responde él con `no_se` (consultas de tema).
// El caso de sin_ia se prueba con una frase que no es pregunta, y con la pregunta en una escena sin NPCs.
const FRASE = 'opino que la lluvia viene del lago';
const PREGUNTA = '¿qué opinás de la lluvia que viene del lago?';

test('sin clave: dos textos no entendidos seguidos -> el segundo es narración por plantilla, con sin_ia', async () => {
  const http = () => {
    throw new Error('sin clave no se llama a la red');
  };
  const primero = await narrar(crearPartida({ semilla: 7 }), { tipo: 'texto', texto: FRASE }, { http });
  const segundo = await narrar(primero.estado, { tipo: 'texto', texto: FRASE }, { http });
  assert.equal(segundo.tipo, TIPOS_SALIDA.NARRACION);
  assert.ok(contenido.plantillas.reformulacion.no_entendido.includes(segundo.texto), segundo.texto);
  assert.ok(segundo.errores.some((e) => e.includes('sin_ia')), JSON.stringify(segundo.errores));
  assert.ok(segundo.errores.some((e) => e.includes('sin_clave')), JSON.stringify(segundo.errores));
});

test('sin clave y sin NPC en la escena: la pregunta repetida también termina en plantilla con sin_ia', async () => {
  const base = crearPartida({ semilla: 7 });
  // A las 18:00 no hay nadie en el camino del este.
  const sola = { ...base, jugador: { ...base.jugador, escenaId: 'escena_camino_este' }, reloj: { dia: 1, hora: '18:00' } };
  const primero = await narrar(sola, { tipo: 'texto', texto: PREGUNTA });
  assert.equal(primero.tipo, TIPOS_SALIDA.REFORMULACION);
  assert.deepEqual(primero.errores, []);
  const segundo = await narrar(primero.estado, { tipo: 'texto', texto: PREGUNTA });
  assert.equal(segundo.tipo, TIPOS_SALIDA.NARRACION);
  assert.ok(contenido.plantillas.reformulacion.no_entendido.includes(segundo.texto), segundo.texto);
  assert.ok(segundo.errores.some((e) => e.includes('sin_ia')), JSON.stringify(segundo.errores));
});
