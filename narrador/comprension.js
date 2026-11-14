// Comprensión del texto libre (docs/comprension-v1.md).
// Módulo puro: no escribe texto para el jugador. Devuelve acciones con un `motivo`;
// el texto de cada motivo lo pone la narración (bloque 4).
// El texto del jugador solo se lee: nunca vuelve en los datos de salida.
import { resolverNpcObjetivo } from '../core/orquestador/resolverNpcObjetivo.js';
import { DESTINOS_CIUDAD } from './contenido.js';
import { MOTIVOS } from './motivos.js';

export { MOTIVOS };

// Sección 1, paso 3.
export const PALABRAS_VACIAS = Object.freeze([
  'a', 'al', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por', 'para', 'que', 'le', 'lo', 'y',
]);
const VACIAS = new Set(PALABRAS_VACIAS);

// Sección 4.1: nunca se elige por el jugador.
export const VERBOS_NPC_EXIGIDO = Object.freeze(['hablar_con']);
// Sección 4.2: pueden elegir por el jugador.
export const VERBOS_NPC_AUTOMATICO = Object.freeze([
  'ayudar', 'negociar', 'presionar', 'atacar', 'emboscar', 'defender', 'distraer', 'observar',
]);
// Sección 4.2, "si el verbo lo permite": se ejecutan sin objetivo cuando no hay nadie.
// Son los que el contenido declara con "NPC opcional".
export const VERBOS_SIN_OBJETIVO_PERMITIDO = Object.freeze(['observar', 'defender', 'distraer']);
// Solo toman un NPC si el jugador lo nombra.
export const VERBOS_NPC_SOLO_NOMBRADO = Object.freeze(['usar']);
// Sección 4.3.
export const VERBOS_OBJETO_EXIGIDO = Object.freeze(['usar', 'examinar']);
export const VERBOS_OBJETO_OPCIONAL = Object.freeze(['comprar', 'atacar']);
// Solo toman un objeto si el jugador lo nombra.
export const VERBOS_OBJETO_SOLO_NOMBRADO = Object.freeze(['negociar']);

// ---------------------------------------------------------------------------
// Sección 1: normalizar y tokenizar
// ---------------------------------------------------------------------------

/** Minúsculas, sin tildes, sin signos, espacios simples. */
export function normalizar(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function palabras(texto) {
  const n = normalizar(texto);
  return n === '' ? [] : n.split(' ');
}

/** Palabras del texto normalizado, sin las palabras vacías. */
export function tokenizar(texto) {
  return palabras(texto).filter((p) => !VACIAS.has(p));
}

// ---------------------------------------------------------------------------
// Sección 2.1: tolerancia a typos
// ---------------------------------------------------------------------------

/** Distancia de edición (Levenshtein). Corta en `tope + 1`. */
export function distanciaEdicion(a, b, tope = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + costo);
      if (fila[j] < minimo) minimo = fila[j];
    }
    if (minimo > tope) return tope + 1;
    previa = fila;
  }
  return previa[b.length];
}

/** Distancia máxima permitida para una palabra de ese largo. */
export function toleranciaPara(largo) {
  if (largo <= 3) return 0;
  if (largo === 4) return 1;
  return 2;
}

/**
 * Distancia entre dos palabras si coinciden con la tolerancia de 2.1; si no, -1.
 * El largo que manda es el de la palabra más corta de las dos.
 */
export function coincidePalabra(escrita, esperada) {
  const tope = toleranciaPara(Math.min(escrita.length, esperada.length));
  const d = distanciaEdicion(escrita, esperada, tope);
  return d <= tope ? d : -1;
}

/**
 * Sección 2.2: busca `forma` dentro de `entrada`, en orden y con otras palabras entre medio.
 * Devuelve las posiciones y la distancia total, o null.
 */
function buscarEnOrden(entrada, forma) {
  if (forma.length === 0) return null;
  const posiciones = [];
  let distancia = 0;
  let desde = 0;
  for (const palabra of forma) {
    let hallada = -1;
    for (let i = desde; i < entrada.length; i++) {
      const d = coincidePalabra(entrada[i], palabra);
      if (d >= 0) {
        hallada = i;
        distancia += d;
        break;
      }
    }
    if (hallada < 0) return null;
    posiciones.push(hallada);
    desde = hallada + 1;
  }
  return { posiciones, distancia };
}

