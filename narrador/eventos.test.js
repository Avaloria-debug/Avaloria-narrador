import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  activarEvento,
  cerrarEventos,
  dispararEventos,
  procesarEventos,
  eventosDeEscena,
  verbosDeCierre,
  MAX_EVENTOS_POR_ESCENA,
  MOTIVOS_CIERRE,
} from './eventos.js';
import { estadoDeEscena } from './estadoEscena.js';
import { avanzar } from './reloj.js';
import { leerContenido } from './cargarContenido.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});

const r = (dia, hora) => ({ dia, hora });
const siempre = () => 0; // rng que dispara todo azar
const nunca = () => 0.999999; // rng que no dispara ninguno
const def = (id) => contenido.eventos.find((e) => e.id === id);
const soloEventos = (...ids) => ({ ...contenido, eventos: ids.map(def) });
const ids = (lista) => lista.map((a) => a.id);

/** rng fijo: devuelve los valores en orden y cuenta las llamadas. */
function rngFijo(...valores) {
  let i = 0;
  const rng = () => valores[i++ % valores.length];
  rng.llamadas = () => i;
  return rng;
}

describe('eventos — disparo por azar', () => {
  const datos = (extra) => ({
    contenido: soloEventos('evento_mercado_aglomeracion'),
    relojAntes: r(1, '08:00'),
    reloj: r(1, '09:00'),
    escenaJugadorId: 'escena_mercado_circular',
    ...extra,
  });

  test('dispara si el rng da menos que p, en la escena del jugador', () => {
    // p = 0.1
    const si = dispararEventos([], datos({ rng: rngFijo(0.09) }));
    assert.deepEqual(si.disparados, [
      { id: 'evento_mercado_aglomeracion', escenaId: 'escena_mercado_circular', turnosRestantes: 3, horaFin: null },
    ]);
    assert.deepEqual(si.activos, si.disparados);
    assert.deepEqual(dispararEventos([], datos({ rng: rngFijo(0.1) })).disparados, []);
    assert.deepEqual(dispararEventos([], datos({ rng: rngFijo(0.5) })).disparados, []);
  });

  test('solo en escenas del evento: fuera de ellas ni se consulta el rng', () => {
    const rng = rngFijo(0);
    const res = dispararEventos([], datos({ rng, escenaJugadorId: 'escena_archivo_real' }));
    assert.deepEqual(res.disparados, []);
    assert.equal(rng.llamadas(), 0);
  });

  test('una consulta al rng por evento candidato', () => {
    const rng = rngFijo(0.5);
    dispararEventos([], { ...datos({ rng }), contenido });
    const candidatos = contenido.eventos.filter(
      (e) => e.disparo.tipo === 'azar' && e.escenas.includes('escena_mercado_circular'),
    );
    assert.equal(rng.llamadas(), candidatos.length);
  });

  test('no se repite un evento que ya está activo en la escena', () => {
    const uno = dispararEventos([], datos({ rng: siempre }));
    const dos = dispararEventos(uno.activos, datos({ rng: siempre }));
    assert.deepEqual(dos.disparados, []);
    assert.equal(dos.activos.length, 1);
  });

  test('sin rng lanza: nunca se usa Math.random', () => {
    assert.throws(() => dispararEventos([], datos({})), /rng/);
  });

  test('un evento con escenas vacías o inválidas no se dispara', () => {
    for (const escenas of [[], ['escena_fantasma'], undefined]) {
      const c = { ...contenido, eventos: [{ ...def('evento_mercado_aglomeracion'), escenas }] };
      assert.deepEqual(dispararEventos([], datos({ contenido: c, rng: siempre })).disparados, []);
    }
  });
});

