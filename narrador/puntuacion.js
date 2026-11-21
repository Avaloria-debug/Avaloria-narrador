// Puntuación al completar textos: sin punto doble cuando el valor ya cierra con puntuación final.

/** Puntuación final de un valor: punto, puntos suspensivos, ? o !, con comillas o paréntesis de cierre después. */
export const CIERRA_CON_PUNTUACION = /[.!?…]["»”’')\]]*$/;

/** El valor seguido del punto del texto, salvo que el valor ya cierre con puntuación final. */
export function sinPuntoDoble(valor, punto) {
  return punto && CIERRA_CON_PUNTUACION.test(String(valor)) ? String(valor) : `${valor}${punto}`;
}
