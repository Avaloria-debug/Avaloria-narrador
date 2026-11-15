import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { leerContenido, cargarContenido } from './cargarContenido.js';
import {
  validarContenido,
  resolverPlantillas,
  indexarContenido,
  exigirContenidoValido,
  CONTEOS,
  RESULTADOS,
  VERBO_A_INTENCION,
} from './contenido.js';
import { CLAVES_REFORMULACION } from './motivos.js';

let base;
before(async () => {
  base = await leerContenido();
});
const copia = () => structuredClone(base);
const errores = (c) => validarContenido(c).errores;
const hay = (c, patron) => assert.ok(errores(c).some((e) => patron.test(e)), `sin error ${patron}: ${errores(c).join(' | ')}`);

describe('contenido — archivo real', () => {
  test('es válido y cumple los conteos', () => {
    const r = validarContenido(base);
    assert.deepEqual(r.errores, []);
    assert.equal(r.ok, true);
    assert.deepEqual(r.conteos, { ...CONTEOS });
  });

  test('cargarContenido devuelve el contenido validado', async () => {
    const c = await cargarContenido();
    assert.equal(c.escenas.length, 12);
  });

  test('cargarContenido lanza si la ruta no existe', async () => {
    await assert.rejects(() => cargarContenido('/no/existe.json'), /No se encontró/);
  });

  test('validar no modifica el contenido', () => {
    const c = copia();
    validarContenido(c);
    assert.deepEqual(c, base);
  });
});

describe('contenido — conteos y estructura', () => {
  test('rechaza lo que no es un objeto', () => {
    assert.equal(validarContenido(null).ok, false);
    assert.equal(validarContenido([]).ok, false);
  });

  test('detecta un conteo distinto', () => {
    const c = copia();
    c.escenas.pop();
    hay(c, /conteo de escenas: 11/);
  });

  test('detecta una clave faltante', () => {
    const c = copia();
    delete c.eventos;
    hay(c, /eventos: falta/);
  });

  test('detecta ids repetidos', () => {
    const c = copia();
    c.npcs[1].id = c.npcs[0].id;
    hay(c, /npcs: id repetido/);
  });
});

describe('contenido — referencias', () => {
  test('salida a una escena inexistente', () => {
    const c = copia();
    c.escenas[0].salidas.push('escena_fantasma');
    hay(c, /salidas: escena inexistente "escena_fantasma"/);
  });

  test('escena de un NPC', () => {
    const c = copia();
    c.npcs[0].escenaInicialId = 'Archivo Real';
    hay(c, /escenaInicialId: "Archivo Real" es un nombre, no un id; va escena_archivo_real/);
  });

  test('escenas de un evento: inexistente y vacías', () => {
    const c = copia();
    c.eventos[0].escenas = ['escena_fantasma'];
    c.eventos[1].escenas = [];
    hay(c, new RegExp(`${c.eventos[0].id}\\.escenas: escena inexistente`));
    hay(c, new RegExp(`${c.eventos[1].id}: escenas vacías`));
  });

  test('NPC de un objeto narrativo', () => {
    const c = copia();
    const o = c.objetos.find((x) => x.tipo === 'narrativo');
    o.npcAsociado = 'Ysolde Varn';
    hay(c, /npcAsociado: "Ysolde Varn" es un nombre, no un id; va ysolde_pescadora/);
  });

  test('verbo de una intención: inexistente o cruzado', () => {
    const c = copia();
    c.intenciones[0].verbo = 'Hablar con...';
    hay(c, /verbo inexistente/);
    const d = copia();
    d.intenciones[0].verbo = 'usar';
    hay(d, /corresponde a intencion_usar/);
  });

  test('efecto de evento con NPC inexistente es un error', () => {
    const c = copia();
    const ev = c.eventos.find((e) => e.efectos.some((f) => f.npcId));
    ev.efectos.find((f) => f.npcId).npcId = 'nadie';
    hay(c, /efectos\[\d+\]\.npcId: NPC inexistente "nadie"/);
  });

  test('el archivo real no tiene avisos', () => {
    assert.deepEqual(validarContenido(base).avisos, []);
  });

  const avisa = (c, patron) => {
    const r = validarContenido(c);
    assert.ok(r.avisos.some((a) => patron.test(a)), `sin aviso ${patron}: ${r.avisos.join(' | ')}`);
  };
  const evento = (c, id) => c.eventos.find((e) => e.id === id);

  test('destino acepta ciudad_* del vocabulario y rechaza otros', () => {
    const c = copia();
    evento(c, 'evento_cierre_puerta').efectos[0].destino = 'ciudad_halenor';
    assert.deepEqual(validarContenido(c).avisos, []);
    evento(c, 'evento_cierre_puerta').efectos[0].destino = 'ciudad_fantasma';
    hay(c, /destino: escena inexistente "ciudad_fantasma"/);
  });

  test('salir_escena vale en fin.verbos, no como verbo de intención', () => {
    assert.ok(evento(base, 'evento_patrulla_busqueda').fin.verbos.includes('salir_escena'));
    const c = copia();
    c.intenciones[0].verbo = 'salir_escena';
    hay(c, /verbo inexistente "salir_escena"/);
  });

  test('duracion.verbos es una lista de verbos', () => {
    assert.deepEqual(evento(base, 'evento_emboscada_sur').duracion.verbos, ['huir', 'rendirse']);
    const c = copia();
    evento(c, 'evento_emboscada_sur').duracion.verbos = ['huir_o_rendirse'];
    hay(c, /duracion\.verbos: verbo inexistente/);
  });

  test('disparo.escenas y fin por acción sin verbos', () => {
    const c = copia();
    evento(c, 'evento_guardias_persiguen').disparo.escenas = ['ciudad'];
    evento(c, 'evento_lucha_caseta').fin.verbos = [];
    hay(c, /disparo\.escenas: escena inexistente "ciudad"/);
    avisa(c, /evento_lucha_caseta\.fin: fin por acción sin verbos/);
  });
});

