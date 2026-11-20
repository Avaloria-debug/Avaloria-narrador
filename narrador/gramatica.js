// Gramática de símbolos #a.b# (P3). Sin texto propio: los fragmentos salen de `simbolos` del contenido ampliado.
// Resolución, de más a menos específico: a.b.<franja>.<clima> → a.b.<franja> → a.b.<clima> → a.b.<tensión> → a.b.
// Si nada de eso existe pero hay a.b.<sufijo> con sufijos de franja/clima/tensión, se usan todos (respaldo).
// Símbolo inexistente o tope de profundidad: se borra y se anota un aviso. Nunca lanza.
const SUFIJOS = new Set(['madrugada', 'manana', 'tarde', 'noche', 'despejado', 'nublado', 'lluvia', 'niebla', 'alta', 'baja']);
const PATRON = /#([\w.]+)#/g;

/** Variantes de un símbolo según los hechos (franja f, clima cl, tensión ts). null si no existe. */
export function variantesDe(clave, simbolos, hechos = {}) {
  const { f, cl, ts } = hechos;
  const orden = [f && cl && `${clave}.${f}.${cl}`, f && `${clave}.${f}`, cl && `${clave}.${cl}`, ts && `${clave}.${ts}`, clave].filter(Boolean);
  for (const k of orden) if (Array.isArray(simbolos?.[k]) && simbolos[k].length) return simbolos[k];
  const sub = Object.keys(simbolos ?? {}).filter((x) => x.startsWith(clave + '.') && x.slice(clave.length + 1).split('.').every((p) => SUFIJOS.has(p)));
  const todas = sub.flatMap((k) => simbolos[k]);
  return todas.length ? todas : null;
}

/**
 * Expande los símbolos de un texto.
 * @param {string} texto
 * @param {object} simbolos
 * @param {{ rng: () => number, hechos?: object, profundidadMax?: number, avisos?: object[] }} opciones
 */
export function expandir(texto, simbolos, { rng, hechos = {}, profundidadMax = 6, avisos = [] } = {}) {
  if (typeof texto !== 'string') return texto;
  if (typeof rng !== 'function') throw new TypeError('expandir necesita un rng');
  const paso = (t, prof) => t.replace(PATRON, (_, clave) => {
    if (prof >= profundidadMax) { avisos.push({ tipo: 'gramatica_tope', simbolo: clave }); return ''; }
    const vs = variantesDe(clave, simbolos, hechos);
    if (!vs) { avisos.push({ tipo: 'gramatica_simbolo', simbolo: clave }); return ''; }
    const elegido = vs[Math.min(vs.length - 1, Math.floor(rng() * vs.length))];
    return paso(String(typeof elegido === 'string' ? elegido : elegido?.t ?? ''), prof + 1);
  });
  return paso(texto, 0).replace(/ {2,}/g, ' ').replace(/ ([.,;:])/g, '$1').trim();
}

/**
 * Modificadores de género: {npc.el} {objeto.el} {objeto.un} {x.de}. Sin dato de género: masculino singular.
 * `genero` = t00-guia.genero ({ npcs: {id: 'f'|'m'}, objetos: {id: [el, un]} }).
 */
export function aplicarGenero(texto, { npcId, objetoId, genero } = {}) {
  if (typeof texto !== 'string') return texto;
  const art = (tipo) => {
    if (tipo === 'npc') return genero?.npcs?.[npcId] === 'f' ? ['la', 'una'] : ['el', 'un'];
    return genero?.objetos?.[objetoId] ?? ['el', 'un'];
  };
  return texto.replace(/\{(npc|objeto)\.(el|un|de)\}/g, (_, tipo, mod) => {
    const [el, un] = art(tipo);
    if (mod === 'el') return el;
    if (mod === 'un') return un;
    return el === 'el' ? 'del' : `de ${el}`;
  });
}
