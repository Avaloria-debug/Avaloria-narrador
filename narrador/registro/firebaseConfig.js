// Configuración mínima del proyecto de Firebase para los registros de turnos.
// Sin Analytics: no hay measurementId. No lleva claves ni secretos.
// SIN VERIFICAR contra el proyecto real: `apiKey` y el resto de la configuración web los pone quien integra.
export const firebaseConfig = Object.freeze({
  projectId: 'cronicas-de-avaloria',
});

export const COLECCION_REGISTROS_TURNOS = 'registros_turnos';
