# Pendientes

El narrador por código está completo en código y probado de punta a punta (`narrador/integracionFinal.test.js`). Lo que sigue es lo que falta fuera del código: no se puede comprobar desde el repo.

## 1. Prueba en navegador real
- Cargar `narrador/index.js` como módulo en un navegador: carga del contenido por `fetch`, `crypto` y `TextEncoder`.
- Guardar y cargar el estado con IndexedDB real (hasta ahora, solo con un IndexedDB falso).
- SDK web de Firebase en navegador y sesión anónima. El adaptador se probó con el SDK real, pero en Node y contra el emulador.

## 2. Groq real
- Confirmar con una clave real el nombre del parámetro de tokens de salida (hoy `max_completion_tokens`), la URL, el modelo y las cabeceras.
- Confirmar los límites: conteo real de tokens (el del código es una aproximación), si el razonamiento consume los tokens de salida, y las cabeceras y mensajes del 429 del límite diario.

## 3. Firebase real
- Probar `firestore.rules` (el de la raíz: partidas + registros) en el proyecto real o en el simulador de la consola, y recién después publicarlo. Hasta ahora: emulador, 12/12. No se publicó nada.
- La UID de administrador ya está cargada en las reglas. El comentario "REEMPLAZAR antes de publicar" de `firestore.rules` quedó viejo y se puede borrar.
- `persistencia/firestore.rules` (solo partidas) no es el que se publica.
- Marcar `revision` y `notas` de un registro se hace desde la consola o el Admin SDK: las reglas no dejan modificar registros.
- Las pruebas de reglas no corren en `npm test` (no hay emulador). Cómo correrlas: encabezado de `tests/reglas/registros.rules.test.js`.

## 4. Integración con el HTML
- Conectar la interfaz con `crearPartida`, `cargarPartida` y `narrar`. No se tocó `ui/` ni `index.html`.
- Registros: crear el cliente (`{ db, doc, setDoc }`), iniciar sesión anónima, crear la cola con `crearColaFirestore(cliente, { codigoPartida })`, pasarla a `narrar` en `opciones.cola` y llamar a `cola.enviarPendientes()`.
- Decidir qué hace la interfaz con `cola.fallidos()`. Si se envía antes de iniciar sesión, los registros caen ahí; `cola.reintentarFallidos()` los devuelve a la cola.
- La cola vive en memoria: si se cierra la página con registros sin enviar, se pierden. Guardarla (por ejemplo en IndexedDB) es parte de la integración.
- Mostrar el aviso de IA agotada cuando `errores` trae `sin_ia`, y sacar los avisos de `estado.avisos` una vez mostrados.
- Pantalla de la clave de Groq: textos en `docs/onboarding-v1.md`.

## 5. Política de privacidad
- Los registros guardan el texto completo del jugador. Antes de compartir el juego fuera del grupo actual hay que definir la política de privacidad y el texto de consentimiento (`docs/sistema-registro-aprendizaje-narrador.md`, sección 6).
- Hasta entonces, solo la cuenta de administrador lee los registros.