describe('contenido — nombres en lugar de ids', () => {
  const evento = (c, id) => c.eventos.find((e) => e.id === id);

  test('disparo.objetivo del archivo real usa ids de NPC', () => {
    assert.equal(evento(base, 'evento_cierre_taberna').disparo.objetivo, 'naela_tabernera');
    assert.equal(evento(base, 'evento_lucha_caseta').disparo.objetivo, 'dario_guardia');
  });

  test('disparo.objetivo con primer nombre, nombre completo o id inexistente falla', () => {
    for (const [valor, patron] of [
      ['Darío', /disparo\.objetivo: "Darío" es un nombre, no un id; va dario_guardia/],
      ['dario', /disparo\.objetivo: "dario" es un nombre, no un id; va dario_guardia/],
      [base.npcs[0].nombre, /disparo\.objetivo: .* es un nombre, no un id; va maren_archivista/],
      ['nadie_guardia', /disparo\.objetivo: NPC inexistente "nadie_guardia"/],
      ['escena_puente_aduana', /disparo\.objetivo: NPC inexistente/],
    ]) {
      const c = copia();
      evento(c, 'evento_lucha_caseta').disparo.objetivo = valor;
      const r = validarContenido(c);
      assert.equal(r.ok, false);
      assert.ok(r.errores.some((e) => patron.test(e)), `${valor}: ${r.errores.join(' | ')}`);
    }
  });

  test('un nombre falla en cada campo de referencia', () => {
    const escena = base.escenas[0];
    const npc = base.npcs[0];
    const objeto = base.objetos[0];
    const ev = base.eventos[0];
    const conEfecto = (c, campo) => c.eventos.flatMap((e) => e.efectos).find((f) => f[campo] != null);
    const casos = [
      ['escenas.salidas', (c) => c.escenas[1].salidas.push(escena.nombre), escena.id],
      ['npcs.movimiento.caminos', (c) => c.npcs.find((n) => n.movimiento).movimiento.caminos.push(escena.nombre), escena.id],
      ['npcs.conocimientos.requiereEvento', (c) => (c.npcs[0].conocimientos[0].requiereEvento = ev.nombre), ev.id],
      ['objetos.escenaVenta', (c) => (c.objetos[0].escenaVenta = escena.nombre), escena.id],
      ['objetos.escenaAparece', (c) => (c.objetos[0].escenaAparece = escena.nombre), escena.id],
      ['objetos.npcAsociado', (c) => (c.objetos[0].npcAsociado = npc.nombre), npc.id],
      ['eventos.escenas', (c) => c.eventos[0].escenas.push(escena.nombre), escena.id],
      ['eventos.disparo.escena', (c) => (c.eventos[0].disparo.escena = escena.nombre), escena.id],
      ['eventos.disparo.escenas', (c) => (c.eventos[0].disparo.escenas = [escena.nombre]), escena.id],
      ['eventos.efectos.npcId', (c) => (conEfecto(c, 'npcId').npcId = npc.nombre), npc.id],
      ['eventos.efectos.objetoId', (c) => (conEfecto(c, 'objetoId').objetoId = objeto.nombre), objeto.id],
      ['eventos.efectos.escenaId', (c) => (conEfecto(c, 'escenaId').escenaId = escena.nombre), escena.id],
      ['eventos.efectos.destino', (c) => (conEfecto(c, 'destino').destino = escena.nombre), escena.id],
    ];
    for (const [campo, romper, id] of casos) {
      const c = copia();
      romper(c);
      const r = validarContenido(c);
      assert.equal(r.ok, false, campo);
      assert.ok(
        r.errores.some((e) => e.includes(`es un nombre, no un id; va ${id}`)),
        `${campo}: ${r.errores.join(' | ')}`,
      );
    }
  });

  test('los nombres se reconocen sin tildes ni mayúsculas', () => {
    const c = copia();
    c.npcs[0].escenaInicialId = 'ARCHIVO REAL';
    hay(c, /va escena_archivo_real/);
  });

  test('verbos con nombre de la interfaz fallan en eventos', () => {
    const c = copia();
    evento(c, 'evento_lucha_caseta').disparo.verbo = 'Atacar';
    evento(c, 'evento_lucha_caseta').fin.verbos = ['Huir'];
    c.objetos[0].utilizableComo = ['Defender'];
    hay(c, /disparo\.verbo: verbo inexistente "Atacar"/);
    hay(c, /fin\.verbos: verbo inexistente "Huir"/);
    hay(c, /utilizableComo: verbo inexistente "Defender"/);
  });

  test('conocimientoId de un efecto tiene que existir en ese NPC', () => {
    const c = copia();
    const ef = c.eventos.flatMap((e) => e.efectos).find((f) => f.conocimientoId);
    ef.conocimientoId = 'Sendero sin vigilancia en las colinas';
    hay(c, /conocimientoId: conocimiento inexistente/);
  });
});

