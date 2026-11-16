import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarTurno, npcsPresentes, objetosAplicables, TIPOS_TURNO } from './turno.js';
import { estadoInicial } from './estado.js';
import { eventosDeEscena } from './eventos.js';
import { leerContenido } from './cargarContenido.js';
import { rngDe, rngSembrado, eventoActivo as ev } from './utilsPrueba.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});

/** Partida de prueba: 200 de bronce, 3 de plata, sin eventos, en el mercado (con Serel). */
const partida = (extra = {}) => {
  const e = estadoInicial(contenido, { rng: () => 0.5 });
  return {
    ...e,
    eventosActivos: [],
    ...extra,
    jugador: { ...e.jugador, ...(extra.jugador ?? {}) },
    npcs: { ...e.npcs, ...Object.fromEntries(Object.entries(extra.npcs ?? {}).map(([id, v]) => [id, { ...e.npcs[id], ...v }])) },
  };
};
const texto = (estado, frase, rng = rngDe([0.1])) => ejecutarTurno(estado, { tipo: 'texto', texto: frase }, { contenido, rng });
const boton = (estado, intencionId, parametros, rng = rngDe([0.1])) =>
  ejecutarTurno(estado, { tipo: 'boton', intencionId, parametros }, { contenido, rng });
const efecto = (turno, tipo) => turno.accion.efectos.find((e) => e.tipo === tipo);

describe('turno — orden y forma del resultado', () => {
  test('hablar con éxito: efectos sobre el NPC, reloj sin avanzar, sin texto', () => {
    const e = partida();
    const t = texto(e, 'hablar con Serel');
    assert.equal(t.tipo, TIPOS_TURNO.ACCION);
    assert.equal(t.intencionId, 'intencion_hablar_con');
    assert.deepEqual(t.accion.parametros, { npcId: 'serel_panadero' });
    assert.equal(t.accion.resultado, 'exito');
    assert.deepEqual(t.accion.efectos, [
      { tipo: 'relacion', npcId: 'serel_panadero', delta: 5, valor: 5 },
      { tipo: 'disposicion', npcId: 'serel_panadero', delta: 1, valor: 1 },
    ]);
    assert.equal(t.accion.costoHoras, 0);
    assert.deepEqual(t.estado.reloj, { dia: 1, hora: '08:00' });
    assert.equal(t.estado.npcs.serel_panadero.relacion, 5);
    assert.deepEqual(t.escena, { id: 'escena_mercado_circular', estado: 'tranquilo', npcs: [{ id: 'serel_panadero', disposicion: 1 }] });
    assert.ok(!('texto' in t));
  });

  test('hablar con fallo', () => {
    const t = texto(partida(), 'hablar con Serel', rngDe([0.9]));
    assert.equal(t.accion.resultado, 'fallo');
    assert.equal(t.estado.npcs.serel_panadero.relacion, -5);
    assert.equal(t.estado.npcs.serel_panadero.disposicion, -1);
  });

  test('la sensibilidad del NPC multiplica el delta', () => {
    const enArchivo = partida({ jugador: { escenaId: 'escena_archivo_real' } });
    assert.equal(texto(enArchivo, 'ayudar a Maren').estado.npcs.maren_archivista.relacion, 15);
    const enLago = partida({ jugador: { escenaId: 'escena_lago_espejos' } });
    assert.equal(texto(enLago, 'ayudar a Ysolde').estado.npcs.ysolde_pescadora.relacion, 5);
  });

  test('no modifica el estado recibido y el estado nuevo es JSON puro', () => {
    const e = partida();
    const copia = structuredClone(e);
    const t = texto(e, 'atacar a Serel');
    assert.deepEqual(e, copia);
    assert.deepEqual(JSON.parse(JSON.stringify(t.estado)), t.estado);
  });

  test('sin rng lanza', () => {
    assert.throws(() => ejecutarTurno(partida(), { tipo: 'texto', texto: 'descansar' }, { contenido }), /rng/);
  });

  test('entrada inválida: error, sin cambiar el estado', () => {
    const e = partida();
    for (const entrada of [null, {}, { tipo: 'texto' }, { tipo: 'boton', intencionId: 'intencion_volar' }, { tipo: 'otro' }]) {
      const t = ejecutarTurno(e, entrada, { contenido, rng: () => 0 });
      assert.equal(t.tipo, TIPOS_TURNO.ERROR);
      assert.equal(t.estado, e);
    }
  });
});

