// Reloj del mundo: { dia, hora } con hora "HH:MM". Es el único reloj que avanza.
// Todas las funciones son puras: devuelven relojes nuevos.

const MINUTOS_DIA = 24 * 60;

/** "HH:MM" -> minutos desde las 00:00. Lanza si el formato no es válido. */
export function minutosDeHora(hora) {
  const m = typeof hora === 'string' ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora) : null;
  if (!m) throw new TypeError(`hora inválida: ${JSON.stringify(hora)}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** ¿Es una hora "HH:MM" válida? */
export function esHora(hora) {
  return typeof hora === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(hora);
}

/** Minutos desde las 00:00 del día 1. */
export function minutosAbsolutos(reloj) {
  if (!Number.isInteger(reloj?.dia) || reloj.dia < 1) throw new TypeError(`día inválido: ${JSON.stringify(reloj?.dia)}`);
  return (reloj.dia - 1) * MINUTOS_DIA + minutosDeHora(reloj.hora);
}

function desdeMinutos(total) {
  const delDia = total % MINUTOS_DIA;
  const dos = (n) => String(n).padStart(2, '0');
  return { dia: Math.floor(total / MINUTOS_DIA) + 1, hora: `${dos(Math.floor(delDia / 60))}:${dos(delDia % 60)}` };
}

/** Reloj inicial: día 1 a la hora que trae reglas.relojInicial (08:00). */
export function relojInicial(contenido) {
  const m = /\b([01]\d|2[0-3]):[0-5]\d\b/.exec(String(contenido?.reglas?.relojInicial ?? ''));
  if (!m) throw new Error('reglas.relojInicial no trae una hora HH:MM');
  return { dia: 1, hora: m[0] };
}

/** Suma horas y pasa de día cuando corresponde. No modifica el reloj recibido. */
export function avanzar(reloj, horas) {
  if (typeof horas !== 'number' || !Number.isFinite(horas) || horas < 0) {
    throw new RangeError(`horas inválidas: ${JSON.stringify(horas)}`);
  }
  return desdeMinutos(minutosAbsolutos(reloj) + Math.round(horas * 60));
}

/** Negativo si a es anterior a b, 0 si son iguales, positivo si es posterior. */
export function comparar(a, b) {
  return minutosAbsolutos(a) - minutosAbsolutos(b);
}

/** Próxima vez que el reloj marca `hora`, estrictamente después de `reloj`. Cruza la medianoche si hace falta. */
export function proximaOcurrencia(reloj, hora) {
  const ahora = minutosAbsolutos(reloj);
  let total = (reloj.dia - 1) * MINUTOS_DIA + minutosDeHora(hora);
  if (total <= ahora) total += MINUTOS_DIA;
  return desdeMinutos(total);
}

/**
 * Última vez que el reloj marcó `hora` entre `desde` (sin incluir) y `hasta` (incluido).
 * Con `incluirDesde`, el instante `desde` también cuenta. Devuelve null si no la marcó.
 */
export function ultimaOcurrencia(desde, hasta, hora, { incluirDesde = false } = {}) {
  const inicio = minutosAbsolutos(desde);
  const fin = minutosAbsolutos(hasta);
  let total = (hasta.dia - 1) * MINUTOS_DIA + minutosDeHora(hora);
  if (total > fin) total -= MINUTOS_DIA;
  const dentro = incluirDesde ? total >= inicio : total > inicio;
  return total >= 0 && dentro ? desdeMinutos(total) : null;
}

/** ¿El reloj marcó `hora` entre `desde` (sin incluir) y `hasta` (incluido)? */
export function ocurreEntre(desde, hasta, hora, opciones) {
  return ultimaOcurrencia(desde, hasta, hora, opciones) !== null;
}

/** ¿El reloj ya llegó a `momento`? */
export function yaPaso(reloj, momento) {
  return comparar(reloj, momento) >= 0;
}