describe('contenido — conocimientos y marcas', () => {
  const npc = (c, id) => c.npcs.find((n) => n.id === id);
  const objeto = (c, id) => c.objetos.find((o) => o.id === id);

  test('archivo real: ids de conocimiento, marca leyo y narrativos por id', () => {
    assert.equal(npc(base, 'maren_archivista').conocimientos[0].id, 'conocimiento_maren_1');
    assert.equal(npc(base, 'hollis_pastor').conocimientos[0].id, 'conocimiento_sendero_sin_vigilancia');
    assert.equal(npc(base, 'elia_bibliotecaria').conocimientos[0].requiereMarca, 'leyo');
    assert.equal(npc(base, 'oren_peregrino').conocimientos[0].requiereMarca, 'leyo');
    const narrativos = base.objetos.filter((o) => o.tipo === 'narrativo');
    assert.equal(narrativos.length, 12);
    for (const o of narrativos) {
      assert.equal(o.conocimientoDesbloquea, npc(base, o.npcAsociado).conocimientos[0].id, o.id);
    }
  });

  test('requiereMarca tiene que existir en reglas.marcas', () => {
    const c = copia();
    npc(c, 'elia_bibliotecaria').conocimientos[0].requiereMarca = 'Marca "leyó"';
    hay(c, /elia_bibliotecaria\.conocimientos\[0\]\.requiereMarca: marca inexistente/);
    const d = copia();
    delete d.reglas.marcas.leyo;
    hay(d, /requiereMarca: marca inexistente "leyo"/);
    const e = copia();
    npc(e, 'maren_archivista').conocimientos[0].requiereMarca = 'constructor';
    hay(e, /requiereMarca: marca inexistente "constructor"/);
  });

  test('conocimientoDesbloquea: id inexistente, texto libre, faltante o de otro NPC', () => {
    for (const valor of ['conocimiento_fantasma_1', 'Dónde está la copia del tratado', undefined, 'conocimiento_serel_1']) {
      const c = copia();
      objeto(c, 'objeto_sello_archivo').conocimientoDesbloquea = valor;
      hay(c, /objeto_sello_archivo\.conocimientoDesbloquea: conocimiento inexistente/);
    }
  });

  test('id de conocimiento repetido entre NPCs o dentro del mismo NPC', () => {
    const c = copia();
    npc(c, 'serel_panadero').conocimientos[0].id = 'conocimiento_maren_1';
    hay(c, /serel_panadero\.conocimientos\[0\]: id de conocimiento repetido conocimiento_maren_1/);
    const d = copia();
    const m = npc(d, 'maren_archivista');
    m.conocimientos.push({ ...m.conocimientos[0] });
    hay(d, /maren_archivista\.conocimientos\[1\]: id de conocimiento repetido/);
  });

  test('conocimiento sin id o con id mal formado', () => {
    const c = copia();
    delete npc(c, 'maren_archivista').conocimientos[0].id;
    hay(c, /maren_archivista\.conocimientos\[0\]: id de conocimiento inválido/);
    const d = copia();
    npc(d, 'maren_archivista').conocimientos[0].id = 'Tratado de las Dos Coronas';
    hay(d, /id de conocimiento inválido/);
  });

  test('reglas: usadaPor de la marca y conocimiento del sendero', () => {
    const c = copia();
    c.reglas.marcas.leyo.usadaPor.push('Elia');
    c.reglas.conocimientoSenderoSinVigilancia.id = 'conocimiento_otro';
    hay(c, /reglas\.marcas\.leyo\.usadaPor: "Elia" es un nombre, no un id; va elia_bibliotecaria/);
    hay(c, /reglas\.conocimientoSenderoSinVigilancia\.id: conocimiento inexistente/);
  });
});