describe('turno — comprender', () => {
  test('reformula una vez; la segunda pasa a IA; no avanza el reloj', () => {
    const uno = texto(partida(), 'hola, buenas tardes');
    assert.equal(uno.tipo, TIPOS_TURNO.REFORMULAR);
    assert.equal(uno.motivo, 'no_entendido');
    assert.equal(uno.estado.reformulacionPendiente, true);
    assert.deepEqual(uno.estado.reloj, { dia: 1, hora: '08:00' });
    const dos = texto(uno.estado, 'sigo sin decir nada claro');
    assert.equal(dos.tipo, TIPOS_TURNO.IA);
    assert.equal(dos.estado.reformulacionPendiente, false);
    assert.deepEqual(dos.estado.reloj, { dia: 1, hora: '08:00' });
    // Después de la IA se vuelve a reformular.
    assert.equal(texto(dos.estado, 'otra vez nada').tipo, TIPOS_TURNO.REFORMULAR);
  });

  test('si la segunda frase se entiende, se ejecuta', () => {
    const uno = texto(partida(), 'hablar con');
    assert.equal(uno.motivo, 'falta_npc');
    assert.deepEqual(uno.datos.nombres, ['Serel Norlen']);
    const dos = texto(uno.estado, 'hablar con el panadero');
    assert.equal(dos.tipo, TIPOS_TURNO.ACCION);
    assert.equal(dos.estado.reformulacionPendiente, false);
  });

  test('solo se ven los NPCs de la escena, según la hora', () => {
    assert.deepEqual(npcsPresentes(partida(), contenido).map((n) => n.id), ['serel_panadero']);
    assert.equal(texto(partida(), 'hablar con Maren').motivo, 'npc_ausente');
    const enSur = partida({ jugador: { escenaId: 'escena_camino_sur' }, reloj: { dia: 1, hora: '16:00' } });
    assert.deepEqual(npcsPresentes(enSur, contenido).map((n) => n.id), ['sarin_mensajera', 'hollis_pastor']);
  });

  test('dos intenciones: ejecuta la primera y avisa la segunda', () => {
    const t = texto(partida(), 'descansar y después trabajar');
    assert.equal(t.accion.verbo, 'descansar');
    assert.equal(t.repetirIntencionId, 'intencion_trabajar');
  });

  test('objetos aplicables por verbo', () => {
    const e = partida({ inventario: [{ objetoId: 'objeto_daga', usosRestantes: 8 }, { objetoId: 'objeto_cuerda', usosRestantes: 4 }] });
    const ids = (verbo, estado = e) => objetosAplicables(estado, contenido, verbo).map((o) => o.id);
    assert.deepEqual(ids('atacar'), ['objeto_daga']);
    assert.deepEqual(ids('usar'), ['objeto_daga', 'objeto_cuerda', 'objeto_pliego_precios']);
    assert.ok(ids('comprar').includes('objeto_pan_duro'));
    assert.ok(!ids('comprar').includes('objeto_daga'));
  });
});

describe('turno — botones', () => {
  test('con parámetros', () => {
    const t = boton(partida(), 'intencion_hablar_con', { npcId: 'serel_panadero' });
    assert.equal(t.tipo, TIPOS_TURNO.ACCION);
    assert.equal(t.accion.resultado, 'exito');
  });

  test('sin parámetros usa las reglas de la comprensión', () => {
    assert.equal(boton(partida(), 'intencion_ayudar').accion.parametros.npcId, 'serel_panadero');
    assert.equal(boton(partida(), 'intencion_hablar_con').motivo, 'falta_npc');
    assert.equal(boton(partida(), 'intencion_viajar').motivo, 'falta_destino');
    assert.equal(boton(partida(), 'intencion_usar', { objetoId: 'objeto_daga' }).motivo, 'sin_objetos');
    assert.equal(boton(partida(), 'intencion_hablar_con', { npcId: 'maren_archivista' }).motivo, 'npc_ausente');
  });

  test('un botón nunca pasa a IA', () => {
    const uno = boton(partida(), 'intencion_hablar_con');
    assert.equal(boton(uno.estado, 'intencion_hablar_con').tipo, TIPOS_TURNO.REFORMULAR);
  });

  test('viajar con destino', () => {
    const t = boton(partida(), 'intencion_viajar', { destino: 'escena_archivo_real' });
    assert.equal(t.estado.jugador.escenaId, 'escena_archivo_real');
  });
});

