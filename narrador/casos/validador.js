// Validador de casos (docs/motor-caso-v1-operativo.md §10; docs/motor-caso-v1.md §12).
// No lanza: devuelve la lista de errores. Cada error: { regla, casoId, detalle }.

import { TIPOS_TAG } from './tags.js';
import { TAGS_REPARABLES } from './decaimiento.js';
import { ACCIONES, OPS } from './acciones.js';
import { candidatos, RANURAS } from './instancias.js';
import { esNeutroDefault, TAGS_CIERRE } from './desenlaces.js';

export const REGLAS = Object.freeze({
  HITOS: 'hitos_por_caso',
  TEXTOS: 'textos_por_hito',
  TEXTO_DUPLICADO: 'id_texto_duplicado',
  SIN_DEFAULT: 'sin_neutro_default',
  SIN_POSITIVO: 'sin_positivo',
  SIN_REPARACION: 'sin_reparacion',
  REPARACION_SIN_NPC: 'reparacion_sin_npc',
  REPARACION_POR_RUTINA: 'reparacion_por_rutina',
  ENTREGA_INALCANZABLE: 'entrega_inalcanzable',
  ALTERNATIVA_INVALIDA: 'escena_alternativa_invalida',
  FINAL_INALCANZABLE: 'final_inalcanzable',
  FIRMAS: 'instancias',
  ID_INEXISTENTE: 'id_inexistente',
  MARCADOR: 'marcador_invalido',
  TAG_DESCONOCIDO: 'tag_desconocido',
  TAG_FISICO: 'tag_en_cuerpo',
  EFECTOS_POST_CIERRE: 'efectos_post_cierre',
  TONO_INVALIDO: 'tono_invalido',
});

/** Tonos permitidos para un caso y para sus textos. */
export const TONOS_VALIDOS = Object.freeze(['intriga', 'calido', 'tension', 'misterio', 'cotidiano']);

export const HITOS_POR_CASO = 8;
export const TEXTOS_POR_HITO = 4;
export const FIRMAS_MINIMAS = 4;

/** Objetivos que nombran el cuerpo del jugador (SUPUESTO: no hay lista en el diseño). */
export const PARTES_DEL_CUERPO = Object.freeze(['cuerpo', 'cabeza', 'cara', 'ojo', 'ojos', 'mano', 'manos', 'brazo', 'brazos', 'pierna', 'piernas', 'pie', 'pies', 'pecho', 'espalda', 'herida', 'sangre']);

const lista = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const RE_RANURA = /^(?:(npc|escena)\()?(p\d+)\)?$/;

/** Errores de la tabla de acciones: ninguna acción de rutina quita ni baja rencor, desconfianza o miedo. */
export function validarAcciones(acciones = ACCIONES) {
  const errores = [];
  for (const [id, accion] of Object.entries(acciones)) {
    for (const fila of accion.tags) {
      if (TAGS_REPARABLES.includes(fila.tipo) && fila.op === OPS.QUITAR) {
        errores.push({ regla: REGLAS.REPARACION_POR_RUTINA, casoId: null, detalle: `la acción ${id} quita ${fila.tipo}` });
      }
    }
  }
  return errores;
}

/** Escenas alcanzables desde las de origen, por las salidas del contenido. */
export function escenasAlcanzables(origenes, contenido) {
  const salidas = new Map((contenido.escenas ?? []).map((e) => [e.id, lista(e.salidas)]));
  const vistas = new Set();
  const pendientes = lista(origenes).filter((e) => salidas.has(e));
  while (pendientes.length > 0) {
    const e = pendientes.pop();
    if (vistas.has(e)) continue;
    vistas.add(e);
    for (const s of salidas.get(e) ?? []) if (!vistas.has(s)) pendientes.push(s);
  }
  return vistas;
}

/** Todos los textos (strings) y objetivos de un caso, con su lugar, para recorrerlos. */
function efectosDe(caso) {
  const salida = [];
  for (const h of lista(caso.hitos)) {
    for (const t of lista(h.condiciones?.tags)) salida.push({ donde: `${h.id}.condiciones`, ...t });
    for (const e of lista(h.efectos)) salida.push({ donde: `${h.id}.efectos`, ...e });
  }
  for (const d of lista(caso.desenlaces)) {
    for (const t of lista(d.requiere?.tags)) salida.push({ donde: `${d.id}.requiere`, ...t });
    for (const e of lista(d.efectos_post)) salida.push({ donde: `${d.id}.efectos_post`, ...e });
  }
  return salida;
}