// ---------------------------------------------------------------------------
// Sección 2: coincidencia de intención
// ---------------------------------------------------------------------------

function parametrosPendientesDe(verbo) {
  const pendientes = [];
  if (verbo === 'viajar') pendientes.push('destino');
  if (VERBOS_NPC_EXIGIDO.includes(verbo) || VERBOS_NPC_AUTOMATICO.includes(verbo)) pendientes.push('npc');
  if (VERBOS_OBJETO_EXIGIDO.includes(verbo) || VERBOS_OBJETO_OPCIONAL.includes(verbo)) pendientes.push('objeto');
  return pendientes;
}

// Orden de 2.3: más palabras; después, la forma completa (con sus palabras vacías)
// presente en la frase; después, la que aparece primero; después, menos typos.
function compararCandidatos(a, b) {
  return b.palabras - a.palabras || b.formaCompleta - a.formaCompleta || a.inicio - b.inicio || a.distancia - b.distancia;
}

/**
 * Busca la intención de la frase.
 * @returns {null | {
 *   intencionId: string, verbo: string, parametrosPendientes: string[],
 *   segundaIntencionId: string|null, empateCon: string[]
 * }}
 */
export function coincidirIntencion(texto, intenciones) {
  const entrada = tokenizar(texto);
  const entradaCompleta = palabras(texto);
  if (entrada.length === 0 || !Array.isArray(intenciones)) return null;

  // Mejor forma de cada intención.
  const candidatos = [];
  for (const intencion of intenciones) {
    let mejor = null;
    for (const forma of intencion.formas ?? []) {
      const m = buscarEnOrden(entrada, tokenizar(forma));
      if (!m) continue;
      const completa = palabras(forma);
      const candidato = {
        intencionId: intencion.id,
        verbo: intencion.verbo,
        palabras: m.posiciones.length,
        formaCompleta: buscarEnOrden(entradaCompleta, completa) ? completa.length : 0,
        inicio: m.posiciones[0],
        distancia: m.distancia,
        posiciones: m.posiciones,
      };
      if (!mejor || compararCandidatos(candidato, mejor) < 0) mejor = candidato;
    }
    if (mejor) candidatos.push(mejor);
  }
  if (candidatos.length === 0) return null;

  // Las formas que comparten palabras de la frase compiten entre sí: queda la de más prioridad.
  // Las que no comparten palabras son intenciones distintas dentro de la misma frase.
  candidatos.sort(compararCandidatos);
  const elegidos = [];
  for (const c of candidatos) {
    const rival = elegidos.find((e) => e.posiciones.some((p) => c.posiciones.includes(p)));
    if (!rival) elegidos.push({ ...c, empateCon: [] });
    else if (compararCandidatos(c, rival) === 0) rival.empateCon.push(c.intencionId);
  }

  // Con dos intenciones en la frase se responde a la primera por posición.
  elegidos.sort((a, b) => a.inicio - b.inicio);
  const [primera, segunda] = elegidos;
  return {
    intencionId: primera.intencionId,
    verbo: primera.verbo,
    parametrosPendientes: parametrosPendientesDe(primera.verbo),
    segundaIntencionId: segunda ? segunda.intencionId : null,
    empateCon: primera.empateCon,
  };
}

// ---------------------------------------------------------------------------
// Sección 3 y 4.1 / 4.2: NPC
// ---------------------------------------------------------------------------

function terminosDeNpc(npc) {
  return [...new Set([...tokenizar(npc.nombre ?? ''), ...(npc.alias ?? []).flatMap((a) => tokenizar(a))])];
}

function nombraA(entrada, npc, exacto = false) {
  return terminosDeNpc(npc).some((t) => entrada.some((p) => (exacto ? p === t : coincidePalabra(p, t) >= 0)));
}

const nombresDe = (lista) => lista.map((x) => x.nombre);