describe('eventos — disparo por hora', () => {
  const datos = (id, antes, despues, extra = {}) => ({
    contenido: soloEventos(id),
    relojAntes: antes,
    reloj: despues,
    rng: nunca,
    escenaJugadorId: 'escena_lago_espejos',
    ...extra,
  });

  test('dispara cuando el reloj llega a la hora, esté donde esté el jugador', () => {
    // Festividad en la plaza: 07:00 a 12:00.
    const res = dispararEventos([], datos('evento_festividad_plaza', r(1, '06:00'), r(1, '07:00')));
    assert.deepEqual(res.disparados, [
      { id: 'evento_festividad_plaza', escenaId: 'escena_plaza_cambistas', turnosRestantes: null, horaFin: r(1, '12:00') },
    ]);
  });

  test('no dispara antes de la hora ni si la hora ya había pasado', () => {
    assert.deepEqual(dispararEventos([], datos('evento_festividad_plaza', r(1, '05:00'), r(1, '06:00'))).disparados, []);
    assert.deepEqual(dispararEventos([], datos('evento_festividad_plaza', r(1, '07:00'), r(1, '08:00'))).disparados, []);
  });

  test('la hora de partida solo cuenta con incluirInicio (primer turno)', () => {
    // Feria de intercambio: 08:00, la hora inicial de la partida.
    const d = datos('evento_feria_intercambio', r(1, '08:00'), r(1, '08:00'));
    assert.deepEqual(dispararEventos([], d).disparados, []);
    assert.equal(dispararEventos([], { ...d, incluirInicio: true }).disparados.length > 0, true);
  });

  test('dispara en todas las escenas del evento', () => {
    // Cierre de la puerta: 19:00, en los caminos del norte y del sur.
    const res = dispararEventos([], datos('evento_cierre_puerta', r(1, '18:00'), r(1, '19:00')));
    assert.deepEqual(res.disparados.map((a) => a.escenaId).sort(), ['escena_camino_norte', 'escena_camino_sur']);
  });

  test('cruce de medianoche: empieza a las 21:00 y termina a las 05:00 del día siguiente', () => {
    const res = dispararEventos([], datos('evento_noche_sin_luna', r(1, '20:00'), r(1, '22:00')));
    assert.ok(res.disparados.length > 0);
    for (const a of res.disparados) assert.deepEqual(a.horaFin, r(2, '05:00'));
  });

  test('salto largo de reloj: si empezó y terminó en el medio, no queda activo', () => {
    // Viaje de 36 horas: la festividad (07:00 a 12:00) del día 2 ya terminó a las 20:00.
    const res = dispararEventos([], datos('evento_festividad_plaza', r(1, '08:00'), r(2, '20:00')));
    assert.deepEqual(res.disparados, []);
  });

  test('salto largo de reloj: si sigue en curso, queda activo con su hora de fin', () => {
    // Viaje de 52 horas desde las 20:00 del día 1: llega a las 00:00 del día 4, con la noche sin luna en curso.
    const res = dispararEventos([], datos('evento_noche_sin_luna', r(1, '20:00'), r(4, '00:00')));
    assert.ok(res.disparados.length > 0);
    assert.deepEqual(res.disparados[0].horaFin, r(4, '05:00'));
  });
});

describe('eventos — disparo por acción', () => {
  const datos = (id, accion, escenaId, extra = {}) => ({
    contenido: soloEventos(id),
    relojAntes: r(1, '08:00'),
    reloj: r(1, '09:00'),
    rng: nunca,
    escenaJugadorId: escenaId,
    escenaAccionId: escenaId,
    accion,
    ...extra,
  });

  test('el verbo indicado, en una escena del evento', () => {
    // Guardias persiguen: atacar en la plaza o en el mercado.
    const res = dispararEventos([], datos('evento_guardias_persiguen', { verbo: 'atacar' }, 'escena_plaza_cambistas'));
    assert.deepEqual(res.disparados, [
      { id: 'evento_guardias_persiguen', escenaId: 'escena_plaza_cambistas', turnosRestantes: null, horaFin: null },
    ]);
  });

  test('otro verbo, otra escena o ninguna acción: no dispara', () => {
    const id = 'evento_guardias_persiguen';
    assert.deepEqual(dispararEventos([], datos(id, { verbo: 'huir' }, 'escena_plaza_cambistas')).disparados, []);
    assert.deepEqual(dispararEventos([], datos(id, { verbo: 'atacar' }, 'escena_taberna_lareth')).disparados, []);
    assert.deepEqual(dispararEventos([], datos(id, null, 'escena_plaza_cambistas')).disparados, []);
  });

  test('con objetivo: solo si la acción es contra ese NPC', () => {
    // Taberna cerrada: atacar a Naela. Termina a las 06:00.
    const id = 'evento_cierre_taberna';
    const si = dispararEventos([], datos(id, { verbo: 'atacar', npcId: 'naela_tabernera' }, 'escena_taberna_lareth'));
    assert.deepEqual(si.disparados, [
      { id, escenaId: 'escena_taberna_lareth', turnosRestantes: null, horaFin: r(2, '06:00') },
    ]);
    const otro = dispararEventos([], datos(id, { verbo: 'atacar', npcId: 'ivor_cambista' }, 'escena_taberna_lareth'));
    assert.deepEqual(otro.disparados, []);
    assert.deepEqual(dispararEventos([], datos(id, { verbo: 'atacar' }, 'escena_taberna_lareth')).disparados, []);
  });

  test('con escena en el disparo: huir en el cruce de colinas', () => {
    const id = 'evento_huida_colinas';
    const si = dispararEventos([], datos(id, { verbo: 'huir' }, 'escena_cruce_colinas'));
    assert.equal(si.disparados[0].turnosRestantes, 3);
    assert.deepEqual(dispararEventos([], datos(id, { verbo: 'huir' }, 'escena_camino_sur')).disparados, []);
  });

  test('se dispara en la escena donde se actuó, aunque el jugador ya esté en otra', () => {
    const d = datos('evento_guardias_persiguen', { verbo: 'atacar' }, 'escena_plaza_cambistas', {
      escenaJugadorId: 'escena_taberna_lareth',
    });
    assert.equal(dispararEventos([], d).disparados[0].escenaId, 'escena_plaza_cambistas');
  });
});

