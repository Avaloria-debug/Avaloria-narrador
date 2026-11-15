## Bloque 3b: cerrado
- npcs.js, conocimientos.js, efectosEventos.js y movimientoNpcs.js fueron revisados sin errores (commit 9b0bb5b).
- Costo en reloj de cada acción: resuelto en el contenido (`reglas.costoHorasPorVerbo`) y anotado en docs/SUPUESTOS.md.
- Correcciones hechas fuera de resolver/turno en este bloque: "ayudar" vs "saludar" (coincidencia exacta gana), lugares de camino como destino de viajar, evento por hora con duración en turnos que venció durante un viaje.

## Bloque 4: narración por plantillas (hecho)
- Leer prompt v3, sección 5.5, y plantillas de data/contenido/contenido-v3.json.
- Implementar narrador/narracion.js: placeholders {npc}, {objeto}, {lugar}, {conocimiento}, {nombres}.
- Ventana de 5 aperturas sin repetir.
- Si falta un valor de placeholder, elegir una plantilla que no lo necesite.
- Reformulaciones: usar plantillas.reformulacion (ya existen).
- Tests: placeholders, variación de aperturas, falta de valor, reformulaciones.

## Bloque 5
- 5a (hecho): cliente de la IA (narrador/ia.js) y registro con cola local (narrador/registro.js).
- 5b (hecho): contrato público en narrador/index.js (crearPartida, cargarPartida, narrar).
- 5c (hecho): Firestore. Adaptador (narrador/registroFirestore.js), reglas (firestore.rules) y cola conectada: `narrar` encola el registro si recibe `opciones.cola`.
- A verificar con una clave real antes de cerrar: parámetros y cabeceras de Groq, conteo real de tokens y si el razonamiento consume los 120 tokens de salida.

## Bloque 5c: pendientes antes de publicar
- UID de administrador: cargada en `firestore.rules` (y en `tests/reglas/registros.rules.test.js`). Reglas probadas en el emulador con esa UID, 12/12.
- Choque de ids entre partidas: resuelto. El id en Firestore es `reg_<codigoPartida>_<número de 6 dígitos>`. Un rechazo permanente pasa a `cola.fallidos()` y no traba la cola; reenviar un registro ya enviado cuenta como enviado.
- La interfaz tiene que pasar el `codigoPartida` de la partida al crear la cola (`crearColaFirestore(cliente, { codigoPartida })`), y decidir qué hace con `cola.fallidos()` (hoy solo quedan en memoria, con su motivo).
- Si se intenta enviar sin sesión anónima iniciada, Firestore rechaza con permission-denied y los registros pasan a fallidos: después de iniciar sesión, `cola.reintentarFallidos()` los devuelve a la cola.
- Reglas: probadas en el emulador (12 pruebas en verde, 2026-11-15, con el id nuevo). Sin verificar en el proyecto real ni en el simulador de la consola. No se publicó nada.
- Las pruebas de reglas se saltean en `npm test` (no hay emulador). Para correrlas: ver el encabezado de `tests/reglas/registros.rules.test.js`. Sus dependencias no están en `package.json`.
- SDK web de Firebase en navegador y sesión anónima: sin verificar. El adaptador se probó con el SDK real en Node contra el emulador.
- Integración con el HTML: no hecha. La interfaz tiene que crear el cliente (`{ db, doc, setDoc }`), iniciar sesión anónima, crear la cola con `crearColaFirestore(cliente, { codigoPartida })`, pasarla a `narrar` en `opciones.cola` y llamar a `cola.enviarPendientes()`.
- La cola vive en memoria: si se cierra la página con registros sin enviar, se pierden. Guardarla en IndexedDB queda para la integración.
- Hay dos archivos de reglas: `firestore.rules` (raíz, partidas + registros) y `persistencia/firestore.rules` (solo partidas, sin tocar). El que se publica es el de la raíz.