/**
 * Resuelve el NPC objetivo de un verbo.
 * @param {string} texto
 * @param {{id: string}} escena escena actual
 * @param {{id: string, nombre: string, alias?: string[], relacion?: number}[]} npcsPresentes
 * @param {string} verbo id de verbo
 * @param {{ npcsAusentes?: object[] }} [opciones] NPCs de otras escenas, para avisar que no están
 * @returns {{ estado: 'resuelto', npcId: string, ambiguo: boolean, reportes: object[] }
 *   | { estado: 'sin_objetivo' }
 *   | { estado: 'reformular', motivo: string, datos: { nombres: string[] } }}
 */
export function resolverNpc(texto, escena, npcsPresentes, verbo, { npcsAusentes = [] } = {}) {
  const exigido = VERBOS_NPC_EXIGIDO.includes(verbo);
  const automatico = VERBOS_NPC_AUTOMATICO.includes(verbo);
  const soloNombrado = VERBOS_NPC_SOLO_NOMBRADO.includes(verbo);
  if (!exigido && !automatico && !soloNombrado) return { estado: 'sin_objetivo' };

  const presentes = npcsPresentes ?? [];
  const entrada = tokenizar(texto);
  const reformular = (motivo, lista = []) => ({ estado: 'reformular', motivo, datos: { nombres: nombresDe(lista) } });
  const resuelto = (npc, ambiguo = false, reportes = []) => ({ estado: 'resuelto', npcId: npc.id, ambiguo, reportes });

  // 3.3 y 4.4: nombrados entre los presentes.
  const nombrados = presentes.filter((n) => nombraA(entrada, n));
  if (nombrados.length === 1) return resuelto(nombrados[0]);
  if (nombrados.length > 1) return reformular(MOTIVOS.NPC_AMBIGUO, nombrados);

  // 3.1: nombrado, pero está en otra escena. Solo con coincidencia exacta.
  const idsPresentes = new Set(presentes.map((n) => n.id));
  if (npcsAusentes.some((n) => !idsPresentes.has(n.id) && nombraA(entrada, n, true))) {
    return reformular(MOTIVOS.NPC_AUSENTE);
  }

  if (soloNombrado) return { estado: 'sin_objetivo' };

  // 4.1: hablar_con nunca elige por el jugador.
  if (exigido) return reformular(presentes.length === 0 ? MOTIVOS.SIN_NPCS : MOTIVOS.FALTA_NPC, presentes);

  // 4.2
  if (presentes.length === 1) return resuelto(presentes[0]);
  if (presentes.length === 0) {
    return VERBOS_SIN_OBJETIVO_PERMITIDO.includes(verbo) ? { estado: 'sin_objetivo' } : reformular(MOTIVOS.SIN_NPCS);
  }
  // Dos o más: resolverNpcObjetivo de la beta (menor relación; empate, el primero presente).
  const porId = new Map(presentes.map((n) => [n.id, { id: n.id, activo: true, relacion: { valor: n.relacion ?? 0 } }]));
  const { npc, reportes } = resolverNpcObjetivo(
    { nombre: verbo },
    { id: escena?.id, npcsPresentes: presentes.map((n) => n.id) },
    porId,
    { verbosConNpcObjetivo: [verbo] },
  );
  return resuelto(npc, true, reportes);
}

// ---------------------------------------------------------------------------
// Sección 4.3 y 4.4: objeto
// ---------------------------------------------------------------------------

/**
 * Resuelve el objeto de un verbo.
 * Un objeto está nombrado si la frase trae la primera palabra de su nombre.
 * Entre varios nombrados gana el que coincide con más palabras; si empatan, se reformula.
 * @param {string} texto
 * @param {string} verbo id de verbo
 * @param {{id: string, nombre: string}[]} objetosAplicables de la escena o del inventario, para ese verbo
 * @returns {{ estado: 'resuelto', objetoId: string }
 *   | { estado: 'sin_objeto' }
 *   | { estado: 'reformular', motivo: string, datos: { nombres: string[] } }}
 */