describe('turno — atacar y emboscar', () => {
  test('atacar: -40, disposición en -2 y conocimientos bloqueados para siempre', () => {
    const t = texto(partida({ npcs: { serel_panadero: { relacion: 90 } } }), 'atacar a Serel');
    const serel = t.estado.npcs.serel_panadero;
    assert.equal(serel.relacion, 50);
    assert.equal(serel.disposicion, -2);
    assert.equal(serel.bloqueadoConocimientos, true);
    assert.deepEqual(efecto(t, 'conocimientos_bloqueados'), { tipo: 'conocimientos_bloqueados', npcId: 'serel_panadero' });

    // Con relación de sobra (umbral 30), hablar con éxito ya no revela nada. Tampoco después de muchos turnos.
    let estado = t.estado;
    for (let i = 0; i < 12; i++) {
      const h = texto(estado, 'hablar con Serel', rngDe([0.1]));
      assert.equal(efecto(h, 'conocimiento_revelado'), undefined);
      estado = h.estado;
    }
    assert.ok(estado.npcs.serel_panadero.relacion >= 30);
    assert.equal(estado.npcs.serel_panadero.bloqueadoConocimientos, true);
    assert.deepEqual(estado.npcs.serel_panadero.conocimientosRevelados, []);
  });

  test('emboscar con fallo también bloquea', () => {
    const t = texto(partida(), 'emboscar a Serel', rngDe([0.9]));
    assert.equal(t.accion.resultado, 'fallo');
    assert.equal(t.estado.npcs.serel_panadero.bloqueadoConocimientos, true);
    assert.equal(t.estado.npcs.serel_panadero.relacion, -40);
  });

  test('presionar con fallo fija la disposición en -2', () => {
    const t = texto(partida({ npcs: { serel_panadero: { disposicion: 2 } } }), 'presionar a Serel', rngDe([0.9]));
    assert.equal(t.estado.npcs.serel_panadero.disposicion, -2);
    assert.equal(t.estado.npcs.serel_panadero.relacion, -15);
  });

  test('calmar: sube solo la disposición (y la relación del contenido), sin temor', () => {
    const t = texto(partida(), 'calmar la situación');
    assert.equal(t.accion.parametros.npcId, undefined);
    const conNpc = boton(partida(), 'intencion_calmar', { npcId: 'serel_panadero' });
    assert.equal(conNpc.estado.npcs.serel_panadero.disposicion, 1);
    assert.ok(!('temor' in conNpc.estado.npcs.serel_panadero));
    assert.equal(efecto(conNpc, 'temor'), undefined);
    assert.deepEqual(efecto(conNpc, 'disposicion'), { tipo: 'disposicion', npcId: 'serel_panadero', delta: 1, valor: 1 });
  });
});

