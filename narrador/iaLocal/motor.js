// Fase 5 (R3): IA local con la misma forma de respuesta que pedirRespuestaIA (ia.js).
// SIN VERIFICAR: API de WebLLM (CreateMLCEngine, chat.completions.create, unload, enable_thinking) y WebGPU.
import { validarSalida, fuegoSinEvento, estimarTokens, ErrorDeContexto, SIN_IA, MOTIVOS_IA, MOTIVOS_SALIDA } from '../ia.js';
import { armarMensajesLocal } from './contexto.js';
import { marcarCarga, limpiarCarga, UMBRALES_TOK_S } from './capacidad.js';

export const MAX_TOKENS_SALIDA_LOCAL = 100;
export const TEMPERATURA_LOCAL = 0.6;
export const ESPERA_MS = Object.freeze({ 'local-pc': 8000, 'local-movil': 20000 });
export const MOTIVOS_LOCAL = Object.freeze({ NO_LISTO: 'local_no_listo', TIEMPO: 'local_tiempo', ERROR: 'local_error', CARGA: 'local_carga' });

/** Quita bloques <think>…</think> (y un <think> sin cerrar) de modelos con modo pensamiento. */
export function limpiarPensamiento(t) {
  return String(t ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '').trim();
}

/** Candidatos en orden según el nivel: móvil primero en local-movil, principal en local-pc; luego respaldo. */
export function candidatos(manifest, nivel) {
  const m = manifest ?? {};
  const base = nivel === 'local-movil' ? [m.movil, m.principal] : [m.principal, m.movil];
  const vistos = new Set();
  return [...base, ...(m.respaldo ?? [])].filter((c) => c?.modeloId && !vistos.has(c.modeloId) && vistos.add(c.modeloId));
}

/** Fábrica por defecto: import() dinámico de WebLLM. Única importación https. SIN VERIFICAR. */
async function fabricaWebLLM(modelo, { origen, alProgreso } = {}) {
  const webllm = await import(/* @vite-ignore */ origen);
  const motor = await webllm.CreateMLCEngine(modelo.modeloId, { initProgressCallback: alProgreso });
  return {
    async generar(mensajes, { maxTokens, temperatura, piensa }) {
      const r = await motor.chat.completions.create({
        messages: mensajes, max_tokens: maxTokens, temperature: temperatura,
        ...(piensa ? { extra_body: { enable_thinking: false } } : {}),
      });
      return { texto: r?.choices?.[0]?.message?.content ?? '', salida: r?.usage?.completion_tokens ?? null };
    },
    async descargar() { await motor.unload?.(); },
  };
}

const esperarReal = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {{ manifest:object, nivel?:string, motorFactory?:Function, env?:object, esperar?:Function, ahora?:Function, alProgreso?:Function }} o
 */
export function crearIaLocal({ manifest, nivel = 'local-pc', motorFactory = fabricaWebLLM, env = {}, esperar = esperarReal, ahora = () => Date.now(), alProgreso = null } = {}) {
  let motor = null;
  let modelo = null;
  let estado = 'apagada';
  const espera = ESPERA_MS[nivel] ?? ESPERA_MS['local-pc'];
  const umbral = nivel === 'local-movil' ? UMBRALES_TOK_S.movil : UMBRALES_TOK_S.pc;
  const conTiempo = (p) => Promise.race([p, esperar(espera).then(() => { throw Object.assign(new Error('tiempo'), { tiempo: true }); })]);

  async function cargar() {
    if (motor) return true;
    estado = 'cargando';
    marcarCarga(env);
    for (const c of candidatos(manifest, nivel)) {
      try {
        const m = await motorFactory(c, { origen: manifest?.motor?.origen, alProgreso });
        // Medición de velocidad con una generación corta.
        const t0 = ahora();
        const r = await conTiempo(m.generar([{ role: 'user', content: 'Hola.' }], { maxTokens: 16, temperatura: TEMPERATURA_LOCAL, piensa: c.piensa }));
        const seg = Math.max((ahora() - t0) / 1000, 1e-3);
        const tok = Number.isFinite(r?.salida) ? r.salida : estimarTokens(r?.texto);
        if (tok / seg < umbral) { await m.descargar?.(); continue; }
        motor = m; modelo = c; estado = 'lista';
        limpiarCarga(env);
        return true;
      } catch { /* siguiente candidato */ }
    }
    limpiarCarga(env);
    estado = 'fallida';
    return false;
  }

  async function pedir({ contexto } = {}) {
    const vacio = { entrada: 0, salida: 0, total: 0, fuente: 'estimacion' };
    if (!motor) return { ok: false, error: SIN_IA, motivo: MOTIVOS_LOCAL.NO_LISTO, texto: null, tokens: vacio, reintentos: 0 };
    let m;
    try { m = armarMensajesLocal(contexto); } catch (e) {
      if (!(e instanceof ErrorDeContexto)) throw e;
      return { ok: false, error: null, motivo: MOTIVOS_IA.CONTEXTO_LARGO, texto: null, tokens: { ...vacio, entrada: e.tokens, total: e.tokens }, reintentos: 0 };
    }
    const tokens = (s) => ({ entrada: m.tokens, salida: s, total: m.tokens + s, fuente: 'estimacion' });
    let crudo;
    try {
      crudo = await conTiempo(motor.generar(m.mensajes, { maxTokens: MAX_TOKENS_SALIDA_LOCAL, temperatura: TEMPERATURA_LOCAL, piensa: modelo.piensa }));
    } catch (e) {
      return { ok: false, error: null, motivo: e?.tiempo ? MOTIVOS_LOCAL.TIEMPO : MOTIVOS_LOCAL.ERROR, texto: null, tokens: tokens(0), reintentos: 0 };
    }
    const texto = limpiarPensamiento(typeof crudo?.texto === 'string' ? crudo.texto : '');
    const v = validarSalida(texto);
    const t = tokens(estimarTokens(texto));
    if (!v.ok) return { ok: false, error: null, motivo: MOTIVOS_IA.SALIDA_INVALIDA, detalle: v.motivo, texto: null, tokens: t, reintentos: 0 };
    if (fuegoSinEvento(v.texto, contexto?.eventosIds)) return { ok: false, error: null, motivo: MOTIVOS_IA.SALIDA_INVALIDA, detalle: MOTIVOS_SALIDA.FUEGO_SIN_EVENTO, texto: null, tokens: t, reintentos: 0 };
    return { ok: true, error: null, motivo: null, texto: v.texto, tokens: t, reintentos: 0, modelo: modelo.modeloId };
  }

  async function descargar() {
    const m = motor; motor = null; modelo = null; estado = 'apagada';
    try { await m?.descargar?.(); } catch { /* nada */ }
  }

  try { env.window?.addEventListener?.('pagehide', () => { descargar(); }); } catch { /* sin ventana */ }
  return { cargar, listo: () => Boolean(motor), pedir, descargar, estado: () => estado, modelo: () => modelo?.modeloId ?? null };
}