export function resolverObjeto(texto, verbo, objetosAplicables) {
  const exigido = VERBOS_OBJETO_EXIGIDO.includes(verbo);
  const opcional = VERBOS_OBJETO_OPCIONAL.includes(verbo);
  const soloNombrado = VERBOS_OBJETO_SOLO_NOMBRADO.includes(verbo);
  if (!exigido && !opcional && !soloNombrado) return { estado: 'sin_objeto' };

  const objetos = objetosAplicables ?? [];
  const entrada = tokenizar(texto);
  const reformular = (motivo, lista = []) => ({ estado: 'reformular', motivo, datos: { nombres: nombresDe(lista) } });
  const resuelto = (o) => ({ estado: 'resuelto', objetoId: o.id });

  // Nombrados, con la cantidad de palabras del nombre que trae la frase.
  const nombrados = [];
  for (const o of objetos) {
    const nombre = tokenizar(o.nombre ?? '');
    if (nombre.length === 0 || !entrada.some((p) => coincidePalabra(p, nombre[0]) >= 0)) continue;
    const puntos = nombre.filter((t) => entrada.some((p) => coincidePalabra(p, t) >= 0)).length;
    nombrados.push({ o, puntos });
  }
  if (nombrados.length > 0) {
    const maximo = Math.max(...nombrados.map((n) => n.puntos));
    const mejores = nombrados.filter((n) => n.puntos === maximo).map((n) => n.o);
    return mejores.length === 1 ? resuelto(mejores[0]) : reformular(MOTIVOS.OBJETO_AMBIGUO, mejores);
  }

  if (soloNombrado) return { estado: 'sin_objeto' };
  if (objetos.length === 1) return resuelto(objetos[0]);

  if (objetos.length === 0) {
    // examinar sin objetos examina la escena; atacar sin arma ataca sin arma.
    if (verbo === 'examinar' || verbo === 'atacar') return { estado: 'sin_objeto' };
    return reformular(MOTIVOS.SIN_OBJETOS);
  }
  // Varios y ninguno nombrado. Atacar usa el arma por defecto: la primera de la lista.
  if (verbo === 'atacar') return resuelto(objetos[0]);
  return reformular(MOTIVOS.FALTA_OBJETO, objetos);
}

// ---------------------------------------------------------------------------
// Sección 2.4: destino de viajar
// ---------------------------------------------------------------------------

const idDeCiudad = (ciudad) => `ciudad_${normalizar(ciudad).replace(/ /g, '_')}`;

/**
 * Destinos posibles, de tres tipos:
 * - `camino`: escenas de camino con horas de viaje.
 * - `ciudad`: las ciudades (`ciudad_*`).
 * - `escena`: escenas de ciudad (las que tienen `ciudad`).
 * @param {{id: string, nombre: string, ciudad?: string|null, viajeHoras?: number}[]} escenas
 */
export function destinosDeViaje(escenas) {
  const destinos = [];
  const ciudades = new Set();
  for (const e of escenas ?? []) {
    const terminos = tokenizar(e.nombre);
    if (typeof e.viajeHoras === 'number') {
      destinos.push({ id: e.id, tipo: 'camino', nombre: e.nombre, terminos });
    }
    if (typeof e.ciudad === 'string' && e.ciudad !== '') {
      const ciudadId = idDeCiudad(e.ciudad);
      destinos.push({ id: e.id, tipo: 'escena', nombre: e.nombre, terminos, ciudadId });
      if (!ciudades.has(e.ciudad) && DESTINOS_CIUDAD.includes(ciudadId)) {
        ciudades.add(e.ciudad);
        destinos.push({ id: ciudadId, tipo: 'ciudad', nombre: e.ciudad, terminos: tokenizar(e.ciudad) });
      }
    }
  }
  return destinos;
}

function nombraDestino(entrada, d) {
  const trae = (t) => entrada.some((p) => coincidePalabra(p, t) >= 0);
  // Camino: nombre completo, o su dirección sola si está escrita exacta ("norte").
  if (d.tipo === 'camino') return d.terminos.every(trae) || entrada.includes(d.terminos.at(-1));
  // Escena de ciudad: la primera palabra de su nombre ("taberna", "archivo").
  if (d.tipo === 'escena') return d.terminos.length > 0 && trae(d.terminos[0]);
  return d.terminos.every(trae);
}