describe('eventos — máximo 2 por escena', () => {
  test('con dos activos no se dispara un tercero, de ningún tipo', () => {
    assert.equal(MAX_EVENTOS_POR_ESCENA, 2);
    const base = {
      contenido,
      relojAntes: r(1, '06:00'),
      reloj: r(1, '07:00'),
      rng: siempre,
      escenaJugadorId: 'escena_plaza_cambistas',
      escenaAccionId: 'escena_plaza_cambistas',
      accion: { verbo: 'atacar' },
    };
    // Con rng que siempre dispara, la plaza se llena y queda en 2.
    const res = dispararEventos([], base);
    assert.equal(eventosDeEscena(res.activos, 'escena_plaza_cambistas').length, 2);
    const otra = dispararEventos(res.activos, { ...base, relojAntes: r(1, '07:00'), reloj: r(1, '08:00') });
    assert.deepEqual(otra.disparados.filter((a) => a.escenaId === 'escena_plaza_cambistas'), []);
  });

  test('ninguna escena pasa de 2 tras muchos turnos con rng que siempre dispara', () => {
    let activos = [];
    let reloj = r(1, '08:00');
    for (let turno = 0; turno < 60; turno++) {
      const escena = contenido.escenas[turno % contenido.escenas.length].id;
      const despues = avanzar(reloj, 1);
      activos = procesarEventos(activos, {
        contenido,
        relojAntes: reloj,
        reloj: despues,
        rng: siempre,
        escenaAccionId: escena,
        escenaJugadorId: escena,
        accion: { verbo: 'atacar', resultado: 'exito' },
      }).activos;
      reloj = despues;
      for (const e of contenido.escenas) assert.ok(eventosDeEscena(activos, e.id).length <= 2, e.id);
    }
  });

  test('el cupo es por escena: otra escena sí recibe el evento', () => {
    const llenos = [
      { id: 'evento_mercado_aglomeracion', escenaId: 'escena_camino_norte', turnosRestantes: 9, horaFin: null },
      { id: 'evento_lluvia_suave', escenaId: 'escena_camino_norte', turnosRestantes: 9, horaFin: null },
    ];
    const res = dispararEventos(llenos, {
      contenido: soloEventos('evento_cierre_puerta'),
      relojAntes: r(1, '18:00'),
      reloj: r(1, '19:00'),
      rng: nunca,
      escenaJugadorId: 'escena_camino_norte',
    });
    assert.deepEqual(res.disparados.map((a) => a.escenaId), ['escena_camino_sur']);
  });
});

