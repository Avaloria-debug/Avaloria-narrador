import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  narrarTurno,
  narrarResultado,
  narrarReformulacion,
  elegirPlantilla,
  completar,
  placeholdersDe,
  aperturaDe,
  anotarApertura,
  valoresDeAccion,
  PLACEHOLDERS,
  VENTANA_APERTURAS,
} from './narracion.js';
import { ejecutarTurno } from './turno.js';
import { estadoInicial } from './estado.js';
import { leerContenido } from './cargarContenido.js';
import { CLAVES_REFORMULACION, MOTIVOS } from './motivos.js';
import { rngDe, rngSembrado } from './utilsPrueba.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});

const partida = (extra = {}) => {
  const e = estadoInicial(contenido, { rng: () => 0.5 });
  return { ...e, eventosActivos: [], ...extra, jugador: { ...e.jugador, ...(extra.jugador ?? {}) } };
};
const turnoDe = (estado, frase, rng = rngDe([0.1])) => ejecutarTurno(estado, { tipo: 'texto', texto: frase }, { contenido, rng });
const narrar = (turno, aperturas = [], rng = rngDe([0])) => narrarTurno(turno, { contenido, rng, aperturas });
const COMPLETOS = { npc: 'Serel', objeto: 'Antorcha', lugar: 'Mercado Circular', conocimiento: 'Un dato', nombres: ['Serel', 'Maren'] };

