// Destino de registros en Firestore (colección `registros_turnos`). Desactivado por defecto: solo guarda si se crea
// con `habilitarFirestore: true`, y hoy ningún módulo lo hace. Sin Analytics.
// - Desactivado: `guardar` resuelve `{ guardado: false }` y no toca el SDK (ni lo carga).
// - Activado: valida primero; sin `version` (o cualquier otro error) rechaza sin llamar al SDK.
// El SDK llega por `sdk` ({ initializeApp, getFirestore, collection, addDoc }) o, si no, se importa de 'firebase'.
// SIN VERIFICAR: el import de 'firebase' desde un navegador sin empaquetador y la escritura contra el proyecto real.
import { RegistroTurnos, exigirRegistroTurno } from './registroTurnos.js';
import { firebaseConfig, COLECCION_REGISTROS_TURNOS } from './firebaseConfig.js';

async function cargarSdk() {
  const [app, firestore] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
  return { initializeApp: app.initializeApp, getFirestore: firestore.getFirestore, collection: firestore.collection, addDoc: firestore.addDoc };
}

export class FirestoreRegistro extends RegistroTurnos {
  #habilitado;
  #sdk;
  #config;
  #db = null;

  constructor({ habilitarFirestore = false, sdk = null, config = firebaseConfig } = {}) {
    super();
    this.#habilitado = habilitarFirestore === true;
    this.#sdk = sdk;
    this.#config = config;
  }

  get habilitado() {
    return this.#habilitado;
  }

  async guardar(registro) {
    if (!this.#habilitado) return { guardado: false, motivo: 'desactivado' };
    exigirRegistroTurno(registro);
    this.#sdk ??= await cargarSdk();
    if (this.#db === null) this.#db = this.#sdk.getFirestore(this.#sdk.initializeApp(this.#config));
    const ref = await this.#sdk.addDoc(this.#sdk.collection(this.#db, COLECCION_REGISTROS_TURNOS), { ...registro });
    return { guardado: true, id: ref?.id ?? null };
  }
}
