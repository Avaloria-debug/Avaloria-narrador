// Lógica pura de la página de prueba (narrador/prueba/index.html): qué se ofrece en la escena
// actual y qué se muestra en el panel después de un turno. Sin DOM: se prueba con `node --test`.
// No escribe texto de narración: solo ordena lo que devuelve `narrar`.
import { npcsPresentes, objetosAplicables } from '../turno.js';

export const CLAVE_LOCALSTORAGE_GROQ = 'narrador_prueba_groq_key';
export const BD_PRUEBA = 'narrador_prueba';
export const CLAVE_PARTIDA = 'partida';

const lista = (v) => (Array.isArray(v) ? v : []);
const porId = (l, id) => lista(l).find((x) => x.id === id);

/**
 * Lo que la página ofrece para la escena actual: un botón por intención y las listas para
 * elegir NPC, objeto y destino (parámetros opcionales del botón).
 * @returns {{
 *   escena: { id: string, nombre: string } | null,
 *   intenciones: { id: string, verbo: string, etiqueta: string }[],
 *   npcs: { id: string, nombre: string }[],
 *   objetos: { id: string, nombre: string }[],
 *   destinos: { id: string, nombre: string }[],
 * }}
 */
export function opcionesDeEscena(estado, contenido) {
  const escena = porId(contenido?.escenas, estado?.jugador?.escenaId);
  const intenciones = lista(contenido?.intenciones).map((i) => ({ id: i.id, verbo: i.verbo, etiqueta: lista(i.formas)[0] ?? i.verbo }));
  if (!escena) return { escena: null, intenciones, npcs: [], objetos: [], destinos: [] };
  const objetos = new Map();
  for (const i of lista(contenido.intenciones)) {
    for (const o of objetosAplicables(estado, contenido, i.verbo)) objetos.set(o.id, o.nombre);
  }
  return {
    escena: { id: escena.id, nombre: escena.nombre },
    intenciones,
    npcs: npcsPresentes(estado, contenido).map((n) => ({ id: n.id, nombre: n.nombre })),
    objetos: [...objetos].map(([id, nombre]) => ({ id, nombre })),
    destinos: lista(escena.salidas).map((id) => ({ id, nombre: porId(contenido.escenas, id)?.nombre ?? id })),
  };
}

/** Entrada de botón para `narrar`. Los parámetros vacíos no se mandan. */
export function entradaDeBoton(intencionId, { npcId = '', objetoId = '', destino = '' } = {}) {
  const parametros = {};
  if (npcId) parametros.npcId = npcId;
  if (objetoId) parametros.objetoId = objetoId;
  if (destino) parametros.destino = destino;
  return { tipo: 'boton', intencionId, parametros };
}

/** Lo que se anota de una respuesta HTTP de la IA: el estado y el uso de tokens. Nunca la clave ni el pedido. */
export function llamadaDeRespuesta(status, cuerpo) {
  const u = cuerpo?.usage;
  const n = (v) => (Number.isFinite(v) ? v : null);
  return {
    status: Number.isFinite(status) ? status : null,
    uso: u && typeof u === 'object' ? { entrada: n(u.prompt_tokens), salida: n(u.completion_tokens), total: n(u.total_tokens) } : null,
  };
}

/** Tokens del turno: suma de las llamadas a la IA. `null` si no hubo llamadas. */
export function tokensDeLlamadas(llamadas) {
  const l = lista(llamadas);
  if (l.length === 0) return null;
  const suma = (campo) => {
    const valores = l.map((x) => x?.uso?.[campo]).filter(Number.isFinite);
    return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) : null;
  };
  return { llamadas: l.length, estados: l.map((x) => x?.status ?? null), entrada: suma('entrada'), salida: suma('salida'), total: suma('total') };
}

/**
 * Datos del panel para un turno. Todo sale como texto plano: la página lo escribe con `textContent`.
 * @param {{ texto?: string, tipo?: string, registro?: object|null, errores?: string[] } | null} salida de `narrar`
 * @param {{ llamadas?: object[], pendientes?: number }} [extra]
 */
export function armarPanel(salida, { llamadas = [], pendientes = 0 } = {}) {
  const s = salida && typeof salida === 'object' ? salida : {};
  return {
    texto: typeof s.texto === 'string' ? s.texto : '',
    tipo: typeof s.tipo === 'string' ? s.tipo : '',
    errores: lista(s.errores).map(String),
    tokens: tokensDeLlamadas(llamadas),
    registroJson: s.registro ? JSON.stringify(s.registro, null, 2) : '',
    pendientes: Number.isInteger(pendientes) ? pendientes : 0,
  };
}

/**
 * Atajo de prueba, no es parte del juego: fija la relación de un NPC en el estado actual.
 * Devuelve un estado nuevo (no modifica el recibido). Valor no numérico o NPC desconocido: devuelve el mismo estado.
 * La relación se redondea y se recorta a [-100, 100].
 */
export function fijarRelacion(estado, npcId, valor) {
  const numero = typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '') ? Number(valor) : NaN;
  if (!estado?.npcs?.[npcId] || !Number.isFinite(numero)) return estado;
  const relacion = Math.min(100, Math.max(-100, Math.round(numero)));
  return { ...estado, npcs: { ...estado.npcs, [npcId]: { ...estado.npcs[npcId], relacion } } };
}