/** Sin placeholders, corchetes ni ids (los ids llevan guion bajo). */
const limpio = (texto) => {
  assert.equal(typeof texto, 'string');
  assert.ok(texto.trim().length > 0, 'texto vacío');
  assert.ok(!/[{}[\]_]/.test(texto), `texto sucio: ${texto}`);
  assert.ok(!/undefined|null|\[object/.test(texto), `texto sucio: ${texto}`);
};

describe('narración — placeholders', () => {
  test('cada placeholder se resuelve', () => {
    assert.equal(completar('{npc} te escucha.', { npc: 'Serel' }), 'Serel te escucha.');
    assert.equal(completar('Usás {objeto}.', { objeto: 'Antorcha' }), 'Usás Antorcha.');
    assert.equal(completar('Ya estás en {lugar}.', { lugar: 'Lareth' }), 'Ya estás en Lareth.');
    assert.equal(completar('{npc} te cuenta: {conocimiento}.', { npc: 'Serel', conocimiento: 'Un dato' }), 'Serel te cuenta: Un dato.');
    assert.equal(completar('¿Con cuál: {nombres}?', { nombres: ['Serel', 'Maren'] }), '¿Con cuál: Serel, Maren?');
    assert.equal(completar('{npc} y {npc}.', { npc: 'Serel' }), 'Serel y Serel.');
  });

  test('sin valor, con valor vacío o con un placeholder desconocido: no se completa', () => {
    assert.equal(completar('{npc} te escucha.', {}), null);
    assert.equal(completar('{npc} te escucha.', { npc: '  ' }), null);
    assert.equal(completar('{npc} te escucha.', { npc: null }), null);
    assert.equal(completar('¿Con cuál: {nombres}?', { nombres: [] }), null);
    assert.equal(completar('Pasa {otra_cosa}.', { ...COMPLETOS, otra_cosa: 'x' }), null);
    assert.equal(completar('{npc} te escucha.', { npc: '{objeto}' }), null);
    assert.deepEqual(placeholdersDe('{npc} usa {objeto} con {npc}'), ['npc', 'objeto']);
  });

  test('los placeholders del contenido son los cinco conocidos, y todos se usan', () => {
    const usados = new Set();
    const mirar = (v) => {
      if (typeof v === 'string') placeholdersDe(v).forEach((p) => usados.add(p));
      else if (v && typeof v === 'object') Object.values(v).forEach(mirar);
    };
    mirar(contenido.plantillas);
    assert.deepEqual([...usados].sort(), [...PLACEHOLDERS].sort());
  });

  test('valores de una acción: salen de los nombres del contenido', () => {
    const t = turnoDe(partida(), 'hablar con Serel');
    assert.deepEqual(valoresDeAccion(t.accion, contenido), { npc: 'Serel Norlen', lugar: 'Mercado Circular' });
    const viaje = turnoDe(partida(), 'viajar a Lareth');
    assert.equal(valoresDeAccion(viaje.accion, contenido).lugar, 'Lareth');
    const alArchivo = turnoDe(partida(), 'ir al archivo');
    assert.equal(valoresDeAccion(alArchivo.accion, contenido).lugar, 'Archivo Real');
  });

  test('turnos reales: npc, objeto, lugar y conocimiento quedan en el texto', () => {
    const hablar = narrar(turnoDe(partida(), 'hablar con Serel'));
    assert.match(hablar.texto, /Serel Norlen/);
    const comprar = narrar(turnoDe(partida(), 'comprar pan fresco'));
    assert.match(comprar.texto, /Pan fresco/);
    const viaje = narrar(turnoDe(partida(), 'viajar a Lareth'));
    assert.match(viaje.texto, /Lareth/);
    const base = partida();
    const amigo = { ...base, npcs: { ...base.npcs, serel_panadero: { ...base.npcs.serel_panadero, relacion: 90 } } };
    const t = turnoDe(amigo, 'hablar con Serel');
    const k = contenido.npcs.find((n) => n.id === 'serel_panadero').conocimientos[0].contenido;
    const revela = narrar(t);
    assert.ok(t.accion.efectos.some((e) => e.tipo === 'conocimiento_revelado'));
    assert.ok(revela.texto.includes(k), revela.texto);
    for (const r of [hablar, comprar, viaje, revela]) {
      limpio(r.texto);
      assert.equal(r.respaldo, false);
    }
  });

  test('mostrar un objeto narrativo usa su plantilla, con objeto y npc', () => {
    const t = turnoDe(partida(), 'usar el pliego de precios');
    assert.equal(t.accion.parametros.npcId, 'serel_panadero');
    const r = narrar(t);
    assert.match(r.texto, /^Le mostrás Pliego de precios de la panadería a Serel Norlen/);
    limpio(r.texto);
  });
});

describe('narración — falta de un valor', () => {
  test('un placeholder sin valor cambia la plantilla elegida', () => {
    const plantillas = ['Usás {objeto} y funciona.', 'Lo usás con cuidado.'];
    const rng = () => 0;
    assert.equal(elegirPlantilla(plantillas, { objeto: 'Antorcha' }, { rng }).texto, 'Usás Antorcha y funciona.');
    assert.equal(elegirPlantilla(plantillas, {}, { rng }).texto, 'Lo usás con cuidado.');
    // Con el contenido: usar con éxito, sin objeto.
    for (let i = 0; i < 10; i++) {
      const r = narrarResultado(contenido, 'intencion_usar', 'exito', {}, { rng: rngDe([i / 10]) });
      assert.equal(r.texto, 'Lo usás con cuidado y el resultado sale bien.');
      assert.equal(r.respaldo, false);
    }
    assert.equal(narrarReformulacion(contenido, MOTIVOS.FALTA_NPC, {}, { rng }).texto, '¿Con quién querés hablar?');
  });

  test('si ninguna plantilla de la clave sirve, usa la reformulación no_entendido', () => {
    const noEntendido = contenido.plantillas.reformulacion.no_entendido;
    const r = narrarResultado(contenido, 'intencion_hablar_con', 'exito', {}, { rng: () => 0 });
    assert.ok(noEntendido.includes(r.texto));
    assert.equal(r.respaldo, true);
    const ref = narrarReformulacion(contenido, MOTIVOS.NPC_AMBIGUO, {}, { rng: () => 0 });
    assert.ok(noEntendido.includes(ref.texto));
    assert.equal(ref.respaldo, true);
    assert.ok(noEntendido.includes(narrarResultado(contenido, 'bloque_que_no_existe', 'exito', COMPLETOS, { rng: () => 0 }).texto));
    assert.ok(noEntendido.includes(narrarReformulacion(contenido, 'motivo_que_no_existe', COMPLETOS, { rng: () => 0 }).texto));
  });

  test('un turno sin el valor que piden todas sus plantillas no deja placeholders', () => {
    const t = turnoDe(partida(), 'hablar con Serel');
    const sinNpc = { ...t, accion: { ...t.accion, parametros: {} } };
    const r = narrar(sinNpc);
    assert.ok(contenido.plantillas.reformulacion.no_entendido.includes(r.texto));
    assert.equal(r.respaldo, true);
  });
});

describe('narración — ventana de aperturas', () => {
  test('la apertura es la primera palabra, sin signos ni mayúsculas', () => {
    assert.equal(aperturaDe('¿Con quién querés hablar?'), 'con');
    assert.equal(aperturaDe('Usás la antorcha.'), 'usás');
    assert.equal(aperturaDe('  Serel, el panadero'), 'serel');
  });

  test('la ventana guarda las últimas 5', () => {
    let v = [];
    for (const a of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) v = anotarApertura(v, a);
    assert.deepEqual(v, ['c', 'd', 'e', 'f', 'g']);
    assert.equal(VENTANA_APERTURAS, 5);
  });

  test('no elige una apertura que está en la ventana', () => {
    const plantillas = ['Usás {objeto}.', 'Lo usás.', 'Probás {objeto}.'];
    for (let i = 0; i < 20; i++) {
      const r = elegirPlantilla(plantillas, { objeto: 'Antorcha' }, { rng: rngDe([i / 20]), aperturas: ['usás', 'lo'] });
      assert.equal(r.apertura, 'probás');
    }
    // Fuera de la ventana (más de 5 atrás) vuelve a valer.
    const vieja = ['usás', 'a', 'b', 'c', 'd', 'lo'];
    assert.equal(elegirPlantilla(['Usás {objeto}.', 'Lo usás.'], { objeto: 'Antorcha' }, { rng: () => 0, aperturas: vieja }).apertura, 'usás');
  });

  test('si todas están en la ventana, usa la que se usó hace más tiempo', () => {
    const plantillas = ['Usás {objeto}.', 'Lo usás.'];
    const r = elegirPlantilla(plantillas, { objeto: 'Antorcha' }, { rng: () => 0.9, aperturas: ['lo', 'usás'] });
    assert.equal(r.apertura, 'lo');
    const otra = elegirPlantilla(plantillas, { objeto: 'Antorcha' }, { rng: () => 0, aperturas: ['usás', 'lo'] });
    assert.equal(otra.apertura, 'usás');
  });

  test('tres turnos seguidos con la misma acción y el mismo resultado no repiten la apertura', () => {
    const clave = 'plantillas.intencion_usar.exito';
    const valores = { objeto: 'Antorcha', lugar: 'Mercado Circular' };
    const posibles = new Set(
      contenido.plantillas.intencion_usar.exito.map((p) => completar(p, valores)).filter(Boolean).map(aperturaDe),
    );
    assert.ok(
      posibles.size >= 3,
      `falta contenido en ${clave}: hacen falta 3 aperturas distintas para no repetir en tres turnos y hay ${posibles.size} (${[...posibles].join(', ')})`,
    );
    for (let semilla = 1; semilla <= 30; semilla++) {
      const rng = rngSembrado(semilla);
      let estado = partida({ inventario: [{ objetoId: 'objeto_antorcha', usosRestantes: 5 }] });
      let aperturas = [];
      const usadas = [];
      for (let i = 0; i < 3; i++) {
        const t = turnoDe(estado, 'usar la antorcha');
        assert.equal(t.tipo, 'accion');
        assert.equal(t.accion.resultado, 'exito');
        const r = narrarTurno(t, { contenido, rng, aperturas });
        limpio(r.texto);
        usadas.push(r.aperturas.at(-1));
        aperturas = r.aperturas;
        estado = t.estado;
      }
      assert.equal(new Set(usadas).size, 3, `${clave}, semilla ${semilla}: aperturas repetidas (${usadas.join(', ')})`);
      assert.deepEqual(aperturas, usadas);
    }
  });

  test('no modifica la ventana recibida y es determinista con el mismo rng', () => {
    const t = turnoDe(partida(), 'descansar');
    const ventana = Object.freeze(['a', 'b']);
    const uno = narrarTurno(t, { contenido, rng: rngSembrado(3), aperturas: ventana });
    const dos = narrarTurno(t, { contenido, rng: rngSembrado(3), aperturas: ventana });
    assert.deepEqual(uno, dos);
    assert.deepEqual(uno.aperturas.slice(0, 2), ['a', 'b']);
    assert.throws(() => narrarTurno(t, { contenido }), /rng/);
  });
});

describe('narración — reformulaciones', () => {
  test('cada motivo de reformulación produce texto sin placeholders', () => {
    for (const clave of CLAVES_REFORMULACION) {
      for (const valores of [COMPLETOS, {}]) {
        for (let i = 0; i < 5; i++) {
          const r = narrarReformulacion(contenido, clave, valores, { rng: rngDe([i / 5]) });
          limpio(r.texto);
          if (valores === COMPLETOS) {
            assert.equal(r.respaldo, false, clave);
            assert.ok(contenido.plantillas.reformulacion[clave].some((p) => completar(p, COMPLETOS) === r.texto), clave);
          }
        }
      }
    }
  });

  test('turnos reales de reformulación', () => {
    const nada = turnoDe(partida(), 'esto no significa nada');
    assert.equal(nada.tipo, 'reformular');
    assert.ok(contenido.plantillas.reformulacion[nada.motivo].includes(narrar(nada).texto));
    const destino = turnoDe(partida(), 'viajar');
    assert.equal(destino.motivo, MOTIVOS.FALTA_DESTINO);
    assert.equal(narrar(destino).texto, '¿A dónde querés ir?');
    const ya = turnoDe(partida(), 'ir al mercado');
    assert.equal(ya.tipo, 'accion');
    assert.equal(narrar(ya).texto, 'Ya estás en Mercado Circular.');
  });

  test('con nombres, la pregunta los lista', () => {
    const r = narrarReformulacion(contenido, MOTIVOS.NPC_AMBIGUO, { nombres: ['Serel Norlen', 'Maren de Orst'] }, { rng: () => 0 });
    assert.equal(r.texto, '¿A cuál te referís: Serel Norlen, Maren de Orst?');
  });

  test('ia y error no tienen texto de plantilla', () => {
    assert.deepEqual(narrar({ tipo: 'ia', estado: {} }, ['a']), { texto: null, aperturas: ['a'], respaldo: false });
    assert.deepEqual(narrar({ tipo: 'error', estado: {}, error: 'x' }), { texto: null, aperturas: [], respaldo: false });
  });
});

describe('narración — textos limpios', () => {
  test('todas las plantillas del contenido, con todos los valores: sin ids, corchetes ni placeholders', () => {
    const mirar = (v) => {
      if (typeof v === 'string') limpio(completar(v, COMPLETOS));
      else if (v && typeof v === 'object') Object.values(v).forEach(mirar);
    };
    mirar(contenido.plantillas);
  });

  test('cada intención y resultado, con y sin valores', () => {
    for (const intencion of contenido.intenciones) {
      for (const resultado of ['exito', 'fallo', 'neutro']) {
        for (const valores of [COMPLETOS, {}, { npc: 'Serel' }, { objeto: 'Antorcha' }, { lugar: 'Lareth' }]) {
          limpio(narrarResultado(contenido, intencion.id, resultado, valores, { rng: rngDe([0.5]) }).texto);
        }
      }
    }
  });

  test('400 turnos narrados: ningún texto contiene ids, corchetes ni placeholders', () => {
    const rng = rngSembrado(20261115);
    const elegir = (lista) => lista[Math.floor(rng() * lista.length)];
    const nombres = [...contenido.npcs.flatMap((n) => n.alias), ...contenido.objetos.map((o) => o.nombre)];
    const lugares = ['Ardenhall', 'Lareth', 'Halenor', 'el camino del norte', 'la taberna', 'el archivo', 'el mercado', 'el lago', 'la luna'];
    let estado = estadoInicial(contenido, { rng });
    let aperturas = [];
    const tipos = new Set();
    let respaldos = 0;
    for (let i = 0; i < 400; i++) {
      const azar = rng();
      let entrada;
      if (azar < 0.2) entrada = { tipo: 'texto', texto: `viajar a ${elegir(lugares)}` };
      else if (azar < 0.6) entrada = { tipo: 'texto', texto: `${elegir(elegir(contenido.intenciones).formas)} ${elegir(nombres)}` };
      else if (azar < 0.8) entrada = { tipo: 'texto', texto: elegir(elegir(contenido.intenciones).formas) };
      else entrada = { tipo: 'boton', intencionId: elegir(contenido.intenciones).id, parametros: rng() < 0.5 ? { npcId: elegir(contenido.npcs).id } : {} };
      const t = ejecutarTurno(estado, entrada, { contenido, rng });
      const r = narrarTurno(t, { contenido, rng, aperturas });
      tipos.add(t.tipo);
      // 'consulta': con el recorrido sembrado nuevo (retirarse ahora mueve) aparecen consultas de tema; también se narran.
      if (t.tipo === 'accion' || t.tipo === 'reformular' || t.tipo === 'consulta') {
        limpio(r.texto);
        assert.equal(r.aperturas.at(-1), aperturaDe(r.texto));
        if (r.respaldo) respaldos++;
      } else {
        assert.equal(r.texto, null);
      }
      assert.ok(r.aperturas.length <= VENTANA_APERTURAS);
      aperturas = r.aperturas;
      estado = t.estado;
    }
    assert.ok(tipos.has('accion') && tipos.has('reformular'));
    assert.ok(respaldos < 400);
  });
});