describe('eventos — fin por tiempo', () => {
  test('turnos: dura n turnos y se cierra', () => {
    const c = soloEventos('evento_mercado_aglomeracion'); // 3 turnos
    let activos = [activarEvento(def('evento_mercado_aglomeracion'), 'escena_mercado_circular', r(1, '08:00'))];
    const paso = () => cerrarEventos(activos, { contenido: c, reloj: r(1, '09:00') });
    let res = paso();
    assert.equal(res.activos[0].turnosRestantes, 2);
    activos = res.activos;
    res = paso();
    assert.equal(res.activos[0].turnosRestantes, 1);
    activos = res.activos;
    res = paso();
    assert.deepEqual(res.activos, []);
    assert.deepEqual(res.cerrados, [
      { id: 'evento_mercado_aglomeracion', escenaId: 'escena_mercado_circular', motivo: MOTIVOS_CIERRE.TIEMPO },
    ]);
  });

  test('los turnos corren aunque el jugador esté en otra escena', () => {
    const activos = [{ id: 'evento_mercado_aglomeracion', escenaId: 'escena_mercado_circular', turnosRestantes: 1, horaFin: null }];
    const res = cerrarEventos(activos, {
      contenido,
      reloj: r(1, '09:00'),
      escenaAccionId: 'escena_lago_espejos',
      escenaJugadorId: 'escena_lago_espejos',
    });
    assert.deepEqual(res.activos, []);
  });

  test('no modifica la lista ni los eventos recibidos', () => {
    const activos = [{ id: 'evento_mercado_aglomeracion', escenaId: 'escena_mercado_circular', turnosRestantes: 3, horaFin: null }];
    const copia = structuredClone(activos);
    cerrarEventos(activos, { contenido, reloj: r(1, '09:00') });
    dispararEventos(activos, { contenido, relojAntes: r(1, '08:00'), reloj: r(1, '09:00'), rng: siempre, escenaJugadorId: 'escena_plaza_cambistas' });
    assert.deepEqual(activos, copia);
  });
});

describe('eventos — fin por hora', () => {
  test('hora fija: termina cuando el reloj llega, con el jugador en otra escena', () => {
    const activos = [activarEvento(def('evento_festividad_plaza'), 'escena_plaza_cambistas', r(1, '07:00'))];
    const lejos = { contenido, escenaAccionId: 'escena_cruce_colinas', escenaJugadorId: 'escena_cruce_colinas' };
    assert.equal(cerrarEventos(activos, { ...lejos, reloj: r(1, '11:00') }).activos.length, 1);
    const res = cerrarEventos(activos, { ...lejos, reloj: r(1, '12:00') });
    assert.deepEqual(res.activos, []);
    assert.deepEqual(res.cerrados, [
      { id: 'evento_festividad_plaza', escenaId: 'escena_plaza_cambistas', motivo: MOTIVOS_CIERRE.HORA },
    ]);
  });

  test('hora sin valor: la hora de fin es inicio + duración', () => {
    // Lluvia suave: fin por hora, sin valor, 6 horas.
    assert.equal(def('evento_lluvia_suave').fin.valor, undefined);
    const a = activarEvento(def('evento_lluvia_suave'), 'escena_camino_norte', r(1, '10:00'));
    assert.deepEqual(a, { id: 'evento_lluvia_suave', escenaId: 'escena_camino_norte', turnosRestantes: null, horaFin: r(1, '16:00') });
    assert.equal(cerrarEventos([a], { contenido, reloj: r(1, '15:00') }).activos.length, 1);
    assert.deepEqual(cerrarEventos([a], { contenido, reloj: r(1, '16:00') }).activos, []);
  });

  test('hora sin valor con cruce de día', () => {
    // Noble de paso: 15:00, 6 horas. Cosecha abundante: 24 horas.
    assert.deepEqual(activarEvento(def('evento_noble_de_paso'), 'x', r(1, '15:00')).horaFin, r(1, '21:00'));
    assert.deepEqual(activarEvento(def('evento_lluvia_suave'), 'x', r(1, '22:00')).horaFin, r(2, '04:00'));
    const cosecha = activarEvento(def('evento_cosecha_abundante'), 'escena_camino_sur', r(1, '10:00'));
    assert.deepEqual(cosecha.horaFin, r(2, '10:00'));
    // A la misma hora del mismo día todavía no terminó.
    assert.equal(cerrarEventos([cosecha], { contenido, reloj: r(1, '23:00') }).activos.length, 1);
  });

  test('cruce de medianoche: a las 23:00 sigue, a las 05:00 del otro día termina', () => {
    const a = activarEvento(def('evento_noche_sin_luna'), 'escena_camino_norte', r(1, '21:00'));
    assert.equal(cerrarEventos([a], { contenido, reloj: r(1, '23:00') }).activos.length, 1);
    assert.equal(cerrarEventos([a], { contenido, reloj: r(2, '04:00') }).activos.length, 1);
    assert.deepEqual(cerrarEventos([a], { contenido, reloj: r(2, '05:00') }).activos, []);
  });

  test('un viaje largo cierra todo lo que venció en el camino', () => {
    const activos = [
      activarEvento(def('evento_festividad_plaza'), 'escena_plaza_cambistas', r(1, '07:00')),
      activarEvento(def('evento_lluvia_suave'), 'escena_lago_espejos', r(1, '08:00')),
    ];
    const res = cerrarEventos(activos, { contenido, reloj: avanzar(r(1, '08:00'), 36) });
    assert.deepEqual(res.activos, []);
    assert.equal(res.cerrados.length, 2);
  });
});

