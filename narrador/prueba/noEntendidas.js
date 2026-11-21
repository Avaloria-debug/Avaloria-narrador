// Fase 6 (V8): frases que el juego no entendió (o pidió aclarar), guardadas solo en este navegador.
// No sale de la página ni va a Firestore. Formato de exportación = el del corpus (data/pruebas/corpus-comprension.json).
export const CLAVE_NO_ENTENDIDAS = 'avaloria_no_entendidas';
export const MAX_NO_ENTENDIDAS = 200;

/** ¿El turno terminó sin entender o pidiendo aclaración? */
export function esNoEntendida(salida) {
  if (!salida || typeof salida !== 'object') return false;
  if (salida.tipo === 'reformulacion') return true;
  if ((salida.errores ?? []).some((e) => String(e).startsWith('ia') || String(e).includes('sin_ia'))) return true;
  return Boolean(salida.estado?.ext?.aclaracion);
}

/** Contexto mínimo: escena y foco más reciente. */
export function contextoMinimo(estado) {
  const focos = Array.isArray(estado?.ext?.focos) ? [...estado.ext.focos].sort((a, b) => (b.visto ?? 0) - (a.visto ?? 0)) : [];
  return { escena: estado?.jugador?.escenaId ?? null, ctx: focos[0]?.id ?? null };
}

export function leerNoEntendidas(storage) {
  try { const l = JSON.parse(storage?.getItem?.(CLAVE_NO_ENTENDIDAS) ?? '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}

/** Guarda la frase (sin repetir, máx. 200, las más nuevas). Devuelve la lista. */
export function guardarNoEntendida(storage, frase, estadoAntes) {
  const f = typeof frase === 'string' ? frase.trim().slice(0, 240) : '';
  if (!f) return leerNoEntendidas(storage);
  const l = leerNoEntendidas(storage).filter((x) => x.frase !== f);
  const { escena, ctx } = contextoMinimo(estadoAntes);
  l.push({ frase: f, escena, ...(ctx ? { ctx } : {}) });
  const out = l.slice(-MAX_NO_ENTENDIDAS);
  try { storage?.setItem?.(CLAVE_NO_ENTENDIDAS, JSON.stringify(out)); } catch { /* almacenamiento lleno o bloqueado */ }
  return out;
}

/** JSON con el formato del corpus; `accion` queda para completar a mano. */
export function exportarNoEntendidas(storage) {
  const casos = leerNoEntendidas(storage).map((x) => ({ frase: x.frase, accion: '?', cat: 'jugadas', ...(x.ctx ? { ctx: x.ctx } : {}), escena: x.escena }));
  return JSON.stringify({ nota: 'Frases no entendidas exportadas desde la página de prueba. Completar `accion` (y objetivo/npc/lugar) antes de sumarlas al corpus.', casos }, null, 1);
}
