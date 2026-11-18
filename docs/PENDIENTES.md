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
Diagnóstico completo, con todos los casos: `docs/diagnostico-comprension.md` (se regenera con `node narrador/diagnosticoComprension.js`).
Con las reglas R1–R5 ("comprension: reglas R1-R5 finales"): 106 casos, 0 no coinciden. Los 4 casos "hablame sobre el tratado de la guerra" con Serel (relaciones 0, 39, 40 y 50) reformulan: "tratado" es palabra clave de Maren, ausente (R3). Secuencias de dos preguntas: 2 de 2 OK.
Tests reescritos a R1/R2/R3: 9. Los 11 tests con frase de relleno ("sigo sin decir nada claro") vuelven a pasar con R4 sin tocarlos.

### Tests rojos (0)
Ninguno. Con "comprension: hablame con NPC presente; test de harina corregido" pasan "hablar con el de la harina" sin léxico (reformula) y "hablame sobre Serel" (habla con Serel). Suite completa en verde.

### Fase 1: cerrada
Cerrada con "fase 1 cierre: plantillas sin_salidas y destino_ambiguo; consulta narrada". Las decisiones están en `docs/SUPUESTOS.md` como "decididas". La única parte sin verificar en otros entornos es la pantalla de error en navegadores distintos de Chromium (abajo).

### Fase 2: lo que queda
- Navegador real (otros navegadores), Groq real, Firebase real, HTML de Avaloria y política de privacidad (secciones 1 a 5 de este documento).
- Consultas de tema, paso C: contenido a aprobar por Tomás (sección 7).
- Motor de caso (sección 8) y futuro sin implementar (sección 9).
- Pendientes de Tomás que siguen sin respuesta (ver `docs/SUPUESTOS.md`, "Pendiente de Tomás").

### Verificación de la pantalla de error de diccionarios (manual)
- Comando: `node narrador/prueba/verificarErrorPantalla.mjs [archivo.md]`. Sin argumento es el control (no se quita nada). Requisito: Playwright con Chromium (`require('playwright')`); no es dependencia del repo.
- Es una verificación manual, **no** parte de `npm test`.
- Veredicto por caso: `OK` (control: `#aviso` vacío, sin error en la consola, Crear y Cargar habilitados) o `ERROR_ESPERADO` (archivo quitado: `#aviso` y la consola nombran el archivo, Crear y Cargar deshabilitados). Código de salida 1 solo con `DISTINTO_DE_LO_ESPERADO`. El script espera a que la página cargue y a que `#aviso` y los botones dejen de cambiar, no a que aparezca un aviso. Un archivo que no existe (`ninguno.md`) da `DISTINTO_DE_LO_ESPERADO` y código 1, como corresponde.
- Mensaje en consola: antes salía dos veces (`index.js` y `prueba/app.js`); se quitó el `console.error` de `app.js` (una línea). Ahora sale una vez.
- Resultado de la última corrida (v0.0.27, Chromium, servidor local con 404 para el archivo quitado):

| Caso | Veredicto | `#aviso` | Mensajes de error en consola | Crear / Cargar | Código |
|---|---|---|---|---|---|
| control (ninguno quitado) | OK | vacío | 0 | habilitados / habilitados | 0 |
| `diccionario-lexico.md` | ERROR_ESPERADO | con el archivo | 1 | deshabilitados / deshabilitados | 0 |
| `ortografia-tipeo.md` | ERROR_ESPERADO | con el archivo | 1 | deshabilitados / deshabilitados | 0 |
| `frases-patrones.md` | ERROR_ESPERADO | con el archivo | 1 | deshabilitados / deshabilitados | 0 |
| `contexto-palabras.md` | ERROR_ESPERADO | con el archivo | 1 | deshabilitados / deshabilitados | 0 |
| `temas-conocimiento.md` | ERROR_ESPERADO | con el archivo | 1 | deshabilitados / deshabilitados | 0 |