function escenasNombradas(caso) {
  const salida = [];
  for (const h of lista(caso.hitos)) {
    if (typeof h.escena_entrega === 'string') salida.push({ donde: `${h.id}.escena_entrega`, valor: h.escena_entrega });
    if (typeof h.escena_alternativa === 'string') salida.push({ donde: `${h.id}.escena_alternativa`, valor: h.escena_alternativa });
    const c = h.condiciones?.escena;
    const enes = c && typeof c === 'object' && !Array.isArray(c) ? [...lista(c.en), ...lista(c.no_en)] : lista(c);
    for (const v of enes) salida.push({ donde: `${h.id}.condiciones.escena`, valor: v });
  }
  return salida;
}

/** Escena resuelta en una instancia: escena(pN) → escena inicial del dueño (SUPUESTO); 'escena' o null → cualquiera. */
function escenaEnInstancia(valor, pistas, npcs) {
  if (valor === null || valor === undefined || valor === 'escena') return null;
  const m = String(valor).match(RE_RANURA);
  if (m && m[1] === 'escena') {
    const pista = pistas.find((p) => p.ranura === m[2]);
    return pista ? npcs.get(pista.npcId)?.escenaInicialId ?? undefined : undefined;
  }
  return valor;
}

/**
 * Hitos alcanzables en una instancia: requiere_hitos cumplibles con hitos alcanzables, escena de entrega (o la
 * alternativa) alcanzable, y alguna escena de la condición alcanzable. No mira tags, hora ni pistas (se pueden
 * conseguir); sí los bloqueos de los hitos que el final necesita.
 */
function hitosAlcanzables(caso, pistas, alcanzables, npcs) {
  const hitos = lista(caso.hitos);
  const enAlcance = (v) => {
    const e = escenaEnInstancia(v, pistas, npcs);
    return e === null || alcanzables.has(e);
  };
  const escenaOk = (h) => {
    const c = h.condiciones?.escena;
    const en = c && typeof c === 'object' && !Array.isArray(c) ? lista(c.en) : lista(c);
    return en.length === 0 || en.some(enAlcance);
  };
  const entregaOk = (h) => enAlcance(h.escena_entrega ?? null) || (typeof h.escena_alternativa === 'string' && enAlcance(h.escena_alternativa));
  const ok = new Set();
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (const h of hitos) {
      if (ok.has(h.id)) continue;
      const r = h.condiciones?.requiere_hitos;
      const todos = Array.isArray(r) ? r : lista(r?.todos);
      const alguno = Array.isArray(r) ? [] : lista(r?.alguno);
      const req = todos.every((id) => ok.has(id)) && (alguno.length === 0 || alguno.some((id) => ok.has(id)));
      const bloqueado = todos.some((id) => lista(hitos.find((x) => x.id === id)?.bloquea).includes(h.id));
      if (req && !bloqueado && entregaOk(h) && escenaOk(h)) {
        ok.add(h.id);
        cambio = true;
      }
    }
  }
  return ok;
}

/**
 * Valida un caso contra el contenido.
 * @param {object} caso
 * @param {object} contenido contenido-v3.json (escenas, npcs con conocimientos)
 * @param {{acciones?:object}} [opciones]
 * @returns {{regla:string, casoId:string, detalle:string}[]}
 */
