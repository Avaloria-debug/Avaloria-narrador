// Fase 5 (R1): ¿puede este navegador correr la IA local? Entorno inyectable (navigator, sessionStorage, localStorage, location).
// Sin verificar en navegador real: navigator.gpu (WebGPU) y navigator.deviceMemory.

export const CLAVE_CARGANDO = 'ialocal_cargando';
export const CLAVE_BLOQUEADA = 'ialocal_bloqueada';
// A APROBAR (prov): umbrales de velocidad en tokens por segundo.
export const UMBRALES_TOK_S = Object.freeze({ pc: 20, movil: 6, prov: true });

const leer = (s, k) => { try { return s?.getItem?.(k) ?? null; } catch { return null; } };
const escribir = (s, k, v) => { try { s?.setItem?.(k, v); } catch { /* almacenamiento bloqueado */ } };
const borrar = (s, k) => { try { s?.removeItem?.(k); } catch { /* almacenamiento bloqueado */ } };

const RE_APP = /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|; wv\)|WhatsApp|Snapchat|GSA\//i;
const RE_IOS = /iPhone|iPad|iPod/i;
const RE_MOVIL = /Android|Mobi|iPhone|iPad|iPod/i;

/** Parámetro `ialocal` de la URL ('0', 'forzar' o null). */
export function parametro(env = {}) {
  try { return new URLSearchParams(env.location?.search ?? '').get('ialocal'); } catch { return null; }
}

/**
 * Detecta capacidades. Si quedó la marca de carga de una sesión anterior (crash al cargar), bloquea la IA local.
 * @returns {{webgpu:boolean, memoriaGB:number|null, enApp:boolean, movil:boolean, ios:boolean, bloqueada:boolean, param:string|null}}
 */
export function detectar(env = {}) {
  const nav = env.navigator ?? {};
  const ua = String(nav.userAgent ?? '');
  if (leer(env.sessionStorage, CLAVE_CARGANDO)) {
    escribir(env.localStorage, CLAVE_BLOQUEADA, '1');
    borrar(env.sessionStorage, CLAVE_CARGANDO);
  }
  const iPadDesktop = /Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
  return {
    webgpu: Boolean(nav.gpu),
    memoriaGB: Number.isFinite(nav.deviceMemory) ? nav.deviceMemory : null,
    enApp: RE_APP.test(ua),
    movil: RE_MOVIL.test(ua) || iPadDesktop || Boolean(nav.userAgentData?.mobile),
    ios: RE_IOS.test(ua) || iPadDesktop,
    bloqueada: leer(env.localStorage, CLAVE_BLOQUEADA) === '1',
    param: parametro(env),
  };
}

/** 'local-pc' | 'local-movil' | 'ninguna'. */
export function nivelDeIa(info, { bloqueada = info?.bloqueada ?? false, forzar = info?.param === 'forzar', apagada = info?.param === '0' } = {}) {
  if (!info || apagada) return 'ninguna';
  if (!forzar && (!info.webgpu || info.ios || info.enApp || bloqueada)) return 'ninguna';
  if (forzar && !info.webgpu) return 'ninguna';
  return info.movil ? 'local-movil' : 'local-pc';
}

export function marcarCarga(env = {}) { escribir(env.sessionStorage, CLAVE_CARGANDO, '1'); }
export function limpiarCarga(env = {}) { borrar(env.sessionStorage, CLAVE_CARGANDO); }