describe('eventos — fin por acción', () => {
  const activo = (id, escenaId) => activarEvento(def(id), escenaId, r(1, '08:00'));
  const cerrar = (a, accion, escenaAccionId, escenaJugadorId = escenaAccionId) =>
    cerrarEventos([a], { contenido, reloj: r(1, '09:00'), accion, escenaAccionId, escenaJugadorId });

  test('un verbo de la lista, en la escena del evento', () => {
    const a = activo('evento_pelea_palabras', 'escena_plaza_cambistas'); // calmar o negociar
    for (const verbo of ['calmar_la_situacion', 'negociar']) {
      const res = cerrar(a, { verbo, resultado: 'exito' }, 'escena_plaza_cambistas');
      assert.deepEqual(res.cerrados, [
        { id: 'evento_pelea_palabras', escenaId: 'escena_plaza_cambistas', motivo: MOTIVOS_CIERRE.ACCION },
      ]);
    }
  });

  test('otro verbo, otra escena o un fallo no lo cierran', () => {
    const a = activo('evento_pelea_palabras', 'escena_plaza_cambistas');
    assert.equal(cerrar(a, { verbo: 'observar', resultado: 'exito' }, 'escena_plaza_cambistas').activos.length, 1);
    assert.equal(cerrar(a, { verbo: 'negociar', resultado: 'exito' }, 'escena_mercado_circular').activos.length, 1);
    assert.equal(cerrar(a, { verbo: 'negociar', resultado: 'fallo' }, 'escena_plaza_cambistas').activos.length, 1);
    assert.equal(cerrar(a, { verbo: 'negociar', resultado: 'neutro' }, 'escena_plaza_cambistas').activos.length, 0);
  });

  test('combate: huir o rendirse', () => {
    const a = activo('evento_emboscada_sur', 'escena_camino_sur');
    assert.deepEqual(verbosDeCierre(def('evento_emboscada_sur')), ['huir', 'rendirse']);
    assert.equal(a.turnosRestantes, null);
    assert.equal(a.horaFin, null);
    for (const verbo of ['huir', 'rendirse']) {
      assert.deepEqual(cerrar(a, { verbo, resultado: 'exito' }, 'escena_camino_sur').activos, []);
    }
    assert.equal(cerrar(a, { verbo: 'atacar', resultado: 'exito' }, 'escena_camino_sur').activos.length, 1);
  });

  test('salir_escena: se cierra cuando el jugador deja la escena', () => {
    const a = activo('evento_patrulla_busqueda', 'escena_plaza_cambistas');
    const sigue = cerrar(a, { verbo: 'observar', resultado: 'exito' }, 'escena_plaza_cambistas');
    assert.equal(sigue.activos.length, 1);
    const sale = cerrar(a, { verbo: 'viajar', resultado: 'exito' }, 'escena_plaza_cambistas', 'escena_taberna_lareth');
    assert.deepEqual(sale.cerrados, [
      { id: 'evento_patrulla_busqueda', escenaId: 'escena_plaza_cambistas', motivo: MOTIVOS_CIERRE.ACCION },
    ]);
  });

  test('fin por acción con duración en turnos: termina por lo que pase primero', () => {
    // Deuda impaga: 8 turnos, o calmar la situación.
    const a = activo('evento_deuda_impaga', 'escena_plaza_cambistas');
    assert.equal(a.turnosRestantes, 8);
    assert.equal(cerrar(a, { verbo: 'calmar_la_situacion', resultado: 'exito' }, 'escena_plaza_cambistas').cerrados[0].motivo, 'accion');
    let activos = [a];
    for (let i = 0; i < 7; i++) activos = cerrarEventos(activos, { contenido, reloj: r(1, '09:00') }).activos;
    assert.equal(activos[0].turnosRestantes, 1);
    assert.equal(cerrarEventos(activos, { contenido, reloj: r(1, '09:00') }).cerrados[0].motivo, 'tiempo');
  });
});