export function validarCaso(caso, contenido, opciones = {}) {
  const casoId = caso?.id ?? null;
  const errores = [];
  const error = (regla, detalle) => errores.push({ regla, casoId, detalle });
  const hitos = lista(caso?.hitos);
  const desenlaces = lista(caso?.desenlaces);
  const escenas = new Set((contenido.escenas ?? []).map((e) => e.id));
  const npcs = new Map((contenido.npcs ?? []).map((n) => [n.id, n]));
  const conocimientos = new Set((contenido.npcs ?? []).flatMap((n) => lista(n.conocimientos).map((k) => k.id)));
  const ranuras = new Set(lista(caso?.ranuras_pista).map((r) => r.id));

  // Tonos: el del caso y el de cada texto.
  if (!TONOS_VALIDOS.includes(caso?.tono)) error(REGLAS.TONO_INVALIDO, `caso: ${JSON.stringify(caso?.tono ?? null)}`);
  for (const h of hitos) {
    for (const t of lista(h.textos)) if (!TONOS_VALIDOS.includes(t.tono)) error(REGLAS.TONO_INVALIDO, `${t.id}: ${JSON.stringify(t.tono ?? null)}`);
  }

  // Hitos y textos.
  if (hitos.length !== HITOS_POR_CASO) error(REGLAS.HITOS, `${hitos.length} hitos`);
  for (const h of hitos) if (lista(h.textos).length !== TEXTOS_POR_HITO) error(REGLAS.TEXTOS, `${h.id}: ${lista(h.textos).length} textos`);
  const vistos = new Set();
  for (const t of hitos.flatMap((h) => lista(h.textos))) {
    if (vistos.has(t.id)) error(REGLAS.TEXTO_DUPLICADO, t.id);
    vistos.add(t.id);
  }

  // Desenlaces.
  if (!desenlaces.some(esNeutroDefault)) error(REGLAS.SIN_DEFAULT, 'no hay neutro con requiere vacío');
  if (!desenlaces.some((d) => d.tipo === 'positivo')) error(REGLAS.SIN_POSITIVO, 'no hay desenlace positivo');
  for (const d of desenlaces) {
    for (const e of lista(d.efectos_post)) if (TAGS_CIERRE.includes(e.tipo)) error(REGLAS.EFECTOS_POST_CIERRE, `${d.id}: ${e.tipo}`);
  }

  // Reparación.
  const reparaciones = hitos.filter((h) => h.es_reparacion === true);
  if (reparaciones.length === 0) error(REGLAS.SIN_REPARACION, 'ningún hito con es_reparacion');
  for (const h of reparaciones) {
    if (!h.npc_reparacion) {
      error(REGLAS.REPARACION_SIN_NPC, h.id);
    } else {
      const m = String(h.npc_reparacion).match(RE_RANURA);
      const existe = m ? m[1] === 'npc' && ranuras.has(m[2]) : npcs.has(h.npc_reparacion);
      if (!existe) error(REGLAS.ID_INEXISTENTE, `${h.id}.npc_reparacion: ${h.npc_reparacion}`);
    }
    const r = h.condiciones?.requiere_hitos;
    const requiere = Array.isArray(r) ? r.length > 0 : lista(r?.todos).length + lista(r?.alguno).length > 0;
    if (!requiere) error(REGLAS.REPARACION_POR_RUTINA, `${h.id}: un hito de reparación tiene que venir de otro hito del caso (requiere_hitos)`);
  }
  for (const e of validarAcciones(opciones.acciones)) errores.push({ ...e, casoId });

  // Escena alternativa: una sola, con escena_entrega no nula y distinta.
  for (const h of hitos) {
    if (h.escena_alternativa === undefined || h.escena_alternativa === null) continue;
    if (typeof h.escena_alternativa !== 'string' || h.escena_alternativa === '') error(REGLAS.ALTERNATIVA_INVALIDA, `${h.id}: no es una escena`);
    else if (h.escena_entrega === null || h.escena_entrega === undefined) error(REGLAS.ALTERNATIVA_INVALIDA, `${h.id}: sin escena_entrega`);
    else if (h.escena_alternativa === h.escena_entrega) error(REGLAS.ALTERNATIVA_INVALIDA, `${h.id}: igual a escena_entrega`);
  }

  // Ids de mundo.
  for (const e of lista(caso?.escenas_origen)) if (!escenas.has(e)) error(REGLAS.ID_INEXISTENTE, `escenas_origen: ${e}`);
  for (const { donde, valor } of escenasNombradas(caso ?? {})) {
    const m = String(valor).match(RE_RANURA);
    if (m) {
      if (!ranuras.has(m[2]) || m[1] !== 'escena') error(REGLAS.MARCADOR, `${donde}: ${valor}`);
    } else if (valor !== 'escena' && !escenas.has(valor)) error(REGLAS.ID_INEXISTENTE, `${donde}: ${valor}`);
  }
  for (const r of lista(caso?.ranuras_pista)) {
    for (const k of lista(r.conocimientos_validos)) if (!conocimientos.has(k)) error(REGLAS.ID_INEXISTENTE, `${r.id}: ${k}`);
  }

  // Tags: tipo, marcadores de ranura en el objetivo, cuerpo del jugador.
  for (const t of efectosDe(caso ?? {})) {
    if (!TIPOS_TAG.includes(t.tipo)) error(REGLAS.TAG_DESCONOCIDO, `${t.donde}: ${t.tipo}`);
    const objetivo = String(t.objetivo ?? '');
    const m = objetivo.match(RE_RANURA);
    if (m && !ranuras.has(m[2])) error(REGLAS.MARCADOR, `${t.donde}: ${objetivo}`);
    const partes = objetivo.toLowerCase().split(/[._:\s-]+/);
    if (PARTES_DEL_CUERPO.some((p) => partes.includes(p)) || /^jugador[._:]/.test(objetivo)) error(REGLAS.TAG_FISICO, `${t.donde}: ${objetivo}`);
  }

  // Marcadores en los textos.
  for (const h of hitos) {
    for (const t of lista(h.textos)) {
      for (const [, dentro] of String(t.texto ?? '').matchAll(/\{([^}]*)\}/g)) {
        const m = dentro.match(/^(npc|conocimiento):(p\d+)$/);
        if (!m || !ranuras.has(m[2])) error(REGLAS.MARCADOR, `${t.id}: {${dentro}}`);
      }
    }
  }

  // Instancias, escenas de entrega y finales.
  let firmas = [];
  try {
    firmas = candidatos(caso, {}, { contenido });
  } catch (e) {
    error(REGLAS.FIRMAS, e instanceof Error ? e.message : String(e));
  }
  if (firmas.length > 0 && firmas.length < FIRMAS_MINIMAS) error(REGLAS.FIRMAS, `${firmas.length} firmas válidas`);
  const alcanzables = escenasAlcanzables(caso?.escenas_origen, contenido);
  const finales = hitos.filter((h) => h.final === true);
  if (finales.length === 0) error(REGLAS.FINAL_INALCANZABLE, 'el caso no tiene final');
  const yaEntrega = new Set();
  const yaFinal = new Set();
  for (const f of firmas) {
    for (const h of hitos) {
      if (h.escena_entrega === null || h.escena_entrega === undefined || yaEntrega.has(h.id)) continue;
      const enAlcance = (v) => {
        const e = escenaEnInstancia(v, f.pistas, npcs);
        return e !== undefined && (e === null || alcanzables.has(e));
      };
      if (!enAlcance(h.escena_entrega) && !(typeof h.escena_alternativa === 'string' && enAlcance(h.escena_alternativa))) {
        error(REGLAS.ENTREGA_INALCANZABLE, `${h.id} en ${f.clave}`);
        yaEntrega.add(h.id);
      }
    }
    const ok = hitosAlcanzables(caso, f.pistas, alcanzables, npcs);
    for (const h of finales) {
      if (!ok.has(h.id) && !yaFinal.has(h.id)) {
        error(REGLAS.FINAL_INALCANZABLE, `${h.id} en ${f.clave}`);
        yaFinal.add(h.id);
      }
    }
  }
  return errores;
}

/** Valida varios casos: los de cada uno más los ids de texto repetidos entre casos. */
export function validarCasos(casos, contenido, opciones = {}) {
  const errores = lista(casos).flatMap((c) => validarCaso(c, contenido, opciones));
  const duenos = new Map();
  for (const c of lista(casos)) {
    for (const t of lista(c.hitos).flatMap((h) => lista(h.textos))) {
      if (duenos.has(t.id) && duenos.get(t.id) !== c.id) errores.push({ regla: REGLAS.TEXTO_DUPLICADO, casoId: c.id, detalle: `${t.id} (también en ${duenos.get(t.id)})` });
      else duenos.set(t.id, c.id);
    }
  }
  return errores;
}

export { RANURAS };
