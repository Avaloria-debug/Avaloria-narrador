// Diario automático (P17). Entradas { dia, tipo, npc, escena } en ext.diario; texto de t23. Sin texto propio.
// Máx. 50 entradas: las de días viejos se funden en una entrada { dia, tipo: 'fusion' } por día.
export const MAX_DIARIO = 50;

export const diarioGuardado = (ext) => (Array.isArray(ext?.diario) ? ext.diario.filter((x) => x && Number.isInteger(x.dia) && typeof x.tipo === 'string') : []);

/** Agrega una entrada y aplica el tope fundiendo los días más viejos. */
export function anotar(diario, entrada, max = MAX_DIARIO) {
  let l = [...diario, entrada];
  while (l.length > max) {
    const dias = [...new Set(l.map((x) => x.dia))].sort((a, b) => a - b);
    const viejo = dias.find((d) => l.filter((x) => x.dia === d).length > 1 || l.find((x) => x.dia === d).tipo !== 'fusion');
    if (viejo === undefined || viejo === dias.at(-1)) { l = l.slice(l.length - max); break; }
    const i = l.findIndex((x) => x.dia === viejo);
    l = [...l.slice(0, i), { dia: viejo, tipo: 'fusion', npc: null, escena: null }, ...l.filter((x, j) => j > i && x.dia !== viejo)].sort((a, b) => a.dia - b.dia);
  }
  return l;
}

/**
 * Texto del diario: una línea por entrada (por día, en orden), y el cierre al final de cada día.
 * @param {object[]} diario
 * @param {{ amp: object, contenido: object, rng: () => number }} datos
 */
export function textoDiario(diario, { amp, contenido, rng }) {
  const t23 = amp?.diario ?? {};
  const pick = (l) => (l?.length ? l[Math.min(l.length - 1, Math.floor(rng() * l.length))] : null);
  const nombre = (lista, id) => lista.find((x) => x.id === id)?.nombre ?? '';
  const completar = (t, e) => (t ?? '').replace(/\{npc\}/g, nombre(contenido.npcs, e.npc)).replace(/\{lugar\}/g, nombre(contenido.escenas, e.escena));
  if (!diario.length) return pick(t23.otras?.vacio) ?? '';
  const lineas = [];
  const dias = [...new Set(diario.map((x) => x.dia))].sort((a, b) => a - b);
  for (const d of dias) {
    for (const e of diario.filter((x) => x.dia === d)) {
      const t = pick(t23.entradas?.[e.tipo]) ?? pick(t23.otras?.[e.tipo]) ?? pick(t23.categorias?.[e.tipo]);
      const c = t && completar(t, e);
      if (c && !/\{|\}/.test(c) && !/\s{2}|\s[.,]/.test(c)) lineas.push(c);
    }
    const cierre = pick(t23.otras?.cierre);
    if (cierre) lineas.push(cierre);
  }
  return lineas.join(' ');
}
