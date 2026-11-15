// Diccionarios de comprensión (data/diccionarios/*.md): solo carga y validación.
// Todavía no los usa comprension.js. Carga en memoria; no escribe nada y nunca lanza.
// Formato de cada archivo: front matter (tipo, version, entradas), títulos con `#` y una entrada por línea,
// con columnas separadas por `|`.
// SIN VERIFICAR: la lectura por `fetch` en el navegador.
import { DESTINOS_CIUDAD, ESTADOS_ESCENA } from './contenido.js';

export const DIR_DICCIONARIOS = new URL('../data/diccionarios/', import.meta.url);

export const TIPOS_LEXICO_VERBO = Object.freeze(['infinitivo', 'conjugada', 'sinonimo', 'coloquial', 'regional']);
export const TIPOS_LEXICO = Object.freeze([...TIPOS_LEXICO_VERBO, 'objeto', 'npc', 'escena']);
export const TIPOS_ORTOGRAFIA = Object.freeze([
  'tilde', 'b_v', 'll_y', 's_z_c', 'h', 'g_j', 'qu_k', 'tecla_adyacente', 'letra_repetida', 'letra_omitida',
  'letra_cambiada', 'voseo_mal', 'apocope', 'valida',
]);
// Segunda columna de frases-patrones que no es un id de intención.
export const CATEGORIAS_FRASE = Object.freeze(['consulta', 'multi', 'ignorar']);
export const PARAMETROS_FRASE = Object.freeze(['npc', 'objeto', 'destino', 'tema', 'primera', 'segunda']);
// Cuarta columna de contexto-palabras que no es un id de escena.
export const ESTADOS_CONTEXTO = Object.freeze(['siempre', ...ESTADOS_ESCENA]);
export const SIN_VALOR = '-';
export const TODOS = '*';
export const BLOQUE_CONOCIMIENTOS = 'conocimientos';

const lista = (v) => (Array.isArray(v) ? v : []);

/** Ids del contenido, por clase. */
function idsDe(contenido) {
  const ids = (l) => new Set(lista(l).map((x) => x?.id).filter((id) => typeof id === 'string'));
  return {
    intencion: ids(contenido?.intenciones),
    objeto: ids(contenido?.objetos),
    npc: ids(contenido?.npcs),
    escena: ids(contenido?.escenas),
    evento: ids(contenido?.eventos),
    ciudad: new Set(DESTINOS_CIUDAD),
    conocimiento: new Set(lista(contenido?.npcs).flatMap((n) => lista(n?.conocimientos).map((k) => k?.id))),
  };
}

class LineaInvalida extends Error {}
const fallo = (motivo) => {
  throw new LineaInvalida(motivo);
};

/** Exige que el id exista en alguna de las clases. */
function exigirId(ids, id, clases) {
  if (!clases.some((c) => ids[c].has(id))) fallo(`id inexistente ${JSON.stringify(id)} (se esperaba ${clases.join(' o ')})`);
  return id;
}

function exigirValor(valor, permitidos, que) {
  if (!permitidos.includes(valor)) fallo(`${que} inválido ${JSON.stringify(valor)}`);
  return valor;
}

/** Lista separada por `;`, sin elementos vacíos. */
function listaDe(texto, que) {
  const partes = texto.split(';').map((p) => p.trim());
  if (partes.some((p) => p === '')) fallo(`${que}: lista con un elemento vacío`);
  return partes;
}

const CLASES_DE_PARAMETRO = Object.freeze({
  npc: ['npc'],
  objeto: ['objeto'],
  destino: ['escena', 'ciudad'],
  tema: ['npc', 'objeto', 'escena', 'ciudad', 'evento', 'conocimiento'],
  primera: ['intencion'],
  segunda: ['intencion'],
});

/**
 * Formato de cada archivo: cantidad de columnas y cómo se lee una línea.
 * `leer(columnas, ids, seccion)` devuelve la entrada o lanza LineaInvalida con el motivo.
 */
