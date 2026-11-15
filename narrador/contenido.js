// Contenido del narrador: validación, índices y resolución de plantillas.
// Módulo puro (sin fs ni APIs de navegador). La lectura del archivo está en cargarContenido.js.

export const CONTEOS = Object.freeze({
  escenas: 12,
  npcs: 12,
  objetos: 40,
  eventos: 70,
  intenciones: 24,
  plantillas: 26,
});

import { BLOQUE_REFORMULACION, CLAVES_REFORMULACION } from './motivos.js';
import { esHora, relojInicial } from './reloj.js';

export const RESULTADOS = Object.freeze(['exito', 'fallo', 'neutro']);
export const BLOQUES_EXTRA = Object.freeze(['revelar_conocimiento', 'mostrar_narrativo']);

// vocabulario-v1.md, sección 5: id de verbo -> id de intención.
export const VERBO_A_INTENCION = Object.freeze({
  explorar: 'intencion_explorar',
  descansar: 'intencion_descansar',
  observar: 'intencion_observar',
  trabajar: 'intencion_trabajar',
  comprar: 'intencion_comprar',
  leer: 'intencion_leer',
  ayudar: 'intencion_ayudar',
  negociar: 'intencion_negociar',
  presionar: 'intencion_presionar',
  retirarse: 'intencion_retirarse',
  huir: 'intencion_huir',
  atacar: 'intencion_atacar',
  emboscar: 'intencion_emboscar',
  calmar_la_situacion: 'intencion_calmar',
  ocultarse: 'intencion_ocultarse',
  avanzar_cautela: 'intencion_avanzar_cautela',
  distraer: 'intencion_distraer',
  abortar: 'intencion_abortar',
  defender: 'intencion_defender',
  rendirse: 'intencion_rendirse',
  hablar_con: 'intencion_hablar_con',
  examinar: 'intencion_examinar',
  usar: 'intencion_usar',
  viajar: 'intencion_viajar',
});

// vocabulario-v1.md, secciones 7 a 12.
export const ESTADOS_ESCENA = Object.freeze(['tranquilo', 'social', 'sigilo', 'tenso', 'peligroso', 'combate']);
export const CATEGORIAS_ESCENA = Object.freeze(['ciudad', 'mercado', 'conocimiento', 'camino', 'bosque', 'frontera']);
export const TIPOS_OBJETO = Object.freeze(['arma', 'herramienta', 'consumible', 'narrativo']);
export const CATEGORIAS_EVENTO = Object.freeze([...ESTADOS_ESCENA, 'neutro']);
export const TIPOS_FIN = Object.freeze(['tiempo', 'hora', 'accion']);
export const TIPOS_DISPARO = Object.freeze(['azar', 'hora', 'accion']);
// vocabulario-v1.md, sección 5b: destinos de viaje que no son escenas.
export const DESTINOS_CIUDAD = Object.freeze(['ciudad_ardenhall', 'ciudad_lareth', 'ciudad_halenor']);
// vocabulario-v1.md, sección 5c: pseudo-verbos. Solo valen en `fin.verbos` y `duracion` de eventos.
export const PSEUDO_VERBOS = Object.freeze(['salir_escena']);
export const TIPOS_DURACION = Object.freeze(['turnos', 'horas', 'hasta_hora', 'hasta_accion', 'hasta_salida_escena']);
export const TIPOS_EFECTO = Object.freeze(['disposicion', 'bloqueo', 'habilita', 'precio']);

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v : []);

// Plantillas distintas que necesita cada intención en exito y en fallo.
export const MIN_VARIANTES = 3;

/**
 * Valida el contenido. No lanza: devuelve todo lo encontrado.
 * `errores`: conteos, estructura, plantillas y toda referencia a un id (escena, NPC, objeto,
 *   evento, verbo, destino, conocimiento). Un nombre donde va un id es un error. Bloquean.
 * `avisos`: observaciones que no son referencias (por ejemplo, fin por acción sin verbos). No bloquean.
 * @returns {{ ok: boolean, errores: string[], avisos: string[], conteos: Record<string, number> }}
 */