describe('turno — conocimientos', () => {
  test('hablar con éxito revela al llegar al umbral, una sola vez', () => {
    // Serel: umbral 30. Con 25, el éxito suma 5 y alcanza.
    const t = texto(partida({ npcs: { serel_panadero: { relacion: 25 } } }), 'hablar con Serel');
    assert.deepEqual(efecto(t, 'conocimiento_revelado'), {
      tipo: 'conocimiento_revelado',
      npcId: 'serel_panadero',
      conocimientoId: 'conocimiento_serel_1',
      por: 'conversacion',
    });
    assert.deepEqual(t.estado.npcs.serel_panadero.conocimientosRevelados, ['conocimiento_serel_1']);
    const otra = texto(t.estado, 'hablar con Serel');
    assert.equal(efecto(otra, 'conocimiento_revelado'), undefined);
    assert.deepEqual(otra.estado.npcs.serel_panadero.conocimientosRevelados, ['conocimiento_serel_1']);
  });

  test('por debajo del umbral, o con fallo, no revela', () => {
    const bajo = texto(partida({ npcs: { serel_panadero: { relacion: 20 } } }), 'hablar con Serel');
    assert.equal(efecto(bajo, 'conocimiento_revelado'), undefined);
    const fallo = texto(partida({ npcs: { serel_panadero: { relacion: 90 } } }), 'hablar con Serel', rngDe([0.9]));
    assert.equal(efecto(fallo, 'conocimiento_revelado'), undefined);
  });

  test('marca leyo: leer en la biblioteca y después hablar con Elia', () => {
    const enBiblioteca = partida({ jugador: { escenaId: 'escena_biblioteca_publica' }, npcs: { elia_bibliotecaria: { relacion: 60 } } });
    const sinLeer = texto(enBiblioteca, 'hablar con Elia');
    assert.equal(efecto(sinLeer, 'conocimiento_revelado'), undefined);
    const leyo = texto(sinLeer.estado, 'leer');
    assert.deepEqual(leyo.estado.marcas, ['leyo']);
    const conMarca = texto(leyo.estado, 'hablar con Elia');
    assert.equal(efecto(conMarca, 'conocimiento_revelado').conocimientoId, 'conocimiento_elia_1');
  });

  test('evento requerido: Hollis con la tormenta', () => {
    const base = { jugador: { escenaId: 'escena_camino_sur' }, npcs: { hollis_pastor: { relacion: 60 } } };
    assert.equal(efecto(texto(partida(base), 'hablar con Hollis'), 'conocimiento_revelado'), undefined);
    const conTormenta = partida({ ...base, eventosActivos: [ev('evento_tormenta_verano', 'escena_camino_sur')] });
    assert.equal(
      efecto(texto(conTormenta, 'hablar con Hollis'), 'conocimiento_revelado').conocimientoId,
      'conocimiento_sendero_sin_vigilancia',
    );
  });

  test('mostrar un narrativo a su NPC revela sin umbral; la segunda vez falla', () => {
    const enArchivo = partida({ jugador: { escenaId: 'escena_archivo_real' }, npcs: { maren_archivista: { relacion: -20 } } });
    const t = texto(enArchivo, 'usar el sello');
    assert.equal(t.accion.resultado, 'exito');
    assert.deepEqual(t.accion.parametros, { objetoId: 'objeto_sello_archivo', npcId: 'maren_archivista' });
    assert.deepEqual(efecto(t, 'conocimiento_revelado'), {
      tipo: 'conocimiento_revelado',
      npcId: 'maren_archivista',
      conocimientoId: 'conocimiento_maren_1',
      por: 'narrativo',
    });
    assert.equal(t.estado.npcs.maren_archivista.relacion, -20);
    const otra = texto(t.estado, 'usar el sello');
    assert.equal(otra.accion.resultado, 'fallo');
    assert.equal(efecto(otra, 'narrativo_sin_conocimiento').motivo, 'ya_revelado');
  });

  test('mostrar un narrativo a un NPC atacado no revela', () => {
    const enArchivo = partida({ jugador: { escenaId: 'escena_archivo_real' } });
    const atacado = texto(enArchivo, 'atacar a Maren');
    const t = texto(atacado.estado, 'usar el sello');
    assert.equal(t.accion.resultado, 'fallo');
    assert.equal(efecto(t, 'narrativo_sin_conocimiento').motivo, 'bloqueado');
  });
});

describe('turno — economía y objetos', () => {
  test('trabajar y comprar por texto', () => {
    const t = texto(partida(), 'trabajar', rngDe([0.5]));
    assert.equal(t.estado.jugador.bronce, 240);
    const c = texto(t.estado, 'comprar pan duro');
    assert.equal(c.accion.resultado, 'exito');
    assert.equal(c.estado.jugador.bronce, 235);
    assert.deepEqual(c.estado.inventario, [{ objetoId: 'objeto_pan_duro', usosRestantes: 1 }]);
  });

  test('comprar sin dinero falla y no descuenta', () => {
    const t = texto(partida({ jugador: { bronce: 2 } }), 'comprar pan duro');
    assert.equal(t.accion.resultado, 'fallo');
    assert.equal(t.accion.motivo, 'sin_dinero');
    assert.equal(t.estado.jugador.bronce, 2);
    assert.deepEqual(t.estado.inventario, []);
  });

  test('usar hasta agotar los usos', () => {
    let estado = partida({ inventario: [{ objetoId: 'objeto_espada_rota', usosRestantes: 3 }] });
    for (const quedan of [2, 1]) {
      estado = texto(estado, 'usar la espada').estado;
      assert.equal(estado.inventario[0].usosRestantes, quedan);
    }
    estado = texto(estado, 'usar la espada').estado;
    assert.deepEqual(estado.inventario, []);
    // Sin la espada queda solo el pliego de la escena, y "usar la espada" usa lo único que hay.
    assert.deepEqual(objetosAplicables(estado, contenido, 'usar').map((o) => o.id), ['objeto_pliego_precios']);
  });

  test('negociar ofreciendo un objeto: 15 en vez de 10, y gasta un uso', () => {
    const e = partida({ inventario: [{ objetoId: 'objeto_queso_curado', usosRestantes: 1 }] });
    const t = texto(e, 'negociar con Serel por el queso');
    assert.equal(t.estado.npcs.serel_panadero.relacion, 15);
    assert.deepEqual(t.estado.inventario, []);
    assert.equal(texto(partida(), 'negociar con Serel').estado.npcs.serel_panadero.relacion, 10);
  });
});