describe('contenido — alias de NPC', () => {
  const npc = (c, id) => c.npcs.find((n) => n.id === id);

  test('archivo real: los 12 NPCs tienen los alias de comprension-v1.md', () => {
    assert.deepEqual(npc(base, 'ivor_cambista').alias, ['ivor', 'cambista', 'aster', 'prestamista']);
    assert.deepEqual(npc(base, 'dario_guardia').alias, ['dario', 'guardia', 'aduanero', 'keth']);
    for (const n of base.npcs) assert.ok(n.alias.length >= 3, n.id);
  });

  test('alias faltante, vacío, no lista o con valores inválidos', () => {
    for (const valor of [undefined, [], 'maren', null]) {
      const c = copia();
      npc(c, 'maren_archivista').alias = valor;
      hay(c, /maren_archivista: alias falta o no es una lista/);
    }
    for (const valor of ['', '   ', 7, null]) {
      const c = copia();
      npc(c, 'maren_archivista').alias.push(valor);
      hay(c, /maren_archivista\.alias: alias vacío o no textual/);
    }
  });

  test('alias repetido dentro del mismo NPC', () => {
    const c = copia();
    npc(c, 'maren_archivista').alias.push('Máren');
    hay(c, /maren_archivista\.alias: alias repetido/);
  });

  test('alias repetido entre NPCs de la misma escena', () => {
    const c = copia();
    npc(c, 'serel_panadero').escenaInicialId = 'escena_archivo_real';
    npc(c, 'serel_panadero').alias.push('Archivista');
    hay(c, /serel_panadero\.alias: "archivista" también es alias de maren_archivista en escena_archivo_real/);
  });

  test('cuenta las escenas a las que un NPC se mueve', () => {
    const c = copia();
    // Sarin rota por el camino del sur, donde está Hollis.
    npc(c, 'sarin_mensajera').alias.push('pastor');
    hay(c, /hollis_pastor\.alias: "pastor" también es alias de sarin_mensajera en escena_camino_sur/);
  });

  test('el mismo alias en escenas distintas no es un error', () => {
    const c = copia();
    npc(c, 'serel_panadero').alias.push('archivista');
    assert.deepEqual(errores(c), []);
  });
});

