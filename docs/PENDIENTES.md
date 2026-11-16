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

## 6. Página de prueba aislada (`narrador/prueba/`)
No es la interfaz de Avaloria: no usa `ui/`, `index.html` ni Firestore. Sirve para probar el narrador a mano en un navegador.

Cómo se abre:
1. En la raíz del repo: `python -m http.server 8000` (o `python3`). No sirve abrir el archivo con doble clic: los módulos ES y el `fetch` del contenido necesitan un servidor.
2. En el navegador: `http://localhost:8000/narrador/prueba/`.
3. "Crear partida". Después, escribir en el campo de texto o usar los botones de intención (NPC, objeto y destino son opcionales; viajar necesita destino).
4. "Guardar" y "Cargar" usan IndexedDB del navegador (base `narrador_prueba`).
5. Clave de Groq (opcional): pegarla y "Guardar clave". Queda en `localStorage` de ese navegador y solo se envía a la API de Groq. Sin clave, el narrador funciona en modo código.
6. El panel muestra el texto, el tipo, los errores, los tokens de la llamada a la IA (si hubo) y el registro del turno. Los registros se acumulan en la cola en memoria: se pierden al recargar.

Comprobado en Chromium (automático, sin persona): carga del contenido por `fetch`, botones, texto libre, IndexedDB real (guardar, recargar, cargar) y `localStorage`. La llamada a Groq se probó con una respuesta simulada.
Sin verificar: Groq real desde el navegador (clave real, CORS, forma de `usage`), y otros navegadores.

## 7. Consultas de tema: paso C (contenido, a aprobar por Tomás)
- Hecho en código: A, la respuesta `no_se` cuando el NPC no conoce el tema; y B, `palabrasClave` en cada conocimiento para responder preguntas de tema.
- Paso C, sin hacer: ampliar el contenido de conocimientos y de respuestas de tema (más conocimientos por NPC, más palabras clave, más variantes de `no_se`). Todo texto nuevo lo aprueba Tomás.
- Las `palabrasClave` actuales, salvo las de Serel, son una primera propuesta y también quedan a aprobar.

## 8. Motor de caso
- Bloque C (desenlaces, validador, narrar e integración): cerrado.
- Bloques A y B (modelo, tags, decaimiento, instancias, hitos, textos): hechos en código y probados con `npm test`. Falta la simulación en lote (`narrador/sim/`) fuera de npm test.
- Casos: caso_01 a caso_04 escritos y verificados (ronda Opus, sin errores). p1 de caso_02 a caso_04 con un solo conocimiento válido: decisión pendiente de Tomás (`docs/SUPUESTOS.md`, "Ronda Opus").
- Conocimientos nuevos: 12 propuestos en `docs/conocimientos-propuestos.md`, pendientes de aprobación uno por uno. No están en `contenido-v3.json`.
- Aprobar conocimientos propuestos (docs/conocimientos-propuestos.md, versión final revisada) y cargarlos en contenido-v3.json. Después, tanda 2 de casos.
- Pendiente de Tomás: confirmar la versión final y cargar conocimientos aprobados en contenido-v3.json.
- Tanda 2 de casos (caso_05 a caso_12): sin escribir; espera la aprobación de los conocimientos.

## 9. Futuro (sin implementar)
- NPCs secundarios: con poco lore.
- NPCs terciarios: sin importancia real.