describe('turno — huir y viajar', () => {
  test('huir con éxito mueve; con fallo no', () => {
    const ok = texto(partida(), 'huir', rngDe([0.1]));
    assert.equal(ok.estado.jugador.escenaId, 'escena_archivo_real');
    assert.equal(ok.accion.escenaAnterior, 'escena_mercado_circular');
    assert.equal(ok.accion.escenaNueva, 'escena_archivo_real');
    assert.equal(ok.escena.id, 'escena_archivo_real');
    const mal = texto(partida(), 'huir', rngDe([0.9]));
    assert.equal(mal.estado.jugador.escenaId, 'escena_mercado_circular');
    assert.equal(mal.accion.escenaNueva, 'escena_mercado_circular');
  });

  test('huir con éxito termina el combate; con fallo sigue', () => {
    const enCombate = partida({
      jugador: { escenaId: 'escena_camino_sur' },
      eventosActivos: [ev('evento_emboscada_sur', 'escena_camino_sur')],
    });
    const mal = texto(enCombate, 'huir', rngDe([0.9]));
    assert.deepEqual(mal.eventos.cerrados, []);
    assert.equal(mal.escena.estado, 'combate');
    const ok = texto(mal.estado, 'huir', rngDe([0.1]));
    assert.deepEqual(ok.eventos.cerrados, [{ id: 'evento_emboscada_sur', escenaId: 'escena_camino_sur', motivo: 'accion' }]);
    assert.notEqual(ok.estado.jugador.escenaId, 'escena_camino_sur');
  });

  test('viajar a otra ciudad: mueve, avanza 36 horas y mueve a los NPCs', () => {
    const t = texto(partida(), 'viajar a Lareth');
    assert.equal(t.estado.jugador.escenaId, 'escena_plaza_cambistas');
    assert.deepEqual(t.estado.reloj, { dia: 2, hora: '20:00' });
    assert.equal(t.accion.costoHoras, 36);
    assert.deepEqual(t.npcsMovidos.map((m) => m.npcId).sort(), ['brenn_arriero', 'sarin_mensajera']);
    assert.deepEqual(t.escena.npcs.map((n) => n.id), ['ivor_cambista']);
  });

  test('detenerse en el camino y seguir: 18 + 18', () => {
    const uno = texto(partida(), 'tomar el camino del norte');
    assert.equal(uno.estado.jugador.escenaId, 'escena_camino_norte');
    assert.deepEqual(uno.estado.reloj, { dia: 2, hora: '02:00' });
    const dos = texto(uno.estado, 'ir a Lareth');
    assert.equal(dos.estado.jugador.escenaId, 'escena_plaza_cambistas');
    assert.deepEqual(dos.estado.reloj, { dia: 2, hora: '20:00' });
  });

  test('ir a un lugar de camino por texto', () => {
    const enCamino = partida({ jugador: { escenaId: 'escena_camino_norte' } });
    const t = texto(enCamino, 'ir al lago');
    assert.equal(t.estado.jugador.escenaId, 'escena_lago_espejos');
    assert.equal(t.accion.costoHoras, 1);
    assert.deepEqual(t.escena.npcs.map((n) => n.id), ['ysolde_pescadora']);
  });

  test('ya en el destino: neutro, sin gastar reloj', () => {
    const t = texto(partida(), 'ir al mercado');
    assert.equal(t.accion.resultado, 'neutro');
    assert.equal(t.accion.motivo, 'ya_en_destino');
    assert.deepEqual(t.estado.reloj, { dia: 1, hora: '08:00' });
  });

  test('salir de la escena cierra la patrulla (salir_escena)', () => {
    const e = partida({
      jugador: { escenaId: 'escena_plaza_cambistas' },
      eventosActivos: [ev('evento_patrulla_busqueda', 'escena_plaza_cambistas')],
    });
    assert.deepEqual(texto(e, 'observar').eventos.cerrados, []);
    assert.deepEqual(texto(e, 'ir a la taberna').eventos.cerrados, [
      { id: 'evento_patrulla_busqueda', escenaId: 'escena_plaza_cambistas', motivo: 'accion' },
    ]);
  });
});

