// Fase 5 (R5): lógica pura del botón de IA local de la página de prueba (testeable en Node).
import { detectar, nivelDeIa, parametro } from '../iaLocal/capacidad.js';

// A APROBAR (prov): textos del botón y del aviso.
export const TEXTOS_IA_LOCAL = Object.freeze({
  prov: true,
  activar: 'Activar IA local',
  cargando: 'Cargando IA local…',
  lista: 'IA local activa',
  error: 'IA local no disponible',
  aviso: 'Descarga un modelo de unos {mb} MB una sola vez y lo guarda en este navegador. Funciona sin clave.',
  noSoportado: 'Este navegador no puede correr la IA local.',
});
export const CLAVE_FLAG = 'ialocal_activa';

/** ¿Pidió el jugador la IA local? `?ialocal=0` gana; si no, lo guardado. Apagada por defecto. */
export function leerFlag(location, storage) {
  const p = parametro({ location });
  if (p === '0') return false;
  try { return storage?.getItem?.(CLAVE_FLAG) === '1'; } catch { return false; }
}

/** Info de capacidad + nivel para la página. */
export function infoDePagina(env) {
  const info = detectar(env);
  return { ...info, nivel: nivelDeIa(info) };
}

/** Estado del botón: { visible, habilitado, texto }. estado: 'apagada'|'cargando'|'lista'|'fallida'. */
export function estadoDeBoton(info, estado = 'apagada') {
  const visible = Boolean(info) && info.nivel !== 'ninguna';
  const t = { apagada: TEXTOS_IA_LOCAL.activar, cargando: TEXTOS_IA_LOCAL.cargando, lista: TEXTOS_IA_LOCAL.lista, fallida: TEXTOS_IA_LOCAL.error }[estado] ?? TEXTOS_IA_LOCAL.activar;
  return { visible, habilitado: visible && (estado === 'apagada' || estado === 'fallida'), texto: visible ? t : TEXTOS_IA_LOCAL.noSoportado };
}

/** Aviso de descarga con el tamaño del manifest (modelo del nivel). */
export function textoDeAviso(info, manifest) {
  if (!info || info.nivel === 'ninguna') return TEXTOS_IA_LOCAL.noSoportado;
  const m = info.nivel === 'local-movil' ? manifest?.movil : manifest?.principal;
  const mb = Number.isFinite(m?.tamanoMB) ? Math.round(m.tamanoMB) : null;
  return mb ? TEXTOS_IA_LOCAL.aviso.replace('{mb}', String(mb)) : TEXTOS_IA_LOCAL.aviso.replace(' de unos {mb} MB', '');
}

/** Texto de progreso de carga (WebLLM informa { progress, text }; sin verificar). */
export function textoDeProgreso(p) {
  const n = Number(p?.progress);
  return Number.isFinite(n) ? `${Math.round(Math.min(1, Math.max(0, n)) * 100)} %` : '';
}
