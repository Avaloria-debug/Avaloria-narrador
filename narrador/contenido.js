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
 * `errores`: comprobaciones de la sección 5.1 del prompt maestro. Bloquean.
 * `avisos`: referencias secundarias (efectos, disparo, fin, duración, requiereEvento). No bloquean.
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
  const refEscena = (id, donde, avisar = err) => {
    if (!ids.escenas.has(id)) avisar(`${donde}: escena inexistente ${JSON.stringify(id)}`);
  };
  const refVerboDeFin = (v, donde) => {
    if (!verbos.has(v) && !PSEUDO_VERBOS.includes(v)) aviso(`${donde}: verbo inexistente ${JSON.stringify(v)}`);
  };
  const refVerbo = (v, donde, avisar = err) => {
    if (!verbos.has(v)) avisar(`${donde}: verbo inexistente ${JSON.stringify(v)}`);
  };

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
      if (esObjeto(k) && k.requiereEvento != null && !ids.eventos.has(k.requiereEvento)) {
        aviso(`${n.id}.conocimientos[${i}].requiereEvento: evento inexistente ${JSON.stringify(k.requiereEvento)}`);
      }
    }
  }

  // --- Objetos ---
  for (const o of lista(contenido.objetos)) {
    if (!esObjeto(o)) continue;
    if (!TIPOS_OBJETO.includes(o.tipo)) err(`${o.id}: tipo inválido ${JSON.stringify(o.tipo)}`);
    if (o.escenaVenta != null) refEscena(o.escenaVenta, `${o.id}.escenaVenta`);
    if (o.escenaAparece != null) refEscena(o.escenaAparece, `${o.id}.escenaAparece`);
    if (o.tipo === 'narrativo' && !ids.npcs.has(o.npcAsociado)) {
      err(`${o.id}.npcAsociado: NPC inexistente ${JSON.stringify(o.npcAsociado)}`);
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
      if (ev.disparo.verbo != null) refVerbo(ev.disparo.verbo, `${ev.id}.disparo.verbo`, aviso);
      if (ev.disparo.escena != null) refEscena(ev.disparo.escena, `${ev.id}.disparo.escena`, aviso);
      for (const s of lista(ev.disparo.escenas)) refEscena(s, `${ev.id}.disparo.escenas`, aviso);
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
      if (ef.npcId != null && !ids.npcs.has(ef.npcId)) aviso(`${donde}: NPC inexistente ${JSON.stringify(ef.npcId)}`);
      if (ef.objetoId != null && !ids.objetos.has(ef.objetoId)) aviso(`${donde}: objeto inexistente ${JSON.stringify(ef.objetoId)}`);
      if (ef.escenaId != null) refEscena(ef.escenaId, `${donde}.escenaId`, aviso);
      if (ef.destino != null && !DESTINOS_CIUDAD.includes(ef.destino)) refEscena(ef.destino, `${donde}.destino`, aviso);
      if (ef.verbo != null) refVerbo(ef.verbo, `${donde}.verbo`, aviso);
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