/**
 * @returns {{ estado: 'resuelto', destino: string }
 *   | { estado: 'reformular', motivo: string, datos: { nombres: string[] } }}
 */
export function resolverDestino(texto, escenas) {
  const entrada = tokenizar(texto);
  let hallados = destinosDeViaje(escenas).filter((d) => nombraDestino(entrada, d));
  // "la biblioteca de Halenor": la escena gana sobre su propia ciudad.
  const ciudadesDeEscenas = new Set(hallados.filter((d) => d.tipo === 'escena').map((d) => d.ciudadId));
  hallados = hallados.filter((d) => !(d.tipo === 'ciudad' && ciudadesDeEscenas.has(d.id)));
  if (hallados.length === 1) return { estado: 'resuelto', destino: hallados[0].id };
  return {
    estado: 'reformular',
    motivo: hallados.length === 0 ? MOTIVOS.FALTA_DESTINO : MOTIVOS.DESTINO_AMBIGUO,
    datos: { nombres: nombresDe(hallados) },
  };
}

// ---------------------------------------------------------------------------
// Sección 1, paso 6: decidir
// ---------------------------------------------------------------------------

/**
 * Decide qué hacer con una frase del jugador.
 * @param {string} texto
 * @param {{
 *   intenciones: object[],
 *   escenas?: object[],
 *   escena?: { id: string },
 *   npcsPresentes?: object[],
 *   npcsAusentes?: object[],
 *   objetosAplicables?: object[] | ((verbo: string) => object[]),
 *   reformulacionPrevia?: boolean,
 * }} contexto `reformulacionPrevia`: ya se reformuló en este turno.
 * @returns {{ tipo: 'ejecutar', intencionId: string, parametros: object, repetirIntencionId: string|null, reportes: object[] }
 *   | { tipo: 'reformular', motivo: string, intencionId: string|null, datos: object }
 *   | { tipo: 'ia', intencionId: string|null }}
 */
export function decidir(texto, contexto = {}) {
  const coincidencia = coincidirIntencion(texto, contexto.intenciones);
  const intencionId = coincidencia?.intencionId ?? null;

  // Sección 5: una sola reformulación por turno. Después, IA.
  const reformular = (motivo, datos = {}) =>
    contexto.reformulacionPrevia ? { tipo: 'ia', intencionId } : { tipo: 'reformular', motivo, intencionId, datos };

  if (!coincidencia) return reformular(MOTIVOS.NO_ENTENDIDO);
  if (coincidencia.empateCon.length > 0) {
    const r = reformular(MOTIVOS.INTENCION_AMBIGUA);
    r.intencionId = null;
    return r;
  }

  const { verbo } = coincidencia;
  const parametros = {};
  const reportes = [];

  if (verbo === 'viajar') {
    const d = resolverDestino(texto, contexto.escenas);
    if (d.estado === 'reformular') return reformular(d.motivo, d.datos);
    parametros.destino = d.destino;
  }

  const npc = resolverNpc(texto, contexto.escena, contexto.npcsPresentes, verbo, { npcsAusentes: contexto.npcsAusentes });
  if (npc.estado === 'reformular') return reformular(npc.motivo, npc.datos);
  if (npc.estado === 'resuelto') {
    parametros.npcId = npc.npcId;
    reportes.push(...npc.reportes);
  }

  const aplicables =
    typeof contexto.objetosAplicables === 'function' ? contexto.objetosAplicables(verbo) : contexto.objetosAplicables;
  const objeto = resolverObjeto(texto, verbo, aplicables);
  if (objeto.estado === 'reformular') return reformular(objeto.motivo, objeto.datos);
  if (objeto.estado === 'resuelto') parametros.objetoId = objeto.objetoId;

  return {
    tipo: 'ejecutar',
    intencionId,
    parametros,
    repetirIntencionId: coincidencia.segundaIntencionId,
    reportes,
  };
}