describe('turno — efectos de eventos', () => {
  test('disposicion: vale mientras el evento está activo y se quita al cerrarlo', () => {
    const e = partida({
      eventosActivos: [{ id: 'evento_feria_intercambio', escenaId: 'escena_mercado_circular', turnosRestantes: 2, horaFin: null }],
    });
    const uno = texto(e, 'retirarse');
    assert.deepEqual(uno.escena.npcs, [{ id: 'serel_panadero', disposicion: 1 }]);
    assert.equal(uno.estado.npcs.serel_panadero.disposicion, 0);
    const dos = texto(uno.estado, 'retirarse');
    assert.deepEqual(dos.eventos.cerrados.map((c) => c.id), ['evento_feria_intercambio']);
    assert.deepEqual(dos.escena.npcs, [{ id: 'serel_panadero', disposicion: 0 }]);
  });

  test('bloqueo de hablar con un NPC: falla sin tocar la relación; al cerrar el evento, se puede', () => {
    const e = partida({
      jugador: { escenaId: 'escena_taberna_lareth' },
      eventosActivos: [{ id: 'evento_cierre_taberna', escenaId: 'escena_taberna_lareth', turnosRestantes: null, horaFin: { dia: 1, hora: '10:00' } }],
    });
    const rng = rngDe([0.1]);
    const t = texto(e, 'hablar con Naela', rng);
    assert.equal(t.accion.resultado, 'fallo');
    assert.equal(t.accion.motivo, 'bloqueado');
    assert.deepEqual(efecto(t, 'bloqueo'), { tipo: 'bloqueo', eventoId: 'evento_cierre_taberna' });
    assert.equal(t.estado.npcs.naela_tabernera.relacion, 0);
    // A las 10:00 el evento se cierra y hablar vuelve a funcionar.
    const dos = texto(t.estado, 'descansar');
    assert.deepEqual(dos.eventos.cerrados.map((c) => c.id), ['evento_cierre_taberna']);
    const tres = texto(dos.estado, 'hablar con Naela');
    assert.equal(tres.accion.resultado, 'exito');
    assert.equal(tres.estado.npcs.naela_tabernera.relacion, 5);
  });

  test('bloqueo de usar un objeto', () => {
    const e = partida({
      jugador: { escenaId: 'escena_camino_norte' },
      inventario: [{ objetoId: 'objeto_antorcha', usosRestantes: 5 }],
      eventosActivos: [ev('evento_niebla_lago', 'escena_camino_norte')],
    });
    const t = texto(e, 'usar la antorcha');
    assert.equal(t.accion.motivo, 'bloqueado');
    assert.equal(t.estado.inventario[0].usosRestantes, 5);
  });

  test('bloqueo de viajar: con el cierre de la puerta no se entra a Ardenhall desde el camino', () => {
    const e = partida({
      jugador: { escenaId: 'escena_camino_norte' },
      eventosActivos: [{ id: 'evento_cierre_puerta', escenaId: 'escena_camino_norte', turnosRestantes: 2, horaFin: null }],
    });
    const t = texto(e, 'ir a Ardenhall');
    assert.equal(t.accion.resultado, 'fallo');
    assert.equal(t.accion.motivo, 'bloqueado');
    assert.equal(t.estado.jugador.escenaId, 'escena_camino_norte');
    assert.deepEqual(t.estado.reloj, { dia: 1, hora: '08:00' });
    // Dos turnos después la puerta está abierta.
    const abierto = texto(texto(t.estado, 'descansar').estado, 'ir a Ardenhall');
    assert.equal(abierto.accion.resultado, 'exito');
    assert.equal(abierto.estado.jugador.escenaId, 'escena_mercado_circular');
  });

  test('habilita: la tormenta habilita el conocimiento y al cerrarse deja de valer', () => {
    const tormenta = { id: 'evento_tormenta_verano', escenaId: 'escena_lago_espejos', turnosRestantes: null, horaFin: { dia: 1, hora: '08:00' } };
    const e = partida({
      jugador: { escenaId: 'escena_camino_sur' },
      npcs: { hollis_pastor: { relacion: 20 } },
      eventosActivos: [tormenta],
    });
    // Primer turno: 20 + 5 no llega al umbral (30) y la tormenta se cierra al final del turno.
    const uno = texto(e, 'hablar con Hollis');
    assert.equal(efecto(uno, 'conocimiento_revelado'), undefined);
    assert.deepEqual(uno.eventos.cerrados.map((c) => c.id), ['evento_tormenta_verano']);
    // Ya con relación de sobra, sin la tormenta no revela.
    const dos = texto({ ...uno.estado, npcs: { ...uno.estado.npcs, hollis_pastor: { ...uno.estado.npcs.hollis_pastor, relacion: 80 } } }, 'hablar con Hollis');
    assert.equal(efecto(dos, 'conocimiento_revelado'), undefined);
  });

  test('precio: el pan fresco cuesta el doble mientras dura el evento', () => {
    const caro = { id: 'evento_precio_pan_sube', escenaId: 'escena_mercado_circular', turnosRestantes: null, horaFin: { dia: 1, hora: '08:00' } };
    const uno = texto(partida({ eventosActivos: [caro] }), 'comprar pan fresco');
    assert.equal(uno.estado.jugador.bronce, 180);
    assert.deepEqual(uno.eventos.cerrados.map((c) => c.id), ['evento_precio_pan_sube']);
    const dos = texto(uno.estado, 'comprar pan fresco');
    assert.equal(dos.estado.jugador.bronce, 170);
  });
});

