// Barrido de comprensión por relación: tabla de casos y ejecución. Lo usa pruebasComprension.test.js.
// No arregla nada: solo mide qué obtiene el narrador frente a lo que se esperaba.
import { crearPartida, narrar, contenido } from './index.js';

const NPCS = {
  maren_archivista: { escena: 'escena_archivo_real' },
  serel_panadero: { escena: 'escena_mercado_circular' },
};
export const RELACIONES = [0, 39, 40, 50];

// Por NPC: frases de tema (una sola palabra o frase), frases ajenas al NPC y pares con y sin tildes.
const FRASES_TEMA = ['tratado', 'copia', 'hablame sobre el tratado de la guerra', 'llave', 'cerradura', 'harina', 'hornos', 'precio'];
const PAREJAS_TILDES = {
  maren_archivista: [
    ['¿qué sabés del tratado de la guerra?', '¿que sabes del tratado de la guerra?'],
    ['háblame de la copia del tratado', 'hablame de la copia del tratado'],
  ],
  serel_panadero: [
    ['¿qué sabés de la harina?', '¿que sabes de la harina?'],
    ['¿por qué el precio de la harina?', '¿por que el precio de la harina?'],
  ],
};
// Secuencias: la primera pregunta revela _1 y la segunda tendría que revelar _2.
const SECUENCIAS = {
  maren_archivista: ['¿qué sabés del tratado?', '¿y qué sabés de las llaves?'],
  serel_panadero: ['¿qué sabés de la harina?', '¿y qué sabés de los hornos?'],
};

// El diseño no dice qué hace una palabra suelta sin verbo, y SUPUESTOS.md pide reformular "háblame de..." sin NPC nombrado.
const dudosa = (f) => !/\s/.test(f.trim()) && f.trim() !== 'ok' || /^h[aá]blame\b/i.test(f.trim());

const claveDe = (npc, relacion, frases) => `${npc} | relación ${relacion} | ${frases.join(' > ')}`;

/** Lo que se espera de una frase de un solo paso, según el NPC y su relación: el conocimiento que nombra y su umbral. */
function esperadoSimple(npcId, relacion, frase) {
  const def = contenido.npcs.find((n) => n.id === npcId);
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const palabras = new Set(norm(frase).split(/[^a-zñ]+/).filter(Boolean));
  const i = def.conocimientos.findIndex((k) => k.palabrasClave.some((p) => palabras.has(norm(p))));
  if (i < 0) return 'reformulacion';
  return relacion >= def.conocimientos[i].umbralRelacion ? `rev${i + 1}` : 'fallo';
}

export function armarCasos() {
  const casos = [];
  const nuevo = (npc, relacion, frases, esperado) =>
    casos.push({ id: claveDe(npc, relacion, frases), npc, relacion, frases, esperado, revisarConDiseno: frases.some(dudosa) });
  for (const npc of Object.keys(NPCS)) {
    for (const relacion of RELACIONES) {
      for (const f of FRASES_TEMA) nuevo(npc, relacion, [f], [esperadoSimple(npc, relacion, f)]);
      for (const par of PAREJAS_TILDES[npc]) for (const f of par) nuevo(npc, relacion, [f], [esperadoSimple(npc, relacion, f)]);
      nuevo(npc, relacion, ['ok'], ['asiente']);
    }
    nuevo(npc, 50, SECUENCIAS[npc], ['rev1', 'rev2']);
  }
  return casos;
}

function clasificar(salida, npcId) {
  const def = contenido.npcs.find((n) => n.id === npcId);
  const texto = salida.texto ?? '';
  const k = (i) => def.conocimientos[i]?.contenido;
  if (k(1) && texto.includes(k(1))) return 'rev2';
  if (k(0) && texto.includes(k(0))) return 'rev1';
  if (texto.includes('no te cuenta nada nuevo')) return 'fallo';
  if (/asiente/.test(texto)) return 'asiente';
  if (salida.tipo === 'reformulacion') return 'reformulacion';
  return 'otro';
}

/** Ejecuta un caso. Devuelve { obtenido: [etiquetas], textos: [textos] }. */
export async function correrCaso(caso) {
  const base = crearPartida({ semilla: 11 });
  let estado = {
    ...base,
    jugador: { ...base.jugador, escenaId: NPCS[caso.npc].escena },
    npcs: { ...base.npcs, [caso.npc]: { ...base.npcs[caso.npc], relacion: caso.relacion } },
  };
  const obtenido = [];
  const textos = [];
  for (const frase of caso.frases) {
    const salida = await narrar(estado, { tipo: 'texto', texto: frase });
    obtenido.push(clasificar(salida, caso.npc));
    textos.push(`[${salida.tipo}] ${salida.texto}`);
    estado = salida.estado;
  }
  return { obtenido, textos };
}
