// Propiedades del narrador (P12), sin dependencias: generador propio (mulberry32) y secuencias de acciones.
// 200 corridas con semilla fija. Si una falla, el mensaje trae la semilla y el turno para reproducirla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, cargarPartida, narrar, contenido } from './index.js';
import { crearRng } from './azar.js';
import { npcsPresentes } from './turno.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true, incluirCanon: true });
const CORRIDAS = 200;
const ACCIONES = 30;
const SILABAS = ['zor', 'blax', 'qin', 'tar', 'mup', 'vel', 'dri', 'kon', 'sal', 'pre'];
const elegir = (rng, l) => l[Math.floor(rng() * l.length)];

function accion(estado, rng) {
  if (rng() < 0.3) {
    const frase = Array.from({ length: 3 + Math.floor(rng() * 3) }, () => elegir(rng, SILABAS) + elegir(rng, SILABAS)).join(' ');
    return { tipo: 'texto', texto: frase };
  }
  const intencion = elegir(rng, contenido.intenciones);
  const parametros = {};
  if (intencion.verbo === 'viajar') parametros.destino = elegir(rng, contenido.escenas).id;
  const presentes = npcsPresentes(estado, contenido);
  if (presentes.length && rng() < 0.5) parametros.npcId = elegir(rng, presentes).id;
  return { tipo: 'boton', intencionId: intencion.id, parametros };
}

async function corrida(semilla, conAmpliado) {
  const rng = crearRng(semilla);
  let estado = crearPartida({ semilla });
  const salidas = [];
  for (let t = 0; t < ACCIONES; t++) {
    const entrada = accion(estado, rng);
    const r = await narrar(estado, entrada, { ahora: () => 0, ...(conAmpliado ? { ampliado: amp } : {}) });
    const donde = `semilla ${semilla}, turno ${t}`;
    // (1) sin {, } ni # sin expandir
    assert.ok(!/[{}#]/.test(r.texto), `${donde}: ${r.texto}`);
    // (3) el texto del jugador no aparece en la salida
    if (entrada.tipo === 'texto') assert.ok(!r.texto.includes(entrada.texto), `${donde}: eco literal`);
    salidas.push(r.texto);
    estado = r.estado;
  }
  return { estado, salidas };
}

for (const conAmpliado of [false, true]) {
  const etiqueta = conAmpliado ? 'con ampliado' : 'v3 puro';
  test(`propiedades (${etiqueta}): ${CORRIDAS} corridas`, async () => {
    for (let s = 1; s <= CORRIDAS; s++) {
      const { estado } = await corrida(s * 7919, conAmpliado);
      // (2) estado serializable y válido
      const cargado = cargarPartida(JSON.parse(JSON.stringify(estado)));
      assert.equal(cargado.jugador.escenaId, estado.jugador.escenaId);
      // (5) sin avisos con el contenido cargado
      assert.deepEqual(estado.avisos, [], `semilla ${s * 7919}`);
      if (conAmpliado) assert.deepEqual(estado.ext.avisos, [], `semilla ${s * 7919}`);
    }
  });

  test(`propiedades (${etiqueta}): misma semilla, misma salida`, async () => {
    for (const s of [3, 17, 101]) assert.deepEqual((await corrida(s, conAmpliado)).salidas, (await corrida(s, conAmpliado)).salidas);
  });
}