describe('turno — eventos y reloj', () => {
  test('los turnos de los eventos se descuentan en todas las escenas', () => {
    const e = partida({
      eventosActivos: [
        { id: 'evento_mercado_aglomeracion', escenaId: 'escena_mercado_circular', turnosRestantes: 3, horaFin: null },
        { id: 'evento_mercado_aglomeracion', escenaId: 'escena_plaza_cambistas', turnosRestantes: 3, horaFin: null },
        { id: 'evento_huida_colinas', escenaId: 'escena_cruce_colinas', turnosRestantes: 1, horaFin: null },
      ],
    });
    const t = texto(e, 'descansar');
    const porTurnos = t.estado.eventosActivos.filter((a) => a.turnosRestantes !== null);
    assert.deepEqual(porTurnos.map((a) => [a.escenaId, a.turnosRestantes]), [
      ['escena_mercado_circular', 2],
      ['escena_plaza_cambistas', 2],
    ]);
    assert.deepEqual(t.eventos.cerrados, [{ id: 'evento_huida_colinas', escenaId: 'escena_cruce_colinas', motivo: 'tiempo' }]);
  });

  test('disparo por acción: atacar a Naela cierra la taberna', () => {
    const e = partida({ jugador: { escenaId: 'escena_taberna_lareth' } });
    const t = texto(e, 'atacar a Naela');
    assert.deepEqual(
      t.eventos.disparados.filter((a) => a.escenaId === 'escena_taberna_lareth').map((a) => a.id),
      ['evento_cierre_taberna'],
    );
    assert.equal(t.escena.estado, 'peligroso');
    assert.equal(texto(t.estado, 'hablar con Naela').accion.motivo, 'bloqueado');
  });

  test('disparo por hora al avanzar el reloj, lejos del jugador', () => {
    const e = partida({ reloj: { dia: 1, hora: '06:00' } });
    const t = texto(e, 'descansar');
    assert.ok(t.eventos.disparados.some((a) => a.id === 'evento_festividad_plaza' && a.escenaId === 'escena_plaza_cambistas'));
  });

  test('disparo por azar en la escena del jugador', () => {
    // El primer valor del rng es el chequeo; con el resto en 0, todo azar dispara hasta llenar la escena.
    const t = texto(partida(), 'observar', rngDe([0.1], 0));
    assert.equal(eventosDeEscena(t.estado.eventosActivos, 'escena_mercado_circular').length, 2);
  });

  test('Sarin se mueve a las 16:00', () => {
    const e = partida({ reloj: { dia: 1, hora: '15:00' } });
    assert.deepEqual(texto(e, 'descansar').npcsMovidos, [
      { npcId: 'sarin_mensajera', desde: 'escena_camino_este', hasta: 'escena_camino_sur' },
    ]);
  });
});

