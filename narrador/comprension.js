// Comprensión del texto libre (docs/comprension-v1.md).
// Módulo puro: no escribe texto para el jugador. Devuelve acciones con un `motivo`;
// el texto de cada motivo lo pone la narración (bloque 4).
// El texto del jugador solo se lee: nunca vuelve en los datos de salida.
import { resolverNpcObjetivo } from '../core/orquestador/resolverNpcObjetivo.js';
import { DESTINOS_CIUDAD } from './contenido.js';
import { MOTIVOS, MOTIVO_SIN_SALIDAS } from './motivos.js';
import { TIPOS_LEXICO_VERBO } from './diccionarios.js';

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
// R4 (ajuste): verbos de acción de riesgo. Sin tolerancia a typos: solo la forma escrita exacta ("huri" no es huir).
export const VERBOS_DE_RIESGO = Object.freeze(['huir', 'atacar', 'emboscar', 'abortar', 'rendirse', 'defender']);
// R1c: intenciones de movimiento del catálogo (`contenido-v3.json`), por id: las que cambian al jugador de lugar.
// Escritas exactas, una frase con ellas no es una consulta de tema. Sale del catálogo (docs/comprension-v1.md §4).
export const INTENCIONES_MOVIMIENTO = Object.freeze(['intencion_viajar', 'intencion_retirarse']);
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

/**
 * Distancia de edición de Damerau-Levenshtein (R4): insertar, borrar, cambiar una letra o intercambiar dos letras
 * adyacentes cuesta 1 cada cosa. Corta en `tope + 1`.
 */
export function distanciaEdicion(a, b, tope = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let anterior = null; // fila i - 2
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + costo);
      if (anterior && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        fila[j] = Math.min(fila[j], anterior[j - 2] + 1);
      }
      if (fila[j] < minimo) minimo = fila[j];
    }
    if (minimo > tope && (!anterior || Math.min(...previa) > tope)) return tope + 1;
    anterior = previa;
    previa = fila;
  }
  return previa[b.length] > tope ? tope + 1 : previa[b.length];
}

