// Persistencia del motor de caso en IndexedDB (docs/motor-caso-v1-operativo.md, sección 2).
// Seis stores; cada registro guarda versionContenido. Todo lo que se escribe en un turno va en una sola
// transacción: `turno(fn)`. Las operaciones sueltas (guardarEstadoCaso, sumarUsoTexto...) abren la suya.
// `indexedDB` es inyectable: en Node los tests usan fake-indexeddb. IndexedDB de navegador real: sin verificar.

export const NOMBRE_BD = 'avaloria';
/** Versión del esquema: sube 1 por cada cambio de stores. */
export const VERSION_ESQUEMA = 1;

/** Stores y su clave. */
export const STORES = Object.freeze({
  partidas: 'partidaId',
  estado_caso: 'partidaId',
  historial_instancias: ['jugadorId', 'casoId', 'firma'],
  uso_textos: ['jugadorId', 'textoId'],
  historial_tonos: 'jugadorId',
  reacciones_aprobadas: 'id',
});

const NOMBRES_STORES = Object.freeze(Object.keys(STORES));

function comoPromesa(peticion) {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error ?? new Error('IndexedDB: operación fallida.'));
  });
}

function exigirTexto(valor, nombre) {
  if (typeof valor !== 'string' || valor === '') throw new Error(`persistencia de casos: falta ${nombre}`);
}

/** Operaciones sobre una transacción abierta. Todas devuelven promesa. */
function operaciones(tx, versionContenido) {
  const store = (nombre) => tx.objectStore(nombre);
  const leer = (nombre, clave) => comoPromesa(store(nombre).get(clave)).then((r) => r ?? null);
  const escribir = (nombre, registro) => comoPromesa(store(nombre).put({ ...registro, versionContenido }));
  /** Registro leído, con `compatible`: false si se guardó con otra versión del contenido. */
  const conCompatibilidad = (registro) =>
    registro ? { ...registro, compatible: registro.versionContenido === versionContenido } : null;

  return {
    async guardarPartida(partidaId, partida) {
      exigirTexto(partidaId, 'partidaId');
      await escribir('partidas', { partidaId, partida });
    },
    async leerPartida(partidaId) {
      return conCompatibilidad(await leer('partidas', partidaId));
    },

    async guardarEstadoCaso(partidaId, estado) {
      exigirTexto(partidaId, 'partidaId');
      await escribir('estado_caso', { partidaId, estado });
    },
    /** @returns {Promise<{partidaId, estado, versionContenido, compatible}|null>} */
    async leerEstadoCaso(partidaId) {
      return conCompatibilidad(await leer('estado_caso', partidaId));
    },

    /** Suma 1 al uso de una instancia (firma) y devuelve el total. `orden` cuenta cuándo se usó por última vez. */
    async sumarUsoInstancia(jugadorId, casoId, firma, { hora = null } = {}) {
      exigirTexto(jugadorId, 'jugadorId');
      exigirTexto(casoId, 'casoId');
      exigirTexto(firma, 'firma');
      const previo = await leer('historial_instancias', [jugadorId, casoId, firma]);
      const usos = (previo?.usos ?? 0) + 1;
      await escribir('historial_instancias', { jugadorId, casoId, firma, usos, ultimaHora: hora });
      return usos;
    },
    async usoDeInstancia(jugadorId, casoId, firma) {
      return (await leer('historial_instancias', [jugadorId, casoId, firma]))?.usos ?? 0;
    },
    /** Instancias jugadas de un caso por un jugador: [{ firma, usos, ultimaHora }]. */
    async instanciasDeCaso(jugadorId, casoId) {
      const todas = await comoPromesa(store('historial_instancias').getAll());
      return todas
        .filter((r) => r.jugadorId === jugadorId && r.casoId === casoId)
        .map(({ firma, usos, ultimaHora }) => ({ firma, usos, ultimaHora }));
    },

    /** Suma 1 al uso de un texto y devuelve el total. */
    async sumarUsoTexto(jugadorId, textoId) {
      exigirTexto(jugadorId, 'jugadorId');
      exigirTexto(textoId, 'textoId');
      const previo = await leer('uso_textos', [jugadorId, textoId]);
      const usos = (previo?.usos ?? 0) + 1;
      await escribir('uso_textos', { jugadorId, textoId, usos });
      return usos;
    },
    async usoDeTexto(jugadorId, textoId) {
      return (await leer('uso_textos', [jugadorId, textoId]))?.usos ?? 0;
    },

    /** Agrega un tono al final del historial del jugador. */
    async agregarTono(jugadorId, tono) {
      exigirTexto(jugadorId, 'jugadorId');
      exigirTexto(tono, 'tono');
      const previo = await leer('historial_tonos', jugadorId);
      const tonos = [...(previo?.tonos ?? []), tono];
      await escribir('historial_tonos', { jugadorId, tonos });
      return tonos;
    },
    async leerTonos(jugadorId) {
      return (await leer('historial_tonos', jugadorId))?.tonos ?? [];
    },

    async guardarReaccionAprobada(reaccion) {
      exigirTexto(reaccion?.id, 'id de la reacción');
      await escribir('reacciones_aprobadas', reaccion);
    },
    async leerReaccionAprobada(id) {
      return conCompatibilidad(await leer('reacciones_aprobadas', id));
    },
  };
}