export function validarContenido(contenido) {
  const errores = [];
  const avisos = [];
  const err = (m) => errores.push(m);
  const aviso = (m) => avisos.push(m);

  if (!esObjeto(contenido)) {
    return { ok: false, errores: ['el contenido no es un objeto'], avisos: [], conteos: {} };
  }

  // --- Estructura y conteos ---
  const conteos = {};
  for (const clave of ['escenas', 'npcs', 'objetos', 'eventos', 'intenciones']) {
    if (!Array.isArray(contenido[clave])) {
      err(`${clave}: falta o no es una lista`);
      conteos[clave] = 0;
    } else {
      conteos[clave] = contenido[clave].length;
    }
  }
  const plantillas = esObjeto(contenido.plantillas) ? contenido.plantillas : null;
  if (!plantillas) err('plantillas: falta o no es un objeto');
  // El conteo es de bloques de resultado; el bloque de reformulaciones va aparte.
  conteos.plantillas = plantillas ? Object.keys(plantillas).filter((k) => k !== BLOQUE_REFORMULACION).length : 0;
  if (!esObjeto(contenido.transiciones)) err('transiciones: falta o no es un objeto');
  if (!esObjeto(contenido.reglas)) err('reglas: falta o no es un objeto');

  for (const [clave, meta] of Object.entries(CONTEOS)) {
    if (conteos[clave] !== meta) err(`conteo de ${clave}: ${conteos[clave]}, se esperaban ${meta}`);
  }

  // --- Ids únicos ---
  const ids = {};
  for (const clave of ['escenas', 'npcs', 'objetos', 'eventos', 'intenciones']) {
    const vistos = new Set();
    for (const [i, item] of lista(contenido[clave]).entries()) {
      const id = esObjeto(item) ? item.id : undefined;
      if (typeof id !== 'string' || id === '') err(`${clave}[${i}]: sin id`);
      else if (vistos.has(id)) err(`${clave}: id repetido ${id}`);
      else vistos.add(id);
    }
    ids[clave] = vistos;
  }
  const verbos = new Set(Object.keys(VERBO_A_INTENCION));
  // Nombre para el jugador -> id, para señalar cuando se usó un nombre donde va un id.
  // Los NPCs también se buscan por su primer nombre ("Darío" -> dario_guardia).
  const clave = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const nombres = { escenas: new Map(), npcs: new Map(), objetos: new Map(), eventos: new Map() };
  for (const [tipo, mapa] of Object.entries(nombres)) {
    for (const item of lista(contenido[tipo])) {
      if (!esObjeto(item) || typeof item.nombre !== 'string') continue;
      mapa.set(clave(item.nombre), item.id);
      if (tipo === 'npcs') mapa.set(clave(item.nombre.split(' ')[0]), item.id);
    }
  }
  const ref = (tipo, etiqueta) => (id, donde) => {
    if (ids[tipo].has(id)) return;
    const sugerido = typeof id === 'string' ? nombres[tipo].get(clave(id)) : undefined;
    err(
      sugerido
        ? `${donde}: ${JSON.stringify(id)} es un nombre, no un id; va ${sugerido}`
        : `${donde}: ${etiqueta} inexistente ${JSON.stringify(id)}`,
    );
  };
  const refEscena = ref('escenas', 'escena');
  const refNpc = ref('npcs', 'NPC');
  const refObjeto = ref('objetos', 'objeto');
  const refEvento = ref('eventos', 'evento');
  const refVerboDeFin = (v, donde) => {
    if (!verbos.has(v) && !PSEUDO_VERBOS.includes(v)) err(`${donde}: verbo inexistente ${JSON.stringify(v)}`);
  };
  const refVerbo = (v, donde) => {
    if (!verbos.has(v)) err(`${donde}: verbo inexistente ${JSON.stringify(v)}`);
  };
  // Conocimientos: id obligatorio, con formato y único en todo el contenido.
  const conocimientosPorNpc = new Map();
  const conocimientoVisto = new Map();
  for (const n of lista(contenido.npcs)) {
    if (!esObjeto(n)) continue;
    const propios = new Set();
    conocimientosPorNpc.set(n.id, propios);
    for (const [i, k] of lista(n.conocimientos).entries()) {
      const donde = `${n.id}.conocimientos[${i}]`;
      const id = esObjeto(k) ? k.id : undefined;
      if (typeof id !== 'string' || !/^conocimiento_[a-z0-9_]+$/.test(id)) {
        err(`${donde}: id de conocimiento inválido ${JSON.stringify(id)}`);
      } else if (conocimientoVisto.has(id)) {
        err(`${donde}: id de conocimiento repetido ${id} (ya está en ${conocimientoVisto.get(id)})`);
      } else {
        conocimientoVisto.set(id, donde);
        propios.add(id);
      }
    }
  }
  const marcas = esObjeto(contenido.reglas?.marcas) ? contenido.reglas.marcas : {};

  // --- Escenas ---
  for (const e of lista(contenido.escenas)) {
    if (!esObjeto(e)) continue;
    if (!CATEGORIAS_ESCENA.includes(e.categoria)) err(`${e.id}: categoria inválida ${JSON.stringify(e.categoria)}`);
    if (!Array.isArray(e.salidas)) err(`${e.id}: salidas no es una lista`);
    for (const s of lista(e.salidas)) refEscena(s, `${e.id}.salidas`);
  }
  // Salidas simétricas: si A lista a B, B lista a A.
  const salidasDe = new Map(lista(contenido.escenas).filter(esObjeto).map((e) => [e.id, lista(e.salidas)]));
  for (const [id, salidas] of salidasDe) {
    if (salidas.includes(id)) err(`${id}.salidas: la escena se lista a sí misma`);
    if (new Set(salidas).size !== salidas.length) err(`${id}.salidas: salida repetida`);
    for (const s of salidas) {
      if (s !== id && salidasDe.has(s) && !salidasDe.get(s).includes(id)) {
        err(`${id}.salidas: ${s} no tiene a ${id} en sus salidas`);
      }
    }
  }

  // --- NPCs ---
  for (const n of lista(contenido.npcs)) {
    if (!esObjeto(n)) continue;
    refEscena(n.escenaInicialId, `${n.id}.escenaInicialId`);
    if (typeof n.sensibilidad !== 'number') err(`${n.id}: sensibilidad no es un número`);
    if (esObjeto(n.movimiento)) {
      for (const c of lista(n.movimiento.caminos)) refEscena(c, `${n.id}.movimiento.caminos`);
    }
    for (const [i, k] of lista(n.conocimientos).entries()) {
      if (!esObjeto(k)) continue;
      if (k.requiereEvento != null) refEvento(k.requiereEvento, `${n.id}.conocimientos[${i}].requiereEvento`);
      if (k.requiereMarca != null && !Object.hasOwn(marcas, k.requiereMarca)) {
        err(`${n.id}.conocimientos[${i}].requiereMarca: marca inexistente ${JSON.stringify(k.requiereMarca)}`);
      }
    }
  }

  // --- Alias de NPC (comprension-v1.md, sección 3.2) ---
  // Dos NPCs que pueden coincidir en una escena no comparten alias.
  // Las escenas posibles de un NPC son la inicial más los caminos de su movimiento.
  const aliasPorEscena = new Map();
  for (const n of lista(contenido.npcs)) {
    if (!esObjeto(n)) continue;
    if (!Array.isArray(n.alias) || n.alias.length === 0) {
      err(`${n.id}: alias falta o no es una lista con valores`);
      continue;
    }
    const propios = new Set();
    for (const a of n.alias) {
      if (typeof a !== 'string' || a.trim() === '') {
        err(`${n.id}.alias: alias vacío o no textual`);
        continue;
      }
      const k = clave(a);
      if (propios.has(k)) err(`${n.id}.alias: alias repetido ${JSON.stringify(a)}`);
      propios.add(k);
    }
    const escenasPosibles = new Set([n.escenaInicialId, ...(esObjeto(n.movimiento) ? lista(n.movimiento.caminos) : [])]);
    for (const escenaId of escenasPosibles) {
      if (!aliasPorEscena.has(escenaId)) aliasPorEscena.set(escenaId, new Map());
      const enEscena = aliasPorEscena.get(escenaId);
      for (const k of propios) {
        const otro = enEscena.get(k);
        if (otro && otro !== n.id) err(`${n.id}.alias: ${JSON.stringify(k)} también es alias de ${otro} en ${escenaId}`);
        else enEscena.set(k, n.id);
      }
    }
  }

  // --- Objetos ---
  for (const o of lista(contenido.objetos)) {
    if (!esObjeto(o)) continue;
    if (!TIPOS_OBJETO.includes(o.tipo)) err(`${o.id}: tipo inválido ${JSON.stringify(o.tipo)}`);
    if (o.escenaVenta != null) refEscena(o.escenaVenta, `${o.id}.escenaVenta`);
    if (o.escenaAparece != null) refEscena(o.escenaAparece, `${o.id}.escenaAparece`);
    if (o.tipo === 'narrativo' || o.npcAsociado != null) refNpc(o.npcAsociado, `${o.id}.npcAsociado`);
    if (o.tipo === 'narrativo' || o.conocimientoDesbloquea != null) {
      if (!conocimientosPorNpc.get(o.npcAsociado)?.has(o.conocimientoDesbloquea)) {
        err(
          `${o.id}.conocimientoDesbloquea: conocimiento inexistente ${JSON.stringify(o.conocimientoDesbloquea)} en ${JSON.stringify(o.npcAsociado)}`,
        );
      }
    }
    for (const v of lista(o.utilizableComo)) refVerbo(v, `${o.id}.utilizableComo`);
  }

  // --- Eventos ---
  for (const ev of lista(contenido.eventos)) {
    if (!esObjeto(ev)) continue;
    if (!CATEGORIAS_EVENTO.includes(ev.categoria)) err(`${ev.id}: categoria inválida ${JSON.stringify(ev.categoria)}`);
    if (ev.estado !== null && !ESTADOS_ESCENA.includes(ev.estado)) err(`${ev.id}: estado inválido ${JSON.stringify(ev.estado)}`);
    if (!Array.isArray(ev.escenas) || ev.escenas.length === 0) err(`${ev.id}: escenas vacías`);
    for (const s of lista(ev.escenas)) refEscena(s, `${ev.id}.escenas`);

    if (!esObjeto(ev.disparo) || !TIPOS_DISPARO.includes(ev.disparo.tipo)) {
      err(`${ev.id}: disparo inválido`);
    } else {
      if (ev.disparo.verbo != null) refVerbo(ev.disparo.verbo, `${ev.id}.disparo.verbo`);
      if (ev.disparo.escena != null) refEscena(ev.disparo.escena, `${ev.id}.disparo.escena`);
      for (const s of lista(ev.disparo.escenas)) refEscena(s, `${ev.id}.disparo.escenas`);
      if (ev.disparo.objetivo != null) refNpc(ev.disparo.objetivo, `${ev.id}.disparo.objetivo`);
      if (ev.disparo.tipo === 'azar' && !(typeof ev.disparo.p === 'number' && ev.disparo.p > 0 && ev.disparo.p <= 1)) {
        err(`${ev.id}.disparo.p: no es una probabilidad entre 0 y 1`);
      }
      if (ev.disparo.tipo === 'hora' && !esHora(ev.disparo.valor)) err(`${ev.id}.disparo.valor: no es una hora HH:MM`);
      if (ev.disparo.tipo === 'accion' && ev.disparo.verbo == null) err(`${ev.id}.disparo: disparo por acción sin verbo`);
    }
    if (!esObjeto(ev.fin) || !TIPOS_FIN.includes(ev.fin.tipo)) {
      err(`${ev.id}: fin inválido`);
    } else {
      for (const v of lista(ev.fin.verbos)) refVerboDeFin(v, `${ev.id}.fin.verbos`);
      if (ev.fin.tipo === 'accion' && lista(ev.fin.verbos).length === 0) aviso(`${ev.id}.fin: fin por acción sin verbos`);
    }
    if (!esObjeto(ev.duracion) || !TIPOS_DURACION.includes(ev.duracion.tipo)) {
      err(`${ev.id}: duracion inválida`);
    } else {
      const d = ev.duracion;
      if ((d.tipo === 'turnos' || d.tipo === 'horas') && !(Number.isInteger(d.n) && d.n > 0)) {
        err(`${ev.id}.duracion.n: no es un entero mayor que 0`);
      }
      if (d.tipo === 'hasta_hora' && !esHora(d.valor)) err(`${ev.id}.duracion.valor: no es una hora HH:MM`);
      const fin = esObjeto(ev.fin) ? ev.fin : {};
      if (fin.valor != null && !esHora(fin.valor)) err(`${ev.id}.fin.valor: no es una hora HH:MM`);
      // Fin por hora: hace falta una hora fija o una duración en horas.
      if (fin.tipo === 'hora' && fin.valor == null && d.tipo !== 'hasta_hora' && d.tipo !== 'horas') {
        err(`${ev.id}: fin por hora sin hora ni duración en horas`);
      }
      // Fin por tiempo: hace falta una duración en turnos u horas.
      if (fin.tipo === 'tiempo' && d.tipo !== 'turnos' && d.tipo !== 'horas') {
        err(`${ev.id}: fin por tiempo sin duración en turnos ni horas`);
      }
    }
    if (esObjeto(ev.duracion)) {
      // Acepta `verbo` (uno) o `verbos` (lista).
      if (ev.duracion.verbo != null) refVerboDeFin(ev.duracion.verbo, `${ev.id}.duracion.verbo`);
      for (const v of lista(ev.duracion.verbos)) refVerboDeFin(v, `${ev.id}.duracion.verbos`);
    }

    if (!Array.isArray(ev.efectos)) err(`${ev.id}: efectos no es una lista`);
    for (const [i, ef] of lista(ev.efectos).entries()) {
      const donde = `${ev.id}.efectos[${i}]`;
      if (!esObjeto(ef) || !TIPOS_EFECTO.includes(ef.tipo)) {
        err(`${donde}: tipo inválido`);
        continue;
      }
      if (ef.npcId != null) refNpc(ef.npcId, `${donde}.npcId`);
      if (ef.objetoId != null) refObjeto(ef.objetoId, `${donde}.objetoId`);
      if (ef.escenaId != null) refEscena(ef.escenaId, `${donde}.escenaId`);
      if (ef.destino != null && !DESTINOS_CIUDAD.includes(ef.destino)) refEscena(ef.destino, `${donde}.destino`);
      if (ef.verbo != null) refVerbo(ef.verbo, `${donde}.verbo`);
      if (ef.conocimientoId != null && !conocimientosPorNpc.get(ef.npcId)?.has(ef.conocimientoId)) {
        err(`${donde}.conocimientoId: conocimiento inexistente ${JSON.stringify(ef.conocimientoId)} en ${JSON.stringify(ef.npcId)}`);
      }
    }
  }

  // --- Intenciones y plantillas ---
  for (const it of lista(contenido.intenciones)) {
    if (!esObjeto(it)) continue;
    refVerbo(it.verbo, `${it.id}.verbo`);
    if (verbos.has(it.verbo) && VERBO_A_INTENCION[it.verbo] !== it.id) {
      err(`${it.id}: el verbo ${it.verbo} corresponde a ${VERBO_A_INTENCION[it.verbo]}`);
    }
    if (!Array.isArray(it.formas) || it.formas.length === 0) err(`${it.id}: sin formas`);
    if (plantillas) validarBloque(plantillas, it.id, err);
    // Variantes: al menos 3 plantillas distintas en exito y en fallo.
    if (plantillas && esObjeto(plantillas[it.id])) {
      for (const r of ['exito', 'fallo']) {
        const textos = Array.isArray(plantillas[it.id][r]) ? plantillas[it.id][r] : [];
        const distintas = new Set(textos.filter((t) => typeof t === 'string').map((t) => t.trim())).size;
        if (distintas < MIN_VARIANTES) {
          err(`plantillas.${it.id}.${r}: tiene ${distintas} plantillas distintas; hacen falta al menos ${MIN_VARIANTES}`);
        }
      }
    }
  }
  if (plantillas) {
    for (const extra of BLOQUES_EXTRA) validarBloque(plantillas, extra, err);
    validarReformulacion(plantillas[BLOQUE_REFORMULACION], err);
    const esperados = new Set([...ids.intenciones, ...BLOQUES_EXTRA, BLOQUE_REFORMULACION]);
    for (const clave of Object.keys(plantillas)) {
      if (!esperados.has(clave)) err(`plantillas: bloque sin intención ${clave}`);
    }
  }

  // --- Reglas: marcas y conocimiento del sendero ---
  for (const [marcaId, m] of Object.entries(marcas)) {
    const donde = `reglas.marcas.${marcaId}`;
    if (esObjeto(m?.activaCon)) {
      if (m.activaCon.verbo != null) refVerbo(m.activaCon.verbo, `${donde}.activaCon.verbo`);
      if (m.activaCon.escenaId != null) refEscena(m.activaCon.escenaId, `${donde}.activaCon.escenaId`);
    }
    for (const npcId of lista(m?.usadaPor)) refNpc(npcId, `${donde}.usadaPor`);
  }
  const sendero = contenido.reglas?.conocimientoSenderoSinVigilancia;
  if (esObjeto(sendero)) {
    const donde = 'reglas.conocimientoSenderoSinVigilancia';
    if (sendero.npcId != null) refNpc(sendero.npcId, `${donde}.npcId`);
    if (sendero.requiereEvento != null) refEvento(sendero.requiereEvento, `${donde}.requiereEvento`);
    if (!conocimientosPorNpc.get(sendero.npcId)?.has(sendero.id)) {
      err(`${donde}.id: conocimiento inexistente ${JSON.stringify(sendero.id)} en ${JSON.stringify(sendero.npcId)}`);
    }
  }

  // --- Reglas: viaje dentro de la ciudad ---
  if (esObjeto(contenido.reglas)) {
    try {
      relojInicial(contenido);
    } catch {
      err('reglas.relojInicial: no trae una hora HH:MM');
    }
    const porCamino = contenido.reglas.viajeHorasPorCamino;
    if (!esObjeto(porCamino)) err('reglas.viajeHorasPorCamino: falta o no es un objeto');
    else {
      for (const [escenaId, horas] of Object.entries(porCamino)) {
        refEscena(escenaId, 'reglas.viajeHorasPorCamino');
        if (!(typeof horas === 'number' && horas > 0)) err(`reglas.viajeHorasPorCamino.${escenaId}: no es un número mayor que 0`);
      }
    }
  }
  // Todo verbo de intenciones tiene costo de reloj, salvo viajar (lo da la ruta).
  const costos = contenido.reglas?.costoHorasPorVerbo;
  if (!esObjeto(costos)) {
    err('reglas.costoHorasPorVerbo: falta o no es un objeto');
  } else {
    const verbosDeIntenciones = new Set((Array.isArray(contenido.intenciones) ? contenido.intenciones : []).map((i) => i?.verbo));
    for (const verbo of verbosDeIntenciones) {
      if (verbo === 'viajar' || typeof verbo !== 'string') continue;
      if (!(verbo in costos)) err(`reglas.costoHorasPorVerbo: falta el verbo ${JSON.stringify(verbo)}`);
    }
    for (const [verbo, horas] of Object.entries(costos)) {
      if (!verbosDeIntenciones.has(verbo)) err(`reglas.costoHorasPorVerbo.${verbo}: no es un verbo de intenciones`);
      if (!(Number.isInteger(horas) && horas >= 0)) err(`reglas.costoHorasPorVerbo.${verbo}: no es un entero mayor o igual que 0`);
    }
  }
  for (const regla of ['viajeHorasIntraCiudad', 'viajeHorasLugarCamino']) {
    const horas = contenido.reglas?.[regla];
    if (esObjeto(contenido.reglas) && !(typeof horas === 'number' && horas > 0)) {
      err(`reglas.${regla}: falta o no es un número mayor que 0`);
    }
  }

  // --- Transiciones ---
  if (esObjeto(contenido.transiciones)) {
    for (const v of Object.keys(contenido.transiciones)) refVerbo(v, 'transiciones');
  }

  return { ok: errores.length === 0, errores, avisos, conteos };
}