describe('contenido — reformulaciones y viaje dentro de la ciudad', () => {
  test('archivo real: una clave por motivo, más repetir_segunda', () => {
    assert.deepEqual(Object.keys(base.plantillas.reformulacion).sort(), [...CLAVES_REFORMULACION].sort());
    assert.equal(CLAVES_REFORMULACION.length, 13);
    assert.deepEqual(base.plantillas.reformulacion.ya_en_destino, ['Ya estás en {lugar}.']);
  });

  test('el bloque reformulacion no cuenta entre los 26 bloques de resultado', () => {
    assert.equal(Object.keys(base.plantillas).length, 27);
    assert.equal(validarContenido(base).conteos.plantillas, 26);
  });

  test('falta el bloque', () => {
    const c = copia();
    delete c.plantillas.reformulacion;
    hay(c, /plantillas: falta el bloque reformulacion/);
  });

  test('falta un motivo o repetir_segunda: error que bloquea', () => {
    for (const clave of CLAVES_REFORMULACION) {
      const c = copia();
      delete c.plantillas.reformulacion[clave];
      const r = validarContenido(c);
      assert.equal(r.ok, false, clave);
      assert.ok(r.errores.includes(`plantillas.reformulacion: sin texto para ${clave}`), clave);
    }
  });

  test('lista vacía, texto vacío y clave que no es un motivo', () => {
    const c = copia();
    c.plantillas.reformulacion.sin_npcs = [];
    c.plantillas.reformulacion.npc_ausente = ['  '];
    c.plantillas.reformulacion.otro_motivo = ['¿Qué?'];
    hay(c, /plantillas\.reformulacion: sin texto para sin_npcs/);
    hay(c, /plantillas\.reformulacion\.npc_ausente: texto vacío o no textual/);
    hay(c, /plantillas\.reformulacion: clave sin motivo otro_motivo/);
  });

  test('reglas.viajeHorasIntraCiudad y viajeHorasLugarCamino: obligatorios y mayores que 0', () => {
    assert.equal(base.reglas.viajeHorasIntraCiudad, 1);
    assert.equal(base.reglas.viajeHorasLugarCamino, 1);
    for (const regla of ['viajeHorasIntraCiudad', 'viajeHorasLugarCamino']) {
      for (const valor of [undefined, 0, -1, '1', null]) {
        const c = copia();
        c.reglas[regla] = valor;
        hay(c, new RegExp(`reglas\\.${regla}: falta o no es un número mayor que 0`));
      }
    }
  });

  test('reglas.costoHorasPorVerbo: todo verbo de intenciones tiene costo, salvo viajar', () => {
    assert.deepEqual(errores(base), []);
    assert.ok(!('viajar' in base.reglas.costoHorasPorVerbo));
    let c = copia();
    delete c.reglas.costoHorasPorVerbo;
    hay(c, /reglas\.costoHorasPorVerbo: falta o no es un objeto/);
    c = copia();
    delete c.reglas.costoHorasPorVerbo.descansar;
    hay(c, /reglas\.costoHorasPorVerbo: falta el verbo "descansar"/);
    c = copia();
    c.reglas.costoHorasPorVerbo.volar = 1;
    hay(c, /reglas\.costoHorasPorVerbo\.volar: no es un verbo de intenciones/);
    for (const valor of [-1, 0.5, '1', null]) {
      c = copia();
      c.reglas.costoHorasPorVerbo.trabajar = valor;
      hay(c, /reglas\.costoHorasPorVerbo\.trabajar: no es un entero mayor o igual que 0/);
    }
  });

  test('toda intención tiene al menos 3 plantillas distintas en exito y en fallo', () => {
    for (const it of base.intenciones) {
      for (const r of ['exito', 'fallo']) assert.equal(new Set(base.plantillas[it.id][r]).size, 3, `${it.id}.${r}`);
    }
    let c = copia();
    c.plantillas.intencion_usar.exito.pop();
    hay(c, /plantillas\.intencion_usar\.exito: tiene 2 plantillas distintas; hacen falta al menos 3/);
    c = copia();
    c.plantillas.intencion_viajar.fallo[2] = c.plantillas.intencion_viajar.fallo[0];
    hay(c, /plantillas\.intencion_viajar\.fallo: tiene 2 plantillas distintas; hacen falta al menos 3/);
    // neutro y los bloques sin intención no entran en la regla.
    c = copia();
    c.plantillas.intencion_usar.neutro = [c.plantillas.intencion_usar.neutro[0]];
    c.plantillas.mostrar_narrativo.exito = [c.plantillas.mostrar_narrativo.exito[0]];
    assert.deepEqual(errores(c), []);
  });

  test('la apertura no se repite entre las plantillas de exito ni entre las de fallo', () => {
    assert.deepEqual(errores(base), []);
    let c = copia();
    c.plantillas.intencion_usar.exito[2] = `Usás otra cosa y ${c.plantillas.intencion_usar.exito[2]}`;
    hay(c, /plantillas\.intencion_usar\.exito: la apertura "usás" se repite/);
    c = copia();
    c.plantillas.intencion_hablar_con.fallo = ['{npc} calla.', '¡{npc}, nada!', 'Sin ganas, {npc} contesta.'];
    hay(c, /plantillas\.intencion_hablar_con\.fallo: la apertura "\{npc\}" se repite/);
    // neutro no entra en la regla.
    c = copia();
    c.plantillas.intencion_explorar.neutro = ['Caminás un rato.', 'Caminás otro rato.'];
    assert.deepEqual(errores(c), []);
  });

  test('sin temor en el contenido', () => {
    assert.ok(!/temor/i.test(JSON.stringify(base)));
  });
});