describe('turno — prueba de carga', () => {
  test('400 turnos con generador sembrado: sin errores y con el estado siempre válido', () => {
    const rng = rngSembrado(20261114);
    const elegir = (lista) => lista[Math.floor(rng() * lista.length)];
    const nombresNpc = contenido.npcs.flatMap((n) => n.alias);
    const nombresObjeto = contenido.objetos.map((o) => o.nombre);
    const lugares = ['Ardenhall', 'Lareth', 'Halenor', 'el camino del norte', 'el camino del este', 'el camino del sur',
      'la taberna', 'el archivo', 'la plaza', 'el mercado', 'la biblioteca', 'el aula', 'el lago', 'el puente', 'el cruce', 'la luna'];
    const frase = () => {
      const intencion = elegir(contenido.intenciones);
      const forma = elegir(intencion.formas);
      const extra = rng();
      if (intencion.verbo === 'viajar' || rng() < 0.12) return `viajar a ${elegir(lugares)}`;
      if (extra < 0.35) return `${forma} ${elegir(nombresNpc)}`;
      if (extra < 0.6) return `${forma} ${elegir(nombresObjeto)}`;
      if (extra < 0.65) return 'esto no significa nada';
      return forma;
    };
    const entrada = () => {
      if (rng() < 0.75) return { tipo: 'texto', texto: frase() };
      const parametros = {};
      if (rng() < 0.4) parametros.npcId = elegir(contenido.npcs).id;
      if (rng() < 0.3) parametros.objetoId = elegir(contenido.objetos).id;
      if (rng() < 0.5) parametros.destino = elegir([...contenido.escenas.map((e) => e.id), 'ciudad_lareth', 'ciudad_halenor', 'ciudad_ardenhall']);
      return { tipo: 'boton', intencionId: elegir(contenido.intenciones).id, parametros };
    };

    let estado = estadoInicial(contenido, { rng });
    const escenas = new Set(contenido.escenas.map((e) => e.id));
    const vistos = { tipos: new Set(), verbos: new Set(), escenas: new Set(), efectos: new Set() };
    for (let turno = 0; turno < 400; turno++) {
      const antes = JSON.stringify(estado);
      const t = ejecutarTurno(estado, entrada(), { contenido, rng });
      assert.equal(JSON.stringify(estado), antes, 'el turno modificó el estado recibido');
      assert.notEqual(t.tipo, TIPOS_TURNO.ERROR, t.error);
      estado = t.estado;
      vistos.tipos.add(t.tipo);
      if (t.accion) {
        vistos.verbos.add(t.accion.verbo);
        for (const e of t.accion.efectos) vistos.efectos.add(e.tipo);
        assert.ok(['exito', 'fallo', 'neutro'].includes(t.accion.resultado));
      }
      vistos.escenas.add(estado.jugador.escenaId);

      // Invariantes del estado.
      assert.ok(escenas.has(estado.jugador.escenaId));
      assert.ok(estado.jugador.bronce >= 0 && estado.jugador.plata >= 0);
      for (const [id, n] of Object.entries(estado.npcs)) {
        assert.ok(n.relacion >= -100 && n.relacion <= 100, id);
        assert.ok(n.disposicion >= -2 && n.disposicion <= 2, id);
        assert.ok(!('temor' in n), id);
        assert.ok(n.conocimientosRevelados.length <= 1, id);
        if (n.bloqueadoConocimientos) assert.ok(n.relacion <= 100);
      }
      for (const e of contenido.escenas) assert.ok(eventosDeEscena(estado.eventosActivos, e.id).length <= 2, e.id);
      for (const i of estado.inventario) assert.ok(i.usosRestantes === null || i.usosRestantes > 0, i.objetoId);
      assert.deepEqual(JSON.parse(JSON.stringify(estado)), estado);
    }
    assert.deepEqual([...vistos.tipos].sort(), ['accion', 'ia', 'reformular']);
    assert.ok(vistos.verbos.size >= 20, `verbos ejecutados: ${vistos.verbos.size}`);
    assert.ok(vistos.escenas.size >= 8, `escenas visitadas: ${vistos.escenas.size}`);
    assert.ok(vistos.efectos.has('relacion') && vistos.efectos.has('dinero') && vistos.efectos.has('movimiento'));
  });

  test('la misma semilla da la misma partida', () => {
    const jugar = () => {
      const rng = rngSembrado(7);
      let estado = estadoInicial(contenido, { rng });
      for (const frase of ['trabajar', 'hablar con serel', 'comprar pan duro', 'ir al archivo', 'viajar a halenor', 'leer', 'huir']) {
        estado = ejecutarTurno(estado, { tipo: 'texto', texto: frase }, { contenido, rng }).estado;
      }
      return estado;
    };
    assert.deepEqual(jugar(), jugar());
  });
});