// plantillas.reformulacion: una clave por motivo de decidir(), más repetir_segunda y ya_en_destino.
function validarReformulacion(bloque, err) {
  const donde = `plantillas.${BLOQUE_REFORMULACION}`;
  if (!esObjeto(bloque)) {
    err(`plantillas: falta el bloque ${BLOQUE_REFORMULACION}`);
    return;
  }
  for (const clave of CLAVES_REFORMULACION) {
    const textos = Object.hasOwn(bloque, clave) ? bloque[clave] : undefined;
    if (!Array.isArray(textos) || textos.length === 0) {
      err(`${donde}: sin texto para ${clave}`);
    } else if (textos.some((t) => typeof t !== 'string' || t.trim() === '')) {
      err(`${donde}.${clave}: texto vacío o no textual`);
    }
  }
  for (const clave of Object.keys(bloque)) {
    if (!CLAVES_REFORMULACION.includes(clave)) err(`${donde}: clave sin motivo ${clave}`);
  }
}

function validarBloque(plantillas, clave, err) {
  const bloque = plantillas[clave];
  if (!esObjeto(bloque)) {
    err(`plantillas: falta el bloque ${clave}`);
    return;
  }
  for (const r of RESULTADOS) {
    const textos = bloque[r];
    if (!Array.isArray(textos) || textos.length === 0) {
      err(`plantillas.${clave}: sin plantillas para ${r}`);
    } else if (textos.some((t) => typeof t !== 'string' || t.trim() === '')) {
      err(`plantillas.${clave}.${r}: plantilla vacía o no textual`);
    }
  }
}

