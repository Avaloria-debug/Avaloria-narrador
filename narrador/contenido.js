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
export const TIPOS_EFECTO = Object.freeze(['disposicion', 'bloqueo', 'habilita', 'precio']);

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v : []);

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
  conteos.plantillas = plantillas ? Object.keys(plantillas).length : 0;
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
    }
    if (!esObjeto(ev.fin) || !TIPOS_FIN.includes(ev.fin.tipo)) {
      err(`${ev.id}: fin inválido`);
    } else {
      for (const v of lista(ev.fin.verbos)) refVerboDeFin(v, `${ev.id}.fin.verbos`);
      if (ev.fin.tipo === 'accion' && lista(ev.fin.verbos).length === 0) aviso(`${ev.id}.fin: fin por acción sin verbos`);
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
  }
  if (plantillas) {
    for (const extra of BLOQUES_EXTRA) validarBloque(plantillas, extra, err);
    const esperados = new Set([...ids.intenciones, ...BLOQUES_EXTRA]);
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

  // --- Transiciones ---
  if (esObjeto(contenido.transiciones)) {
    for (const v of Object.keys(contenido.transiciones)) refVerbo(v, 'transiciones');
  }

  return { ok: errores.length === 0, errores, avisos, conteos };
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