/** Distancia máxima permitida para una palabra de ese largo. */
export function toleranciaPara(largo) {
  return largo <= 3 ? 0 : 1;
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
function buscarEnOrden(entrada, forma, { exacto = false, contiguo = false } = {}) {
  if (forma.length === 0) return null;
  if (contiguo) {
    // Todas las palabras juntas y en orden, desde cualquier posición de la frase.
    for (let inicio = 0; inicio + forma.length <= entrada.length; inicio++) {
      const m = buscarEnOrden(entrada.slice(inicio, inicio + forma.length), forma, { exacto });
      if (m && m.posiciones.every((p, k) => p === k)) return { posiciones: m.posiciones.map((p) => p + inicio), distancia: m.distancia };
    }
    return null;
  }
  const posiciones = [];
  let distancia = 0;
  let desde = 0;
  for (const palabra of forma) {
    let hallada = -1;
    for (let i = desde; i < entrada.length; i++) {
      const d = exacto ? (entrada[i] === palabra ? 0 : -1) : coincidePalabra(entrada[i], palabra);
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

const CONTRACCIONES = Object.freeze({ al: 'a', del: 'de' });

function parametrosPendientesDe(verbo) {
  const pendientes = [];
  if (verbo === 'viajar') pendientes.push('destino');
  if (VERBOS_NPC_EXIGIDO.includes(verbo) || VERBOS_NPC_AUTOMATICO.includes(verbo)) pendientes.push('npc');
  if (VERBOS_OBJETO_EXIGIDO.includes(verbo) || VERBOS_OBJETO_OPCIONAL.includes(verbo)) pendientes.push('objeto');
  return pendientes;
}

// Orden de 2.3: más palabras; después, menos typos (una coincidencia exacta le gana a una
// con typo); después, la forma completa (con sus palabras vacías) presente en la frase;
// después, la que aparece primero.
function compararCandidatos(a, b) {
  return b.palabras - a.palabras || a.distancia - b.distancia || b.formaCompleta - a.formaCompleta || a.inicio - b.inicio;
}

// R6: voseo. "viajá" → "viajar", "leé" → "leer", "dormí" → "dormir", pero solo si el infinitivo es una palabra de
// alguna forma del catálogo de intenciones. Se hace antes de sacar las tildes: después "viajá" y "viaja" son lo mismo.
const SUFIJOS_VOSEO = Object.freeze({ á: 'ar', é: 'er', í: 'ir' });
const palabrasDelCatalogo = new WeakMap();

function palabrasDeFormas(intenciones) {
  if (!Array.isArray(intenciones)) return new Set();
  if (!palabrasDelCatalogo.has(intenciones)) {
    palabrasDelCatalogo.set(intenciones, new Set(intenciones.flatMap((i) => (i.formas ?? []).flatMap((f) => palabras(f)))));
  }
  return palabrasDelCatalogo.get(intenciones);
}

/** R6: cambia las formas de voseo (-á, -é, -í) por el infinitivo cuando ese infinitivo existe en el catálogo. */
export function aVoseoInfinitivo(texto, intenciones) {
  if (typeof texto !== 'string') return texto;
  const conocidas = palabrasDeFormas(intenciones);
  if (conocidas.size === 0) return texto;
  return texto.normalize('NFC').replace(/[\p{L}\p{N}]+/gu, (palabra) => {
    const minuscula = palabra.toLowerCase();
    const terminacion = SUFIJOS_VOSEO[minuscula.at(-1)];
    if (!terminacion || minuscula.length < 3) return palabra;
    const infinitivo = minuscula.slice(0, -1) + terminacion;
    return conocidas.has(normalizar(infinitivo)) ? infinitivo : palabra;
  });
}

/**
 * Busca la intención de la frase.
 * `exacto`: sin tolerancia a typos (las palabras tienen que ser iguales). `contiguo`: las palabras de una forma
 * tienen que estar juntas, en orden.
 * @returns {null | {
 *   intencionId: string, verbo: string, parametrosPendientes: string[],
 *   segundaIntencionId: string|null, empateCon: string[]
 * }}
 */
export function coincidirIntencion(texto, intenciones, opciones = {}) {
  // R6: primero con el voseo llevado al infinitivo (frase y formas); si no coincide nada, la comparación de siempre.
  const conVoseo = aVoseoInfinitivo(texto, intenciones);
  return (
    (conVoseo !== texto ? coincidirIntencionBase(conVoseo, intenciones, opciones, true) : null) ??
    coincidirIntencionBase(texto, intenciones, opciones, false)
  );
}

function coincidirIntencionBase(texto, intenciones, opciones, voseo) {
  const forma_ = (f) => (voseo ? aVoseoInfinitivo(f, intenciones) : f);
  const entrada = tokenizar(texto);
  // Para la forma completa, "al" y "del" valen como "a" y "de": "irme al norte" trae la forma "irme a".
  const entradaCompleta = palabras(texto).map((p) => CONTRACCIONES[p] ?? p);
  if (entrada.length === 0 || !Array.isArray(intenciones)) return null;

  // Mejor forma de cada intención.
  const candidatos = [];
  for (const intencion of intenciones) {
    let mejor = null;
    // R4 (ajuste): los verbos de riesgo solo coinciden escritos exactos.
    const opcionesDe = VERBOS_DE_RIESGO.includes(intencion.verbo) ? { ...opciones, exacto: true } : opciones;
    for (const forma of (intencion.formas ?? [])) {
      const m = buscarEnOrden(entrada, tokenizar(forma_(forma)), opcionesDe);
      if (!m) continue;
      const completa = palabras(forma_(forma));
      const candidato = {
        intencionId: intencion.id,
        verbo: intencion.verbo,
        palabras: m.posiciones.length,
        formaCompleta: buscarEnOrden(entradaCompleta, completa, opcionesDe) ? completa.length : 0,
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

/** ¿Las palabras de `forma` están juntas y en orden en la frase? Coincidencia exacta. */
function contieneForma(entrada, forma) {
  return forma.length > 0 && entrada.some((_, i) => forma.every((t, k) => entrada[i + k] === t));
}

/** Mayor cantidad de palabras de una forma del léxico que la frase trae completa (0 si ninguna). */
function palabrasDeLexico(entrada, formas) {
  return Math.max(0, ...(formas ?? []).filter((f) => contieneForma(entrada, f)).map((f) => f.length));
}

function nombraA(entrada, npc, exacto = false, lexico = null) {
  return (
    terminosDeNpc(npc).some((t) => entrada.some((p) => (exacto ? p === t : coincidePalabra(p, t) >= 0))) ||
    palabrasDeLexico(entrada, lexico?.get(npc.id)) > 0
  );
}

const nombresDe = (lista) => lista.map((x) => x.nombre);

/** ¿La frase trae una palabra clave de un conocimiento de un NPC que no es `npc`? */
function traePalabraClaveDeOtro(entrada, npc, otros) {
  return (otros ?? []).some(
    (o) => o.id !== npc.id && (o.conocimientos ?? []).some((k) => (k.palabrasClave ?? []).some((c) => entrada.includes(normalizar(c)))),
  );
}

/**
 * Resuelve el NPC objetivo de un verbo.
 * @param {string} texto
 * @param {{id: string}} escena escena actual
 * @param {{id: string, nombre: string, alias?: string[], relacion?: number}[]} npcsPresentes
 * @param {string} verbo id de verbo
 * @param {{ npcsAusentes?: object[], lexico?: Map<string, string[][]> }} [opciones] `npcsAusentes`: NPCs de otras escenas,
 *   para avisar que no están. `lexico`: formas del diccionario léxico por id de NPC (palabras ya tokenizadas).
 * @returns {{ estado: 'resuelto', npcId: string, ambiguo: boolean, reportes: object[] }
 *   | { estado: 'sin_objetivo' }
 *   | { estado: 'reformular', motivo: string, datos: { nombres: string[] } }}
 */
export function resolverNpc(texto, escena, npcsPresentes, verbo, { npcsAusentes = [], lexico = null } = {}) {
  const exigido = VERBOS_NPC_EXIGIDO.includes(verbo);
  const automatico = VERBOS_NPC_AUTOMATICO.includes(verbo);
  const soloNombrado = VERBOS_NPC_SOLO_NOMBRADO.includes(verbo);
  if (!exigido && !automatico && !soloNombrado) return { estado: 'sin_objetivo' };

  const presentes = npcsPresentes ?? [];
  const entrada = tokenizar(texto);
  const reformular = (motivo, lista = []) => ({ estado: 'reformular', motivo, datos: { nombres: nombresDe(lista) } });
  const resuelto = (npc, ambiguo = false, reportes = []) => ({ estado: 'resuelto', npcId: npc.id, ambiguo, reportes });

  // 3.3 y 4.4: nombrados entre los presentes.
  const nombrados = presentes.filter((n) => nombraA(entrada, n, false, lexico));
  if (nombrados.length === 1) return resuelto(nombrados[0]);
  if (nombrados.length > 1) return reformular(MOTIVOS.NPC_AMBIGUO, nombrados);

  // 3.1: nombrado, pero está en otra escena. Solo con coincidencia exacta.
  const idsPresentes = new Set(presentes.map((n) => n.id));
  if (npcsAusentes.some((n) => !idsPresentes.has(n.id) && nombraA(entrada, n, true, lexico))) {
    return reformular(MOTIVOS.NPC_AUSENTE);
  }

  if (soloNombrado) return { estado: 'sin_objetivo' };

  // 4.1 (R2, R3): hablar_con sin nombre. Un solo NPC presente y ninguna palabra clave de otro NPC (presente o no):
  // es ese NPC. Con dos o más NPC, o con la palabra clave de un NPC ausente, se reformula.
  if (exigido && presentes.length === 1 && !traePalabraClaveDeOtro(entrada, presentes[0], npcsAusentes)) return resuelto(presentes[0]);
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
 * @param {{ lexico?: Map<string, string[][]> }} [opciones] `lexico`: formas del diccionario léxico por id de objeto.
 *   Una forma completa en la frase nombra al objeto, con tantos puntos como palabras tiene.
 * @returns {{ estado: 'resuelto', objetoId: string }
 *   | { estado: 'sin_objeto' }
 *   | { estado: 'reformular', motivo: string, datos: { nombres: string[] } }}
 */
export function resolverObjeto(texto, verbo, objetosAplicables, { lexico = null } = {}) {
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
    const porLexico = palabrasDeLexico(entrada, lexico?.get(o.id));
    const nombrado = nombre.length > 0 && entrada.some((p) => coincidePalabra(p, nombre[0]) >= 0);
    if (!nombrado && porLexico === 0) continue;
    const puntos = nombrado ? nombre.filter((t) => entrada.some((p) => coincidePalabra(p, t) >= 0)).length : 0;
    nombrados.push({ o, puntos: Math.max(puntos, porLexico) });
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
 * - `lugar`: lugares de camino (sin ciudad y sin horas de viaje).
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
    if (typeof e.viajeHoras !== 'number' && !(typeof e.ciudad === 'string' && e.ciudad !== '')) {
      destinos.push({ id: e.id, tipo: 'lugar', nombre: e.nombre, terminos });
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

function nombraDestino(entrada, d, exacto = false) {
  const trae = (t) => entrada.some((p) => (exacto ? p === t : coincidePalabra(p, t) >= 0));
  // Camino: nombre completo, o su dirección sola si está escrita exacta ("norte").
  if (d.tipo === 'camino') return d.terminos.every(trae) || entrada.includes(d.terminos.at(-1));
  // Escena de ciudad o lugar de camino: la primera palabra de su nombre ("taberna", "lago").
  if (d.tipo === 'escena' || d.tipo === 'lugar') return d.terminos.length > 0 && trae(d.terminos[0]);
  return d.terminos.every(trae);
}

/**
 * @returns {{ estado: 'resuelto', destino: string }
 *   | { estado: 'reformular', motivo: string, datos: { nombres: string[] } }}
 */
export function resolverDestino(texto, escenas, { lexico = null, exacto = false } = {}) {
  const entrada = tokenizar(texto);
  let hallados = destinosDeViaje(escenas).filter((d) => nombraDestino(entrada, d, exacto) || palabrasDeLexico(entrada, lexico?.get(d.id)) > 0);
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
// Diccionarios (docs/formato-diccionarios.md): léxico y ortografía
// ---------------------------------------------------------------------------
// Orden de prioridad al buscar la intención de una frase:
//   a. forma del catálogo, exacta;
//   b. forma del léxico (diccionario-lexico), exacta y con las palabras juntas;
//   c. la frase corregida por ortografía (ortografia-tipeo), y de nuevo a y b;
//   d. tolerancia a typos de la sección 2.1, como último recurso.
// Sin diccionarios, o si no cargan, solo corre la tolerancia a typos de siempre.

const PREPARADO = Symbol('diccionarios_preparados');
const preparados = new WeakMap();

/** Entradas de un diccionario, solo si cargó completo: sin errores y con al menos una entrada. */
function entradasDe(carga) {
  const ok = carga && Array.isArray(carga.cargados) && Array.isArray(carga.errores) && carga.errores.length === 0;
  return ok ? carga.cargados : [];
}

/**
 * Arma los índices de los diccionarios cargados (`cargarDiccionarios`) para `decidir`. Nunca lanza.
 * - Un diccionario con errores (archivo que falta, líneas descartadas, front matter mal) no se usa entero.
 * - Léxico: los tipos de verbo (infinitivo, conjugada, sinonimo, coloquial, regional) pasan a ser formas de su
 *   intención; objeto, npc y escena sirven para nombrar parámetros.
 * - Ortografía: `escrita` -> `correcta`, sin tildes. No se corrige una palabra `valida`, ni una palabra de verbo
 *   del catálogo o del léxico, ni una `escrita` con dos correcciones distintas.
 * @returns {object|null} null si no hay nada que usar
 */
export function prepararDiccionarios(cargados, intenciones) {
  try {
    if (cargados === null || typeof cargados !== 'object') return null;
    if (cargados[PREPARADO]) return cargados;
    const lista = Array.isArray(intenciones) ? intenciones : [];
    const previo = preparados.get(cargados);
    if (previo && previo.intenciones === intenciones) return previo.prep;

    const verboDe = new Map(lista.map((i) => [i.id, i.verbo]));
    const formasPorIntencion = new Map();
    const lexico = { npc: new Map(), objeto: new Map(), escena: new Map() };
    const palabrasDeVerbo = new Set(lista.flatMap((i) => (i.formas ?? []).flatMap((f) => tokenizar(f))));
    for (const e of entradasDe(cargados['diccionario-lexico'])) {
      const tokens = tokenizar(e.forma);
      if (tokens.length === 0) continue;
      if (TIPOS_LEXICO_VERBO.includes(e.tipo)) {
        if (!verboDe.has(e.id)) continue;
        if (!formasPorIntencion.has(e.id)) formasPorIntencion.set(e.id, []);
        formasPorIntencion.get(e.id).push(e.forma);
        tokens.forEach((t) => palabrasDeVerbo.add(t));
      } else if (lexico[e.tipo]) {
        if (!lexico[e.tipo].has(e.id)) lexico[e.tipo].set(e.id, []);
        lexico[e.tipo].get(e.id).push(tokens);
      }
    }

    const validas = new Set();
    const candidatas = new Map();
    for (const e of entradasDe(cargados['ortografia-tipeo'])) {
      const mal = normalizar(e.escrita);
      const bien = normalizar(e.correcta);
      if (e.tipo === 'valida') validas.add(mal);
      if (e.tipo === 'valida' || mal === '' || bien === '' || mal === bien) continue;
      // La misma escrita con dos correcciones distintas no se corrige.
      candidatas.set(mal, candidatas.has(mal) && candidatas.get(mal) !== bien ? null : bien);
    }
    const correcciones = new Map();
    for (const [mal, bien] of candidatas) {
      if (bien === null || validas.has(mal)) continue;
      if (!mal.includes(' ') && palabrasDeVerbo.has(mal)) continue;
      correcciones.set(mal, bien);
    }

    const prep = {
      [PREPARADO]: true,
      intencionesLexico: [...formasPorIntencion].map(([id, formas]) => ({ id, verbo: verboDe.get(id), formas })),
      lexicoNpc: lexico.npc,
      lexicoObjeto: lexico.objeto,
      lexicoEscena: lexico.escena,
      correcciones,
      maxPalabrasCorreccion: Math.max(1, ...[...correcciones.keys()].map((k) => k.split(' ').length)),
    };
    const hayAlgo = prep.intencionesLexico.length > 0 || correcciones.size > 0 || lexico.npc.size + lexico.objeto.size + lexico.escena.size > 0;
    const resultado = hayAlgo ? prep : null;
    preparados.set(cargados, { intenciones, prep: resultado });
    return resultado;
  } catch {
    return null;
  }
}

/**
 * Corrige la frase por ortografía: reemplaza cada palabra (o frase) mal escrita por la correcta.
 * Devuelve la frase corregida y normalizada, o null si no cambió nada.
 */
export function corregirOrtografia(texto, diccionarios) {
  const mapa = diccionarios?.correcciones;
  if (!(mapa instanceof Map) || mapa.size === 0) return null;
  const ws = palabras(texto);
  const salida = [];
  let cambio = false;
  for (let i = 0; i < ws.length; ) {
    let paso = 1;
    let reemplazo = null;
    for (let k = Math.min(diccionarios.maxPalabrasCorreccion, ws.length - i); k >= 1; k--) {
      const bien = mapa.get(ws.slice(i, i + k).join(' '));
      if (bien !== undefined) {
        reemplazo = bien;
        paso = k;
        break;
      }
    }
    salida.push(reemplazo ?? ws[i]);
    if (reemplazo !== null) cambio = true;
    i += paso;
  }
  return cambio ? salida.join(' ') : null;
}

/**
 * Busca la intención con la prioridad de arriba.
 * @returns {{ coincidencia: object|null, texto: string, porLexico: boolean }} `texto`: la frase con la que se
 *   encontró (corregida, si hizo falta); sirve para resolver los parámetros. `porLexico`: la intención salió del léxico.
 */
export function coincidirConDiccionarios(texto, intenciones, diccionarios) {
  const solo = () => ({ coincidencia: coincidirIntencion(texto, intenciones), texto, porLexico: false });
  if (!diccionarios) return solo();
  try {
    // a. Si hay una forma exacta, el resultado es el de siempre (puede traer una segunda intención con typos).
    const delCatalogo = (t) => (coincidirIntencion(t, intenciones, { exacto: true }) ? coincidirIntencion(t, intenciones) : null);
    // b. Léxico: exacto y con las palabras juntas. Una forma con dos intenciones queda empatada: se reformula.
    const delLexico = (t) =>
      diccionarios.intencionesLexico.length > 0
        ? coincidirIntencion(t, diccionarios.intencionesLexico, { exacto: true, contiguo: true })
        : null;
    let c = delCatalogo(texto);
    if (c) return { coincidencia: c, texto, porLexico: false };
    c = delLexico(texto);
    if (c) return { coincidencia: c, texto, porLexico: true };
    // c. Ortografía. Solo si no hubo una forma exacta: un verbo ya reconocido no se toca.
    const corregido = corregirOrtografia(texto, diccionarios);
    if (corregido !== null) {
      c = delCatalogo(corregido);
      if (c) return { coincidencia: c, texto: corregido, porLexico: false };
      c = delLexico(corregido);
      if (c) return { coincidencia: c, texto: corregido, porLexico: true };
    }
    // d. Tolerancia a typos.
    c = coincidirIntencion(texto, intenciones);
    if (c || corregido === null) return { coincidencia: c, texto, porLexico: false };
    return { coincidencia: coincidirIntencion(corregido, intenciones), texto: corregido, porLexico: false };
  } catch {
    return solo();
  }
}

// ---------------------------------------------------------------------------
// Preguntas y consultas de tema
// ---------------------------------------------------------------------------

// Palabras que marcan una pregunta aunque falte el signo. Se comparan en minúsculas y con su tilde:
// "cómo" pregunta, "como" no.
export const PALABRAS_PREGUNTA = Object.freeze(['cómo', 'cuál', 'sabés', 'sabes', 'conviene']);

/**
 * ¿La frase trae una forma de viajar del catálogo escrita tal cual (sin tildes, en minúsculas)?
 * Un typo, por chico que sea, no cuenta: la tolerancia a typos no dispara viajar.
 */
function hayVerboDeViajeExacto(texto, intenciones) {
  const entrada = tokenizar(texto);
  return (intenciones ?? [])
    .filter((i) => i.verbo === 'viajar')
    .flatMap((i) => i.formas ?? [])
    .some((forma) => buscarEnOrden(entrada, tokenizar(forma), { exacto: true }) !== null);
}

/**
 * ¿La frase es solo palabras de una lista (saludos o reconocimientos), sin ninguna otra?
 * Las frases de la lista se pueden juntar: "hola, buenas tardes" son dos saludos. Sin tildes ni signos.
 */
export function esSoloDeLista(texto, lista) {
  const ws = palabras(texto);
  if (ws.length === 0 || !Array.isArray(lista)) return false;
  const frases = lista.map((f) => palabras(f)).filter((f) => f.length > 0);
  const cubre = Array(ws.length + 1).fill(false);
  cubre[0] = true;
  for (let i = 0; i < ws.length; i++) {
    if (!cubre[i]) continue;
    for (const f of frases) {
      if (f.every((p, k) => ws[i + k] === p)) cubre[i + f.length] = true;
    }
  }
  return cubre[ws.length];
}

/** ¿La frase es una pregunta? Trae un signo de pregunta o una palabra interrogativa. */
export function esPregunta(texto) {
  if (typeof texto !== 'string') return false;
  if (/[?¿]/.test(texto)) return true;
  return texto.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).some((p) => PALABRAS_PREGUNTA.includes(p));
}

/**
 * A quién se le pregunta y por qué tema.
 * - NPC: el nombrado entre los presentes; si no se nombra a nadie, cualquiera de los presentes.
 * - Tema: el conocimiento con más `palabrasClave` en la frase (coincidencia exacta, ya normalizada).
 *   Con empate, el primero.
 * - Sin tema: el primer NPC nombrado o, si no, el primero presente. Sin NPCs, `npcId` es null.
 * @param {string} texto
 * @param {{id: string, nombre: string, alias?: string[], conocimientos?: {id: string, palabrasClave?: string[]}[]}[]} npcsPresentes
 * @returns {{ npcId: string|null, conocimientoId: string|null }}
 */
export function resolverConsulta(texto, npcsPresentes, { lexico = null } = {}) {
  const presentes = npcsPresentes ?? [];
  const entrada = palabras(texto);
  const sinVacias = tokenizar(texto);
  const nombrados = presentes.filter((n) => nombraA(entrada, n) || palabrasDeLexico(sinVacias, lexico?.get(n.id)) > 0);
  const candidatos = nombrados.length > 0 ? nombrados : presentes;
  let mejor = null;
  const dueños = new Map(); // palabra clave de la frase -> NPCs que la tienen
  for (const n of candidatos) {
    for (const k of n.conocimientos ?? []) {
      const claves = new Set((k.palabrasClave ?? []).map(normalizar).filter((c) => c !== '' && entrada.includes(c)));
      for (const c of claves) dueños.set(c, new Set([...(dueños.get(c) ?? []), n.id]));
      const puntos = claves.size;
      if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { npcId: n.id, conocimientoId: k.id, puntos };
    }
  }
  if (mejor) {
    // R1: una palabra clave que tienen dos o más NPCs de los candidatos no dice a quién se le pregunta.
    const ids = new Set([...dueños.values()].filter((d) => d.size > 1).flatMap((d) => [...d]));
    const ambiguos = candidatos.filter((n) => ids.has(n.id));
    return { npcId: mejor.npcId, conocimientoId: mejor.conocimientoId, ...(ambiguos.length > 0 ? { ambiguos } : {}) };
  }
  return { npcId: candidatos[0]?.id ?? null, conocimientoId: null };
}

// ---------------------------------------------------------------------------
// Sección 1, paso 6: decidir
// ---------------------------------------------------------------------------

/** R1c: ¿la frase trae un verbo de movimiento del catálogo escrito exacto? */
function esOrdenDeMovimiento(texto, intenciones) {
  const exacta = coincidirIntencion(texto, intenciones, { exacto: true });
  return exacta !== null && INTENCIONES_MOVIMIENTO.includes(exacta.intencionId);
}

/**
 * R1b: "hablar con X" (forma exacta o con la tolerancia de R4) donde X es una referencia del léxico a un NPC presente
 * ("el de la harina"). Las palabras clave que trae la frase son parte de esa referencia, no un tema: se ejecuta hablar_con.
 */
function esHablarConReferencia(texto, coincidencia, presentes, lexico) {
  if (coincidencia?.verbo !== 'hablar_con' || !lexico) return false;
  const entrada = tokenizar(texto);
  return (presentes ?? []).some((n) => {
    const formas = (lexico.get(n.id) ?? []).filter((f) => contieneForma(entrada, f));
    if (formas.length === 0) return false;
    const deLaReferencia = new Set(formas.flat());
    const claves = (n.conocimientos ?? []).flatMap((k) => (k.palabrasClave ?? []).map(normalizar)).filter((c) => c !== '' && entrada.includes(c));
    return claves.every((c) => deLaReferencia.has(c));
  });
}

/**
 * ¿La frase trae una forma de `hablar_con` de dos palabras o más, con su preposición ("hablar con", "charlá con",
 * "preguntarle a"), juntas y en orden? "hablame sobre el tratado" no: es un tema, no una orden de hablar con alguien.
 */
function esHablarConExplicito(texto, intenciones) {
  const entrada = palabras(aVoseoInfinitivo(texto, intenciones));
  return (intenciones ?? [])
    .filter((i) => i.verbo === 'hablar_con')
    .flatMap((i) => i.formas ?? [])
    .some((f) => {
      const forma = palabras(aVoseoInfinitivo(f, intenciones));
      return forma.length >= 2 && buscarEnOrden(entrada, forma, { contiguo: true }) !== null;
    });
}

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
 *   diccionarios?: object, saludos?: string[], reconocimientos?: string[],
 * }} contexto `reformulacionPrevia`: ya se reformuló en este turno. `diccionarios`: lo que devuelve
 *   `cargarDiccionarios` (o `prepararDiccionarios`); sin él, o si no sirve, se usa el catálogo solo.
 * @returns {{ tipo: 'ejecutar', intencionId: string, parametros: object, repetirIntencionId: string|null, reportes: object[] }
 *   | { tipo: 'reformular', motivo: string, intencionId: string|null, datos: object }
 *   | { tipo: 'consulta', npcId: string|null, conocimientoId: string|null }
 *   | { tipo: 'saludo'|'reconocimiento', npcId: string|null }
 *   | { tipo: 'ia', intencionId: string|null }}
 * `consulta`: una pregunta que no se ejecuta como acción. Una pregunta nunca dispara viajar.
 */
export function decidir(texto, contexto = {}) {
  const diccionarios = prepararDiccionarios(contexto.diccionarios, contexto.intenciones);
  // `t`: la frase con la que se encontró la intención (corregida por ortografía, si hizo falta).
  const { coincidencia, texto: t, porLexico } = coincidirConDiccionarios(texto, contexto.intenciones, diccionarios);
  const intencionId = coincidencia?.intencionId ?? null;

  // Sección 5: una sola reformulación por turno. Después, IA.
  const reformular = (motivo, datos = {}) =>
    contexto.reformulacionPrevia ? { tipo: 'ia', intencionId } : { tipo: 'reformular', motivo, intencionId, datos };

  // Saludo o reconocimiento: la frase es solo palabras de `saludos` o de `reconocimientos` del contenido.
  for (const tipo of ['saludo', 'reconocimiento']) {
    if (esSoloDeLista(texto, contexto[`${tipo}s`])) return { tipo, npcId: contexto.npcsPresentes?.[0]?.id ?? null };
  }

  // Preguntas: sin intención, con verbo de viaje o sobre un tema de un NPC presente, son consultas.
  if (esPregunta(texto)) {
    const { ambiguos: _ambiguos, ...consulta } = resolverConsulta(t, contexto.npcsPresentes, { lexico: diccionarios?.lexicoNpc });
    if (!coincidencia || coincidencia.verbo === 'viajar' || consulta.conocimientoId !== null) {
      return { tipo: 'consulta', ...consulta };
    }
  }

  // R1: frase sin pregunta con una palabra clave de un conocimiento de un NPC presente: consulta de tema con ese NPC.
  // Si la palabra clave es de dos o más NPC presentes, se reformula. "tratado", "hablame del tratado".
  if (!esPregunta(texto)) {
    const { ambiguos, ...consulta } = resolverConsulta(t, contexto.npcsPresentes, { lexico: diccionarios?.lexicoNpc });
    if (consulta.conocimientoId !== null && !esOrdenDeMovimiento(t, contexto.intenciones) && !esHablarConReferencia(t, coincidencia, contexto.npcsPresentes, diccionarios?.lexicoNpc)) {
      // "hablar con" explícito, sin nombrar a nadie y sin léxico de NPC: la palabra clave no identifica a quién; se pregunta.
      const presentes = contexto.npcsPresentes ?? [];
      const nombra = presentes.some((n) => nombraA(tokenizar(t), n, false, diccionarios?.lexicoNpc));
      if (coincidencia?.verbo === 'hablar_con' && !nombra && esHablarConExplicito(t, contexto.intenciones)) {
        return reformular(MOTIVOS.FALTA_NPC, { nombres: nombresDe(presentes) });
      }
      if (ambiguos) return reformular(MOTIVOS.NPC_AMBIGUO, { nombres: nombresDe(ambiguos) });
      return { tipo: 'consulta', ...consulta };
    }
  }

  // Viajar: el verbo de viaje cuenta solo si aparece exacto en lo que escribió el jugador (en el catálogo o en el
  // léxico). Una palabra que se parece ("viejo", "vieja", "viajr") por la tolerancia a typos, o que la ortografía
  // corrigió ("biajar"), no viaja, aunque haya un destino válido.
  const corregido = t !== texto;
  if (coincidencia?.verbo === 'viajar' && (corregido || !(porLexico || hayVerboDeViajeExacto(texto, contexto.intenciones)))) {
    const r = reformular(MOTIVOS.NO_ENTENDIDO);
    r.intencionId = null;
    return r;
  }

  if (!coincidencia) return reformular(MOTIVOS.NO_ENTENDIDO);
  if (coincidencia.empateCon.length > 0) {
    const r = reformular(MOTIVOS.INTENCION_AMBIGUA);
    r.intencionId = null;
    return r;
  }

  const { verbo } = coincidencia;
  const parametros = {};
  const reportes = [];

  // "salir de acá" (retirarse, sin destino): se va por la salida de la escena si hay una sola; con varias se pregunta
  // cuál (por nombre); sin salidas se avisa. Si la escena no está en el contenido, se ejecuta como antes.
  if (verbo === 'retirarse') {
    const actual = (contexto.escenas ?? []).find((e) => e.id === contexto.escena?.id);
    if (Array.isArray(actual?.salidas)) {
      const salidas = actual.salidas.map((id) => contexto.escenas.find((e) => e.id === id)).filter(Boolean);
      if (salidas.length === 0) return reformular(MOTIVO_SIN_SALIDAS);
      if (salidas.length > 1) return reformular(MOTIVOS.DESTINO_AMBIGUO, { nombres: nombresDe(salidas) });
      const viajar = contexto.intenciones.find((i) => i.verbo === 'viajar');
      return {
        tipo: 'ejecutar',
        intencionId: viajar.id,
        parametros: { destino: salidas[0].id },
        repetirIntencionId: coincidencia.segundaIntencionId,
        reportes,
      };
    }
  }

  if (verbo === 'viajar') {
    // El destino también tiene que estar escrito bien: "viajá al nrte" no viaja.
    const d = resolverDestino(t, contexto.escenas, { lexico: diccionarios?.lexicoEscena, exacto: true });
    if (d.estado === 'reformular') return reformular(d.motivo, d.datos);
    parametros.destino = d.destino;
  }

  const npc = resolverNpc(t, contexto.escena, contexto.npcsPresentes, verbo, {
    npcsAusentes: contexto.npcsAusentes,
    lexico: diccionarios?.lexicoNpc,
  });
  if (npc.estado === 'reformular') return reformular(npc.motivo, npc.datos);
  if (npc.estado === 'resuelto') {
    parametros.npcId = npc.npcId;
    reportes.push(...npc.reportes);
  }

  const aplicables =
    typeof contexto.objetosAplicables === 'function' ? contexto.objetosAplicables(verbo) : contexto.objetosAplicables;
  const objeto = resolverObjeto(t, verbo, aplicables, { lexico: diccionarios?.lexicoObjeto });
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
