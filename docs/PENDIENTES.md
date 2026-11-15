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
- **ADMIN_UID**: en `firestore.rules`, reemplazar `REEMPLAZAR_POR_TU_UID` por el uid de la cuenta de Tomás (y la misma constante en `tests/reglas/registros.rules.test.js`). Hasta entonces nadie puede leer registros.
- **Choque de ids entre partidas (a decidir)**: el id es `reg_<numeroRegistro>` y la numeración es por partida, así que dos jugadores generan los dos `reg_000001` en la misma colección. Como las reglas prohíben `update`, el segundo envío se rechaza (permission-denied) y ese registro queda trabado al frente de la cola. Pasa lo mismo si un envío llega al servidor pero la respuesta se pierde y se reintenta. Hay que elegir: id con el código de partida, subcolección por partida, o numeración global. No se cambió porque el id está fijado por el diseño.
- Reglas: probadas en el emulador (10 pruebas en verde, 2026-11-15). Sin verificar en el proyecto real ni en el simulador de la consola. No se publicó nada.
- Las pruebas de reglas se saltean en `npm test` (no hay emulador). Para correrlas: ver el encabezado de `tests/reglas/registros.rules.test.js`. Sus dependencias no están en `package.json`.
- SDK web de Firebase en navegador y sesión anónima: sin verificar. El adaptador se probó con el SDK real en Node contra el emulador.
- Integración con el HTML: no hecha. La interfaz tiene que crear el cliente (`{ db, doc, setDoc }`), iniciar sesión anónima, crear la cola con `crearColaFirestore`, pasarla a `narrar` en `opciones.cola` y llamar a `cola.enviarPendientes()`.
- La cola vive en memoria: si se cierra la página con registros sin enviar, se pierden. Guardarla en IndexedDB queda para la integración.
- Hay dos archivos de reglas: `firestore.rules` (raíz, partidas + registros) y `persistencia/firestore.rules` (solo partidas, sin tocar). El que se publica es el de la raíz.