/**
 * Abre la base del motor de caso.
 * @param {{versionContenido:string, indexedDB?:IDBFactory, nombreBD?:string}} opciones
 *   versionContenido: la de data/contenido/contenido-v3.json; se guarda en cada registro.
 */
export async function abrirPersistenciaCasos({ versionContenido, indexedDB = globalThis.indexedDB, nombreBD = NOMBRE_BD } = {}) {
  if (!indexedDB) throw new Error('persistencia de casos: no hay indexedDB disponible en este entorno.');
  exigirTexto(versionContenido, 'versionContenido');

  const bd = await new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(nombreBD, VERSION_ESQUEMA);
    pedido.onupgradeneeded = () => {
      for (const nombre of NOMBRES_STORES) {
        if (!pedido.result.objectStoreNames.contains(nombre)) {
          pedido.result.createObjectStore(nombre, { keyPath: STORES[nombre] });
        }
      }
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error ?? new Error('IndexedDB: no se pudo abrir la base.'));
  });

  /** Corre `fn(ops)` dentro de una sola transacción. Si `fn` falla, no se guarda nada. */
  async function transaccion(modo, fn) {
    const tx = bd.transaction(NOMBRES_STORES, modo);
    const terminada = new Promise((resolver, rechazar) => {
      tx.oncomplete = () => resolver();
      tx.onabort = () => rechazar(tx.error ?? new Error('IndexedDB: transacción abortada.'));
      tx.onerror = () => rechazar(tx.error ?? new Error('IndexedDB: transacción fallida.'));
    });
    let resultado;
    try {
      resultado = await fn(operaciones(tx, versionContenido));
    } catch (error) {
      terminada.catch(() => {});
      try {
        tx.abort();
      } catch {
        // la transacción ya había terminado
      }
      throw error;
    }
    await terminada;
    return resultado;
  }

  const api = {
    versionContenido,
    /** Todas las escrituras de un turno, en una transacción: `await bd.turno(async (t) => { ... })`. */
    turno: (fn) => transaccion('readwrite', fn),
    cerrar: () => bd.close(),
  };
  // Operaciones sueltas: cada una en su propia transacción.
  const lecturas = ['leerPartida', 'leerEstadoCaso', 'usoDeInstancia', 'instanciasDeCaso', 'usoDeTexto', 'leerTonos', 'leerReaccionAprobada'];
  const escrituras = ['guardarPartida', 'guardarEstadoCaso', 'sumarUsoInstancia', 'sumarUsoTexto', 'agregarTono', 'guardarReaccionAprobada'];
  for (const nombre of lecturas) api[nombre] = (...args) => transaccion('readonly', (t) => t[nombre](...args));
  for (const nombre of escrituras) api[nombre] = (...args) => transaccion('readwrite', (t) => t[nombre](...args));
  return api;
}