/**
 * Resuelve una clave de plantilla a su lista de textos.
 * Acepta `resultado_<verbo>_<resultado>` (clave de la beta), o un id de bloque más resultado.
 * Devuelve null si no existe.
 */
export function resolverPlantillas(contenido, clave, resultado) {
  const plantillas = contenido?.plantillas;
  if (!esObjeto(plantillas) || typeof clave !== 'string') return null;

  let bloqueId = clave;
  let res = resultado;
  if (res === undefined) {
    const m = /^resultado_(.+)_(exito|fallo|neutro)$/.exec(clave);
    if (!m) return null;
    bloqueId = m[1];
    res = m[2];
  }
  if (!RESULTADOS.includes(res)) return null;

  const candidatos = [bloqueId, VERBO_A_INTENCION[bloqueId], `intencion_${bloqueId}`];
  for (const id of candidatos) {
    if (id && Object.hasOwn(plantillas, id)) {
      const textos = plantillas[id]?.[res];
      return Array.isArray(textos) ? textos : null;
    }
  }
  return null;
}

/** Índices por id para el resto de los módulos. */
export function indexarContenido(contenido) {
  const porId = (l) => new Map(lista(l).map((x) => [x.id, x]));
  const intenciones = porId(contenido.intenciones);
  return {
    escenas: porId(contenido.escenas),
    npcs: porId(contenido.npcs),
    objetos: porId(contenido.objetos),
    eventos: porId(contenido.eventos),
    intenciones,
    intencionPorVerbo: new Map(lista(contenido.intenciones).map((x) => [x.verbo, x])),
  };
}

/** Valida y lanza si hay errores. Devuelve el mismo contenido. */
export function exigirContenidoValido(contenido) {
  const { ok, errores } = validarContenido(contenido);
  if (!ok) throw new Error(`Contenido inválido:\n- ${errores.join('\n- ')}`);
  return contenido;
}