describe('contenido — reloj, viaje y forma de los eventos', () => {
  const evento = (c, id) => c.eventos.find((e) => e.id === id);

  test('reglas.relojInicial trae una hora', () => {
    const c = copia();
    c.reglas.relojInicial = 'a la mañana';
    hay(c, /reglas\.relojInicial: no trae una hora HH:MM/);
  });

  test('reglas.viajeHorasPorCamino: escenas existentes y horas mayores que 0', () => {
    const c = copia();
    c.reglas.viajeHorasPorCamino.escena_camino_oeste = 10;
    c.reglas.viajeHorasPorCamino.escena_camino_sur = 0;
    hay(c, /reglas\.viajeHorasPorCamino: escena inexistente "escena_camino_oeste"/);
    hay(c, /reglas\.viajeHorasPorCamino\.escena_camino_sur: no es un número mayor que 0/);
  });

  test('disparo: probabilidad, hora y verbo', () => {
    const c = copia();
    evento(c, 'evento_mercado_aglomeracion').disparo.p = 1.5;
    evento(c, 'evento_festividad_plaza').disparo.valor = '7 de la mañana';
    delete evento(c, 'evento_huida_colinas').disparo.verbo;
    hay(c, /evento_mercado_aglomeracion\.disparo\.p: no es una probabilidad/);
    hay(c, /evento_festividad_plaza\.disparo\.valor: no es una hora HH:MM/);
    hay(c, /evento_huida_colinas\.disparo: disparo por acción sin verbo/);
  });

  test('duración y fin', () => {
    const c = copia();
    evento(c, 'evento_mercado_aglomeracion').duracion = { tipo: 'turnos', n: 0 };
    evento(c, 'evento_festividad_plaza').duracion = { tipo: 'hasta_hora', valor: '25:00' };
    evento(c, 'evento_lluvia_suave').duracion = { tipo: 'turnos', n: 3 };
    evento(c, 'evento_huida_colinas').duracion = { tipo: 'hasta_accion', verbo: 'huir' };
    evento(c, 'evento_cierre_puerta').duracion = { tipo: 'un rato' };
    hay(c, /evento_mercado_aglomeracion\.duracion\.n: no es un entero mayor que 0/);
    hay(c, /evento_festividad_plaza\.duracion\.valor: no es una hora HH:MM/);
    hay(c, /evento_lluvia_suave: fin por hora sin hora ni duración en horas/);
    hay(c, /evento_huida_colinas: fin por tiempo sin duración en turnos ni horas/);
    hay(c, /evento_cierre_puerta: duracion inválida/);
  });
});