describe('eventos — paso completo del turno', () => {
  test('un evento que se cierra en el turno no se vuelve a disparar en ese turno', () => {
    const c = soloEventos('evento_guardias_persiguen');
    const activos = [activarEvento(def('evento_guardias_persiguen'), 'escena_plaza_cambistas', r(1, '08:00'))];
    const res = procesarEventos(activos, {
      contenido: { ...c, eventos: [{ ...c.eventos[0], disparo: { tipo: 'accion', verbo: 'huir' } }] },
      relojAntes: r(1, '08:00'),
      reloj: r(1, '09:00'),
      rng: nunca,
      escenaAccionId: 'escena_plaza_cambistas',
      escenaJugadorId: 'escena_plaza_cambistas',
      accion: { verbo: 'huir', resultado: 'exito' },
    });
    assert.equal(res.cerrados.length, 1);
    assert.deepEqual(res.disparados, []);
    assert.deepEqual(res.activos, []);
  });

  test('cerrar libera cupo para disparar en el mismo turno', () => {
    const llenos = [
      { id: 'evento_mercado_aglomeracion', escenaId: 'escena_plaza_cambistas', turnosRestantes: 1, horaFin: null },
      { id: 'evento_patrulla_busqueda', escenaId: 'escena_plaza_cambistas', turnosRestantes: null, horaFin: null },
    ];
    const res = procesarEventos(llenos, {
      contenido: soloEventos('evento_mercado_aglomeracion', 'evento_patrulla_busqueda', 'evento_festividad_plaza'),
      relojAntes: r(1, '06:00'),
      reloj: r(1, '07:00'),
      rng: nunca,
      escenaAccionId: 'escena_plaza_cambistas',
      escenaJugadorId: 'escena_plaza_cambistas',
    });
    assert.deepEqual(ids(res.cerrados), ['evento_mercado_aglomeracion']);
    assert.deepEqual(ids(res.disparados), ['evento_festividad_plaza']);
    assert.equal(res.activos.length, 2);
  });

  test('emboscada: sube el estado de la escena y huir lo baja', () => {
    const c = soloEventos('evento_emboscada_lago');
    const base = { contenido: c, escenaAccionId: 'escena_lago_espejos', escenaJugadorId: 'escena_lago_espejos' };
    const uno = procesarEventos([], { ...base, relojAntes: r(1, '08:00'), reloj: r(1, '09:00'), rng: siempre });
    assert.equal(estadoDeEscena('escena_lago_espejos', uno.activos, contenido), 'combate');
    const dos = procesarEventos(uno.activos, {
      ...base,
      relojAntes: r(1, '09:00'),
      reloj: r(1, '10:00'),
      rng: nunca,
      accion: { verbo: 'huir', resultado: 'exito' },
      escenaJugadorId: 'escena_camino_norte',
    });
    assert.equal(estadoDeEscena('escena_lago_espejos', dos.activos, contenido), 'tranquilo');
  });
});

