// X2 (fase 8): interfaz de sistemas (regateo, trabajos; luego combate y minijuegos).
// Un módulo: { id, iniciar(estado, ctx) → sub, turno(sub, entrada, rng, ctx) → { texto, sub, terminado }, resultado(sub) → efectos[],
//   cerrable?(sub) → boolean }. El estado guarda a lo sumo un sistema activo en `ext.sistema = { id, sub }`;
// `sub` es JSON plano, así el juego principal puede dibujar su propia UI leyéndolo.
// Efectos: los de resolver (dinero, objeto_agregado, objeto_usado, marca, movimiento) más `relacion` { npc, delta }
// `hecho` { clave, valor }, `pago`/`cobro` { monto en bronce }, `reloj` { horas } (nuevos; anotados en SUPUESTOS-v3).
import { aplicarEfectos as aplicarDeResolver } from '../resolver.js';
import { totalBronce, conTotal } from '../economia/monedas.js';
import { avanzar } from '../reloj.js';

const MODULOS = new Map();
export const PALABRAS_SALIR = Object.freeze(['salir', 'salgo', 'irme', 'me voy', 'dejar', 'dejo', 'dejarlo', 'basta', 'chau', 'adios']);

export function registrarSistema(mod) {
  if (!mod || typeof mod.id !== 'string' || typeof mod.iniciar !== 'function' || typeof mod.turno !== 'function' || typeof mod.resultado !== 'function') {
    throw new TypeError('registrarSistema: módulo inválido');
  }
  MODULOS.set(mod.id, mod);
  return mod;
}
export const obtenerSistema = (id) => MODULOS.get(id) ?? null;
export const sistemaActivo = (estado) => (estado?.ext?.sistema && MODULOS.has(estado.ext.sistema.id) ? estado.ext.sistema : null);

const conSistema = (estado, sistema) => ({ ...estado, ext: { ...(estado.ext ?? {}), sistema } });

/** Abre un sistema (cierra a la fuerza el que hubiera). */
export function abrirSistema(estado, id, ctx = {}) {
  const mod = obtenerSistema(id);
  if (!mod) throw new Error(`abrirSistema: sistema desconocido ${id}`);
  const base = sistemaActivo(estado) ? cerrarSistema(estado, { forzado: true }).estado : estado;
  return conSistema(base, { id, sub: mod.iniciar(base, ctx) });
}

const normal = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ').trim();
export const esSalir = (texto) => { const t = ` ${normal(texto)} `; return PALABRAS_SALIR.some((p) => t.includes(` ${p} `)); };

/** Aplica efectos al estado. */
export function aplicarEfectosSistema(estado, efectos = []) {
  let e = aplicarDeResolver(estado, efectos.filter((x) => !['relacion', 'hecho', 'pago', 'cobro', 'reloj'].includes(x.tipo)));
  for (const x of efectos) {
    if (x.tipo === 'relacion' && e.npcs?.[x.npc]) {
      const r = Math.max(-2, Math.min(2, (e.npcs[x.npc].relacion ?? 0) + x.delta));
      e = { ...e, npcs: { ...e.npcs, [x.npc]: { ...e.npcs[x.npc], relacion: r } } };
    } else if (x.tipo === 'pago' || x.tipo === 'cobro') {
      // `pago`: el jugador paga (en bronce); `cobro`: recibe. Nunca negativo.
      const t = totalBronce(e.jugador) + (x.tipo === 'pago' ? -1 : 1) * Math.max(0, Math.round(x.monto) || 0);
      e = { ...e, jugador: conTotal(e.jugador, t) };
    } else if (x.tipo === 'reloj' && e.reloj && Number.isFinite(x.horas) && x.horas > 0) {
      e = { ...e, reloj: avanzar(e.reloj, x.horas) };
    } else if (x.tipo === 'hecho') {
      e = { ...e, ext: { ...(e.ext ?? {}), hechosSistema: { ...(e.ext?.hechosSistema ?? {}), [x.clave]: x.valor } } };
    }
  }
  return e;
}

/** Cierra el sistema activo: aplica `resultado(sub)` y lo quita del estado. */
export function cerrarSistema(estado, { forzado = false } = {}) {
  const s = sistemaActivo(estado);
  if (!s) return { estado, efectos: [] };
  const mod = obtenerSistema(s.id);
  const sub = forzado ? { ...s.sub, forzado: true } : s.sub;
  const efectos = mod.resultado(sub) ?? [];
  const sin = { ...estado, ext: { ...(estado.ext ?? {}) } };
  delete sin.ext.sistema;
  return { estado: aplicarEfectosSistema(sin, efectos), efectos };
}

/**
 * Turno dentro del sistema activo. «salir/irme/dejar» lo cierra si el módulo lo permite.
 * @returns {null | { texto, estado, terminado, efectos }}
 */
export function turnoSistema(estado, entrada, rng, ctx = {}) {
  const s = sistemaActivo(estado);
  if (!s) return null;
  const mod = obtenerSistema(s.id);
  const r = mod.turno(s.sub, entrada, rng, { ...ctx, estado, salir: esSalir(entrada?.texto) && (typeof mod.cerrable !== 'function' || mod.cerrable(s.sub)) });
  const tras = conSistema(estado, { id: s.id, sub: r.sub });
  if (!r.terminado) return { id: s.id, texto: r.texto, sub: r.sub, estado: tras, terminado: false, efectos: [] };
  const c = cerrarSistema(tras);
  return { id: s.id, texto: r.texto, sub: r.sub, estado: c.estado, terminado: true, efectos: c.efectos };
}

export const _reiniciarParaTests = () => MODULOS.clear();