export const FORMATOS = Object.freeze({
  'diccionario-lexico': {
    archivo: 'diccionario-lexico.md',
    columnas: () => 3,
    // forma | id | tipo
    leer([forma, id, tipo], ids) {
      exigirValor(tipo, TIPOS_LEXICO, 'tipo');
      const clases = TIPOS_LEXICO_VERBO.includes(tipo) ? ['intencion'] : tipo === 'escena' ? ['escena', 'ciudad'] : [tipo];
      return { forma, id: exigirId(ids, id, clases), tipo };
    },
  },
  'ortografia-tipeo': {
    archivo: 'ortografia-tipeo.md',
    columnas: () => 3,
    // escrita | correcta | tipo
    leer([escrita, correcta, tipo]) {
      exigirValor(tipo, TIPOS_ORTOGRAFIA, 'tipo');
      if (tipo === 'valida' && escrita !== correcta) fallo('una palabra válida tiene que ser igual en las dos columnas');
      return { escrita, correcta, tipo };
    },
  },
  'frases-patrones': {
    archivo: 'frases-patrones.md',
    columnas: () => 4,
    // patrón | intención o categoría | parámetros (`-` o `clave=id ; clave=id`) | ejemplo
    leer([patron, categoria, crudos, ejemplo], ids) {
      if (!CATEGORIAS_FRASE.includes(categoria)) exigirId(ids, categoria, ['intencion']);
      const parametros = {};
      if (crudos !== SIN_VALOR) {
        for (const par of listaDe(crudos, 'parámetros')) {
          const corte = par.indexOf('=');
          const clave = corte < 0 ? par : par.slice(0, corte).trim();
          const valor = corte < 0 ? '' : par.slice(corte + 1).trim();
          exigirValor(clave, PARAMETROS_FRASE, 'parámetro');
          if (Object.hasOwn(parametros, clave)) fallo(`parámetro repetido ${JSON.stringify(clave)}`);
          parametros[clave] = exigirId(ids, valor, CLASES_DE_PARAMETRO[clave]);
        }
      }
      return { patron, categoria, parametros, ejemplo };
    },
  },
  'contexto-palabras': {
    archivo: 'contexto-palabras.md',
    columnas: () => 4,
    // palabra | sentido | id o `-` | estado de escena, `siempre` o id de escena
    leer([palabra, sentido, id, estado], ids) {
      if (id !== SIN_VALOR) exigirId(ids, id, ['intencion', 'objeto', 'npc', 'escena', 'ciudad']);
      if (!ESTADOS_CONTEXTO.includes(estado)) {
        if (!estado.startsWith('escena_')) fallo(`estado inválido ${JSON.stringify(estado)}`);
        exigirId(ids, estado, ['escena']);
      }
      return { palabra, sentido, id: id === SIN_VALOR ? null : id, estado };
    },
  },
  'temas-conocimiento': {
    archivo: 'temas-conocimiento.md',
    columnas: () => 2,
    // Bloque de conocimientos: id de conocimiento | temas. Los demás bloques: tema | NPCs que hablan de eso.
    leer([primera, segunda], ids, seccion) {
      if (seccion === BLOQUE_CONOCIMIENTOS) {
        return { bloque: BLOQUE_CONOCIMIENTOS, conocimientoId: exigirId(ids, primera, ['conocimiento']), temas: listaDe(segunda, 'temas') };
      }
      // `*`: cualquier NPC habla de ese tema.
      if (segunda === TODOS) return { bloque: seccion, tema: primera, npcs: [TODOS] };
      return { bloque: seccion, tema: primera, npcs: listaDe(segunda, 'NPCs').map((n) => exigirId(ids, n, ['npc'])) };
    },
  },
});

export const NOMBRES_DICCIONARIOS = Object.freeze(Object.keys(FORMATOS));

/** Front matter: bloque entre dos líneas `---` al principio. Devuelve los campos y dónde sigue el cuerpo, o null. */
function leerFrontMatter(lineas) {
  if (lineas[0]?.trim() !== '---') return null;
  const fin = lineas.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (fin < 0) return null;
  const campos = {};
  for (const l of lineas.slice(1, fin)) {
    const corte = l.indexOf(':');
    if (corte > 0) campos[l.slice(0, corte).trim()] = l.slice(corte + 1).trim();
  }
  return { campos, sigue: fin + 1 };
}

const enteroDe = (texto) => (/^\d+$/.test(String(texto ?? '')) ? Number(texto) : null);

/**
 * Valida el texto de un diccionario contra el contenido.
 * - Una línea con columnas de más o de menos, una columna vacía, un tipo o valor no permitido o un id que no existe
 *   en el contenido se descarta y queda en `descartados` y en `errores`. La carga sigue.
 * - `entradas` del front matter tiene que ser la cantidad de líneas de datos del archivo (ni vacías ni títulos).
 * @param {string} nombre uno de NOMBRES_DICCIONARIOS
 * @param {string} texto
 * @param {object} contenido contenido-v3.json
 * @returns {{ cargados: object[], descartados: { linea: number, texto: string, motivo: string }[], errores: string[] }}
 */