describe('contenido — grafo de escenas', () => {
  const escena = (c, id) => c.escenas.find((e) => e.id === id);

  test('archivo real: cada salida tiene su inversa', () => {
    for (const e of base.escenas) {
      for (const s of e.salidas) assert.ok(escena(base, s).salidas.includes(e.id), `${s} no lista a ${e.id}`);
    }
  });

  test('archivo real: las ciudades salen a sus caminos y la taberna solo a la plaza', () => {
    assert.deepEqual(escena(base, 'escena_mercado_circular').salidas, ['escena_archivo_real', 'escena_camino_norte']);
    assert.deepEqual(escena(base, 'escena_plaza_cambistas').salidas, [
      'escena_taberna_lareth',
      'escena_camino_norte',
      'escena_camino_este',
    ]);
    assert.deepEqual(escena(base, 'escena_archivo_real').salidas, ['escena_mercado_circular', 'escena_camino_sur']);
    assert.deepEqual(escena(base, 'escena_biblioteca_publica').salidas, ['escena_aula_cartografia', 'escena_camino_sur']);
    assert.deepEqual(escena(base, 'escena_aula_cartografia').salidas, ['escena_biblioteca_publica', 'escena_camino_este']);
    assert.deepEqual(escena(base, 'escena_taberna_lareth').salidas, ['escena_plaza_cambistas']);
  });

  test('salida sin inversa: error que bloquea', () => {
    const c = copia();
    escena(c, 'escena_taberna_lareth').salidas.push('escena_camino_este');
    const r = validarContenido(c);
    assert.equal(r.ok, false);
    assert.ok(r.errores.includes('escena_taberna_lareth.salidas: escena_camino_este no tiene a escena_taberna_lareth en sus salidas'));
    const d = copia();
    escena(d, 'escena_mercado_circular').salidas = ['escena_archivo_real'];
    hay(d, /escena_camino_norte\.salidas: escena_mercado_circular no tiene a escena_camino_norte/);
  });

  test('salida a sí misma o repetida', () => {
    const c = copia();
    escena(c, 'escena_taberna_lareth').salidas.push('escena_taberna_lareth', 'escena_plaza_cambistas');
    hay(c, /escena_taberna_lareth\.salidas: la escena se lista a sí misma/);
    hay(c, /escena_taberna_lareth\.salidas: salida repetida/);
  });
});

describe('contenido — plantillas', () => {
  test('cada intención necesita exito, fallo y neutro', () => {
    for (const r of RESULTADOS) {
      const c = copia();
      delete c.plantillas.intencion_usar[r];
      hay(c, new RegExp(`plantillas\\.intencion_usar: sin plantillas para ${r}`));
    }
  });

  test('lista vacía y bloque faltante', () => {
    const c = copia();
    c.plantillas.intencion_leer.fallo = [];
    delete c.plantillas.mostrar_narrativo;
    hay(c, /intencion_leer: sin plantillas para fallo/);
    hay(c, /falta el bloque mostrar_narrativo/);
  });

  test('bloque que no corresponde a ninguna intención', () => {
    const c = copia();
    c.plantillas.intencion_volar = c.plantillas.intencion_usar;
    hay(c, /bloque sin intención intencion_volar/);
  });
});

describe('resolverPlantillas — mapeo de claves de la beta', () => {
  test('resultado_<verbo>_<resultado> para los 24 verbos', () => {
    for (const [verbo, intencionId] of Object.entries(VERBO_A_INTENCION)) {
      for (const r of RESULTADOS) {
        assert.equal(resolverPlantillas(base, `resultado_${verbo}_${r}`), base.plantillas[intencionId][r]);
      }
    }
  });

  test('calmar_la_situacion resuelve a intencion_calmar', () => {
    assert.equal(
      resolverPlantillas(base, 'resultado_calmar_la_situacion_exito'),
      base.plantillas.intencion_calmar.exito,
    );
  });

  test('acepta id de bloque más resultado', () => {
    assert.equal(resolverPlantillas(base, 'revelar_conocimiento', 'exito'), base.plantillas.revelar_conocimiento.exito);
    assert.equal(resolverPlantillas(base, 'intencion_viajar', 'fallo'), base.plantillas.intencion_viajar.fallo);
    assert.equal(resolverPlantillas(base, 'viajar', 'neutro'), base.plantillas.intencion_viajar.neutro);
  });

  test('devuelve null si no existe', () => {
    assert.equal(resolverPlantillas(base, 'resultado_volar_exito'), null);
    assert.equal(resolverPlantillas(base, 'resultado_usar_quizas'), null);
    assert.equal(resolverPlantillas(base, 'intencion_usar', 'quizas'), null);
    assert.equal(resolverPlantillas(base, 'constructor', 'exito'), null);
    assert.equal(resolverPlantillas(null, 'resultado_usar_exito'), null);
  });
});

describe('índices y exigirContenidoValido', () => {
  test('indexa por id y por verbo', () => {
    const idx = indexarContenido(base);
    assert.equal(idx.escenas.get('escena_mercado_circular').nombre, 'Mercado Circular');
    assert.equal(idx.intencionPorVerbo.get('calmar_la_situacion').id, 'intencion_calmar');
    assert.equal(idx.eventos.size, 70);
  });

  test('exigirContenidoValido lanza con la lista de errores', () => {
    const c = copia();
    c.objetos.pop();
    assert.throws(() => exigirContenidoValido(c), /conteo de objetos: 39/);
    assert.equal(exigirContenidoValido(base), base);
  });
});