describe('eventos — prueba de carga con los 70 del contenido', () => {
  test('cada evento se puede activar en cada una de sus escenas', () => {
    assert.equal(contenido.eventos.length, 70);
    for (const ev of contenido.eventos) {
      for (const escenaId of ev.escenas) {
        const a = activarEvento(ev, escenaId, r(1, '08:00'));
        assert.equal(a.id, ev.id);
        assert.equal(a.escenaId, escenaId);
        assert.ok(a.turnosRestantes === null || a.turnosRestantes > 0, ev.id);
        assert.ok(a.horaFin === null || /^\d\d:\d\d$/.test(a.horaFin.hora), ev.id);
        // Todo evento tiene alguna forma de terminar.
        assert.ok(a.turnosRestantes !== null || a.horaFin !== null || verbosDeCierre(ev).length > 0, ev.id);
      }
    }
  });

  test('cada evento se dispara por su tipo de disparo y después se cierra', () => {
    for (const ev of contenido.eventos) {
      const c = { ...contenido, eventos: [ev] };
      const d = ev.disparo;
      const escenaId = d.escena ?? d.escenas?.[0] ?? ev.escenas[0];
      const relojAntes = d.tipo === 'hora' ? avanzar({ dia: 1, hora: d.valor }, 23) : r(1, '08:00');
      const reloj = avanzar(relojAntes, 1);
      const turno = { contenido: c, escenaAccionId: escenaId, escenaJugadorId: escenaId };

      const abre = procesarEventos([], {
        ...turno,
        relojAntes,
        reloj,
        rng: siempre,
        accion: d.tipo === 'accion' ? { verbo: d.verbo, npcId: d.objetivo ?? null, resultado: 'exito' } : null,
      });
      assert.ok(abre.disparados.some((a) => a.id === ev.id && a.escenaId === escenaId), `no se disparó ${ev.id}`);

      // Cierre: por su verbo, por salir de la escena, o dejando pasar el tiempo.
      const verbos = verbosDeCierre(ev);
      let activos = abre.activos;
      let ahora = reloj;
      let cerrado = false;
      for (let i = 0; i < 40 && !cerrado; i++) {
        const despues = avanzar(ahora, 1);
        const sale = verbos.includes('salir_escena');
        const res = procesarEventos(activos, {
          ...turno,
          relojAntes: ahora,
          reloj: despues,
          rng: nunca,
          accion: verbos.length > 0 && !sale ? { verbo: verbos[0], resultado: 'exito' } : null,
          escenaJugadorId: sale ? 'escena_fuera' : escenaId,
        });
        activos = res.activos.filter((a) => a.id === ev.id);
        cerrado = !activos.some((a) => a.escenaId === escenaId);
        ahora = despues;
      }
      assert.ok(cerrado, `no se cerró ${ev.id}`);
    }
  });

  test('400 turnos con rng sembrado: sin errores, sin pasar de 2 por escena y sin eventos colgados', () => {
    // Generador determinista (mulberry32).
    let semilla = 12345;
    const rng = () => {
      semilla = (semilla + 0x6d2b79f5) | 0;
      let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const verbos = [...new Set(contenido.intenciones.map((i) => i.verbo))];
    const vistos = new Set();
    let activos = [];
    let reloj = r(1, '08:00');
    let escena = 'escena_mercado_circular';
    let cierres = 0;
    for (let turno = 0; turno < 400; turno++) {
      const verbo = verbos[Math.floor(rng() * verbos.length)];
      const destino = rng() < 0.3 ? contenido.escenas[Math.floor(rng() * contenido.escenas.length)].id : escena;
      const despues = avanzar(reloj, rng() < 0.1 ? 36 : 1);
      const res = procesarEventos(activos, {
        contenido,
        relojAntes: reloj,
        reloj: despues,
        rng,
        escenaAccionId: escena,
        escenaJugadorId: destino,
        accion: { verbo, resultado: rng() < 0.5 ? 'exito' : 'fallo', npcId: contenido.npcs[Math.floor(rng() * 12)].id },
        incluirInicio: turno === 0,
      });
      activos = res.activos;
      cierres += res.cerrados.length;
      for (const a of res.disparados) vistos.add(a.id);
      for (const e of contenido.escenas) assert.ok(eventosDeEscena(activos, e.id).length <= 2);
      for (const e of contenido.escenas) estadoDeEscena(e.id, activos, contenido);
      reloj = despues;
      escena = destino;
    }
    assert.ok(vistos.size >= 40, `solo se dispararon ${vistos.size} eventos distintos`);
    assert.ok(cierres > 100);
  });
});