export function validarDiccionario(nombre, texto, contenido) {
  const cargados = [];
  const descartados = [];
  const errores = [];
  const salida = { cargados, descartados, errores };
  try {
    const formato = Object.hasOwn(FORMATOS, nombre) ? FORMATOS[nombre] : null;
    if (!formato) {
      errores.push(`diccionario desconocido ${JSON.stringify(nombre)}`);
      return salida;
    }
    if (typeof texto !== 'string') {
      errores.push(`${formato.archivo}: no se pudo leer`);
      return salida;
    }
    const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
    const frente = leerFrontMatter(lineas);
    let declaradas = null;
    if (!frente) {
      errores.push(`${formato.archivo}: falta el front matter`);
    } else {
      const { tipo, version, entradas } = frente.campos;
      if (tipo !== nombre) errores.push(`${formato.archivo}: tipo ${JSON.stringify(tipo ?? null)}, se esperaba ${JSON.stringify(nombre)}`);
      if (!(enteroDe(version) >= 1)) errores.push(`${formato.archivo}: version inválida ${JSON.stringify(version ?? null)}`);
      declaradas = enteroDe(entradas);
      if (declaradas === null) errores.push(`${formato.archivo}: entradas inválido ${JSON.stringify(entradas ?? null)}`);
    }

    const ids = idsDe(contenido);
    let seccion = null;
    let lineasDeDatos = 0;
    for (let i = frente ? frente.sigue : 0; i < lineas.length; i++) {
      const cruda = lineas[i].trim();
      if (cruda === '') continue;
      if (cruda.startsWith('#')) {
        seccion = cruda.replace(/^#+/, '').trim().toLowerCase();
        continue;
      }
      lineasDeDatos++;
      const numero = i + 1;
      try {
        const columnas = cruda.split('|').map((c) => c.trim());
        const esperadas = formato.columnas(seccion);
        if (columnas.length !== esperadas) fallo(`tiene ${columnas.length} columnas, se esperaban ${esperadas}`);
        if (columnas.some((c) => c === '')) fallo('tiene una columna vacía');
        cargados.push({ linea: numero, seccion, ...formato.leer(columnas, ids, seccion) });
      } catch (e) {
        const motivo = e instanceof LineaInvalida ? e.message : 'línea ilegible';
        descartados.push({ linea: numero, texto: cruda, motivo });
        errores.push(`${formato.archivo}:${numero}: ${motivo}`);
      }
    }
    if (declaradas !== null && declaradas !== lineasDeDatos) {
      errores.push(`${formato.archivo}: el front matter dice ${declaradas} entradas y hay ${lineasDeDatos}`);
    }
  } catch (e) {
    errores.push(`${nombre}: ${e instanceof Error ? e.message : 'error al validar'}`);
  }
  return salida;
}

/** Lee un archivo de texto: disco en Node, `fetch` en el navegador (sin verificar). */
async function leerPorDefecto(url) {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFile } = await import('node:fs/promises');
    return readFile(url, 'utf8');
  }
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.text();
}

/**
 * Carga y valida los cinco diccionarios. Nunca lanza: un archivo que falta o no se puede leer
 * devuelve su error y los demás se cargan igual.
 * @param {object} contenido contenido-v3.json
 * @param {{ dir?: URL|string, leer?: (url: URL) => Promise<string> }} [opciones] `dir`: carpeta (URL o ruta) de los archivos
 * @returns {Promise<Record<string, { cargados: object[], descartados: object[], errores: string[] }>>} una clave por diccionario
 */
export async function cargarDiccionarios(contenido, opciones = {}) {
  const resultado = {};
  for (const nombre of NOMBRES_DICCIONARIOS) {
    const { archivo } = FORMATOS[nombre];
    try {
      const leer = typeof opciones?.leer === 'function' ? opciones.leer : leerPorDefecto;
      const texto = await leer(urlDe(opciones?.dir, archivo));
      resultado[nombre] = validarDiccionario(nombre, texto, contenido);
    } catch (e) {
      const detalle = e?.code === 'ENOENT' ? 'no existe' : e instanceof Error ? e.message : 'error';
      resultado[nombre] = { cargados: [], descartados: [], errores: [`${archivo}: no se pudo leer (${detalle})`] };
    }
  }
  return resultado;
}

function urlDe(dir, archivo) {
  if (dir == null) return new URL(archivo, DIR_DICCIONARIOS);
  if (dir instanceof URL) return new URL(archivo, dir.href.endsWith('/') ? dir : `${dir.href}/`);
  // Ruta de disco: se une a mano para no depender de node:path en el navegador.
  return `${String(dir).replace(/[\\/]+$/, '')}/${archivo}`;
}
