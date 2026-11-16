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
- HECHO — conocimientos _2: aprobados y cargados en `contenido-v3.json` (12, uno por NPC), con orden de revelación _1 antes que _2 y entradas en `temas-conocimiento.md`.
- Tanda 2 de casos (caso_05 a caso_12): sin escribir.

## 9. Futuro (sin implementar)
- NPCs secundarios: con poco lore.
- NPCs terciarios: sin importancia real.

## 6. Diagnóstico de comprensión
Solo diagnóstico: no se tocó el motor ni el contenido, y los tests que no coinciden quedan rojos (`narrador/pruebasComprension.test.js`). Todos los casos, con su resultado: `docs/diagnostico-comprension.md` (se regenera con `node narrador/diagnosticoComprension.js`).
Diseño = palabras clave y umbral de `contenido-v3.json` (Maren: `_1` umbral 40, `_2` umbral 30; Serel: `_1` umbral 30, `_2` umbral 25). Nota: `motor-caso-v1-operativo.md` §2b trata las condiciones de hitos del motor de caso, no las preguntas de tema; no sirve de referencia para este barrido.
Casos: 106. No coinciden: 40. Secuencias de dos preguntas (relación 50): 2 de 2 OK (revela `_1` y después `_2`).
Los 40 son frases de una sola palabra ("tratado", "copia", "llave", "cerradura", "harina", "hornos", "precio") o "hablame/háblame ... " sin nombrar al NPC. Todos quedan marcados "revisar con diseño": el diseño no dice qué hacer con una palabra suelta, y `SUPUESTOS.md` pide reformular `hablar_con` sin NPC nombrado.

| NPC | Frase | Relación | Diseño dice | Resultado real |
|---|---|---|---|---|
| Maren | tratado | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | copia | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No tenés nada para eso. |
| Maren | hablame sobre el tratado de la guerra | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | llave | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | cerradura | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | háblame de la copia del tratado | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | hablame de la copia del tratado | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | tratado | 39 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | copia | 39 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No tenés nada para eso. |
| Maren | hablame sobre el tratado de la guerra | 39 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | llave | 39 | conocimiento_maren_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | cerradura | 39 | conocimiento_maren_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | háblame de la copia del tratado | 39 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | hablame de la copia del tratado | 39 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | tratado | 40 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | copia | 40 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] No tenés nada para eso. |
| Maren | hablame sobre el tratado de la guerra | 40 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | llave | 40 | conocimiento_maren_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | cerradura | 40 | conocimiento_maren_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | háblame de la copia del tratado | 40 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | hablame de la copia del tratado | 40 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | tratado | 50 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | copia | 50 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] No tenés nada para eso. |
| Maren | hablame sobre el tratado de la guerra | 50 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | llave | 50 | conocimiento_maren_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | cerradura | 50 | conocimiento_maren_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Maren | háblame de la copia del tratado | 50 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Maren | hablame de la copia del tratado | 50 | conocimiento_maren_1 (revisar con diseño) | reformulacion: [reformulacion] ¿Con cuál: Maren de Orst? |
| Serel | harina | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | hornos | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | precio | 0 | ninguno ("no te cuenta nada nuevo") (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | harina | 39 | conocimiento_serel_1 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | hornos | 39 | conocimiento_serel_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | precio | 39 | conocimiento_serel_1 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | harina | 40 | conocimiento_serel_1 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | hornos | 40 | conocimiento_serel_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | precio | 40 | conocimiento_serel_1 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | harina | 50 | conocimiento_serel_1 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | hornos | 50 | conocimiento_serel_2 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
| Serel | precio | 50 | conocimiento_serel_1 (revisar con diseño) | reformulacion: [reformulacion] No entendí bien. ¿Podés decirlo de otra forma? |
