// Motivos de reformulación que devuelve decidir() (comprension.js).
// Cada uno tiene su texto en plantillas.reformulacion del contenido; el validador lo exige.
export const MOTIVOS = Object.freeze({
  NO_ENTENDIDO: 'no_entendido',
  INTENCION_AMBIGUA: 'intencion_ambigua',
  SIN_NPCS: 'sin_npcs',
  FALTA_NPC: 'falta_npc',
  NPC_AMBIGUO: 'npc_ambiguo',
  NPC_AUSENTE: 'npc_ausente',
  SIN_OBJETOS: 'sin_objetos',
  FALTA_OBJETO: 'falta_objeto',
  OBJETO_AMBIGUO: 'objeto_ambiguo',
  FALTA_DESTINO: 'falta_destino',
  DESTINO_AMBIGUO: 'destino_ambiguo',
});

// Pedido de repetir la segunda intención de una frase (repetirIntencionId de decidir).
export const REPETIR_SEGUNDA = 'repetir_segunda';

// Bloque de plantillas.
export const BLOQUE_REFORMULACION = 'reformulacion';

// Viajar a la escena o a la ciudad donde el jugador ya está (viaje.js).
export const YA_EN_DESTINO = 'ya_en_destino';

/** Claves que tienen que existir en plantillas.reformulacion. */
export const CLAVES_REFORMULACION = Object.freeze([...Object.values(MOTIVOS), REPETIR_SEGUNDA, YA_EN_DESTINO]);
