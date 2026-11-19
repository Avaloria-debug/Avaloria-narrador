# Informe de estado y propuestas — narrador (rama claude/motor-caso-contenido)

Verificado el 2026-11-16 sobre el commit actual de la rama. `npm test`: 1471 tests, 1471 en verde. `node narrador/validarContenido.js`: válido, 4 casos. VERSION 0.0.16. No se tocó código ni contenido.

## 0. Datos verificados

### Módulos de `narrador/`
| Estado | Módulos |
|---|---|
| Cerrados y conectados a `narrar` | contenido/validarContenido, comprension + diccionarios (léxico, ortografía), resolver, turno, npcs, conocimientos, eventos, efectosEventos, estadoEscena, reloj, viaje, movimientoNpcs, narracion, ia, registro, registroFirestore, index |
| Conectados, pero solo si `estado.caso` ya existe | casos/narrar, tags, acciones, decaimiento, hitos, desenlaces |
| Sin conectar a `narrar` | casos/instancias (`instanciar` no lo llama nadie), casos/persistencia (IndexedDB de casos: solo si se pasa `opciones.persistenciaCasos`) |
| No existe | `narrador/sim/` (simulación en lote, pendiente desde el bloque A/B) |

### Una partida real hoy
- `crearPartida` deja `caso: null`. Nadie elige ni instancia un caso: en la página de prueba y en una partida nueva **el motor de caso no corre**. Solo corre en tests que inyectan `estado.caso` a mano (`casosIntegracion.test.js`).
- Acción (botón o verbo reconocido): una de 3 plantillas de éxito o fallo por intención, sin repetir apertura en las últimas 5. Los eventos que se disparan o cierran, el movimiento de NPCs y los motivos de fallo (sin dinero, bloqueado) no se narran: no hay plantillas.
- Texto libre: catálogo + léxico + ortografía. Si entiende, igual que una acción; si no, una de las 13 claves de `reformulacion`; en la segunda pasada, IA (Groq) si hay clave, o `sin_ia`.
- Revelar un conocimiento: frase de la acción + una de 2 plantillas de `revelar_conocimiento.exito` + el `contenido` del conocimiento. Cada NPC tiene 1 conocimiento: después de revelarlo, el NPC no tiene nada más que decir (consultas de tema dan `no_se` o la misma pista ya dada).
- Hito (solo con caso inyectado): se agrega uno de los 4 textos del hito. El gancho fuera de escena se calcula pero no se narra (no hay tabla de reacciones ni textos genéricos en el contenido).

### Cobertura
- 1471 tests. Casos: hitos 60, decaimiento 25, instancias 24, validador 21, tags 20, persistencia 12, acciones 10, desenlaces 8, narrar 4, casosContenido 2.
- Sin cobertura: partida de punta a punta con un caso instanciado desde `crearPartida`; los 4 casos jugados por turnos hasta un desenlace; tasa de turnos resueltos por código (no hay métrica); repetición de textos entre partidas; navegador real, Groq real y Firebase real (sin verificar).

### Estado de los casos
| Caso | p1 | Jugable de punta a punta | Limitación |
|---|---|---|---|
| caso_01 | brenn_1 / sarin_1 | Sí, en el motor (8 firmas) | Sin instanciación desde `crearPartida`; p1 mezcla dos dueños |
| caso_02 | ysolde_1 ×2 | Sí, en el motor (4 firmas) | p1 con un solo conocimiento |
| caso_03 | sendero_sin_vigilancia ×2 | Condicionado | p1 exige `evento_tormenta_verano` activo: h1 queda esperando el evento |
| caso_04 | sarin_1 ×2 | Sí, en el motor (4 firmas) | p1 con un solo conocimiento; Sarin repite p1 de caso_01 |

"Jugable en el motor" = validador y hitos lo dan por alcanzable; ningún caso se jugó turno a turno en una partida real.

### Los 13 tests que fallan con los conocimientos `_2` cargados
Comprobado en una copia aparte: se agregaron los 12 `_2` de `docs/conocimientos-propuestos.md` a `contenido-v3.json`. Validador: válido. Suite: 1458 / 13 fallos.

- **10 por orden de revelación** (`conocimientos.test.js` ×5, `turno.test.js` conocimientos ×4, efectos de eventos ×1). Causa: `conocimientoARevelar` recorre `npc.conocimientos` y devuelve el **primero que se puede revelar**. Si `_1` está trabado (umbral, evento o marca) y `_2` no, sale `_2` primero:
  - Maren con relación 30–39: revela `_2` (umbral 30) antes que `_1` (40).
  - Ivor y Hollis sin evento: revelan `_2` (sin condición) y se saltean `_1`.
  - "Una sola vez por NPC": después de `_1` ya no da `ya_revelado`, da `_2`.
  - El `motivo` informado es el del primer pendiente, que ya no explica por qué no salió nada.
- **3 por fixtures que dan por hecho 1 conocimiento por NPC**: validador (`conocimientos[1]` fijo para el id repetido), diccionarios (`los 12 conocimientos… en temas-conocimiento`: faltan los `_2` en `temas-conocimiento.md`) y validador de palabras clave reconciliadas.

**Opción recomendada: revelación en orden estricto.** `_n` solo se considera si `_(n-1)` ya está revelado; el motivo es el del primer no revelado. Cambio de ~10 líneas en `conocimientoARevelar`, sin tocar `puedeRevelar` ni el contenido. Mantiene la historia en orden (la pista 2 no aparece antes que la 1), deja intactos los 10 tests de comportamiento y el test de "una sola vez" pasa a "una sola vez por conocimiento, en orden". Los 3 de fixtures se ajustan aparte (índice dinámico, `temas-conocimiento.md` con los `_2`, cuenta 24). Alternativa descartada: "el de menor umbral primero" (rompe con Ivor/Hollis y deja que el evento cambie el orden de la historia).

## 1. Estado actual
- El narrador por código está completo y en verde (1471 tests): entiende texto libre, resuelve, narra por plantillas y usa la IA solo en segunda pasada.
- El motor de caso (tags, hitos, desenlaces) funciona en tests, pero ninguna partida real lo activa: `crearPartida` no instancia caso.
- El jugador hoy ve un mundo sin historia: acciones con 3 plantillas, NPCs con una sola pista, y nada que avance solo.
- Los eventos y el movimiento de NPCs cambian el estado pero no se narran: el mundo cambia en silencio.
- Cada NPC se agota tras su primer conocimiento; las consultas posteriores repiten o dan `no_se`.
- caso_02 a caso_04 tienen p1 con un solo conocimiento; caso_03 depende de un evento para arrancar.
- Los 12 `_2` están listos pero sin aprobar; cargarlos hoy rompe 13 tests por el orden de revelación.
- No hay simulador ni métrica del 80 % por código: el objetivo no se puede medir todavía.

## 2. Ideas para mejorar (por impacto percibido)

### 2.1 Activar un caso al crear la partida
- **Juego:** desde el primer turno hay una historia en curso con hitos que llegan solos.
- **Dónde:** código (`index.js`: `crearPartida` llama a `instanciar` con `casos.json` y el historial; la página de prueba carga `casos.json`).
- **Costo:** Code 3–4 h. Tomás 0,5 h (jugar una partida en la página de prueba).
- **Riesgo:** elegir siempre el mismo caso si el historial no persiste entre partidas (IndexedDB de casos sin verificar en navegador).
- **Aprobación:** no hace falta; usa contenido aprobado.
- **Pautas:** respeta todas.
- **Éxito:** test nuevo `crearPartida` → `estado.caso.casoId` ∈ casos y firma válida; 4 partidas seguidas con historial guardado eligen firmas distintas (test con `fake-indexeddb`).

### 2.2 Simulador en lote (`narrador/sim/`)
- **Juego:** indirecto; es lo que permite medir "80 % por código" y "sin repetición entre partidas".
- **Dónde:** código (script fuera de `npm test`, con frases de `data/fixtures` y semillas).
- **Costo:** Code 5–6 h. Tomás 0,5 h (leer el primer reporte).
- **Riesgo:** frases de prueba poco realistas inflan la tasa por código.
- **Aprobación:** no.
- **Pautas:** respeta todas (sin IA: modo código).
- **Éxito:** el script imprime, sobre 200 partidas × 60 turnos: % de turnos por código, % de reformulación, % a IA, casos que llegan a desenlace y repetición de aperturas/textos de hito entre partidas. Un test corre 2 partidas cortas y comprueba la forma del reporte.

### 2.3 Cargar los `_2` con revelación en orden estricto
- **Juego:** cada NPC tiene una segunda pista; volver a hablar con alguien de confianza da algo nuevo.
- **Dónde:** ambos (`conocimientos.js` orden estricto; `contenido-v3.json` + `temas-conocimiento.md` con los 12 `_2`).
- **Costo:** Code 2 h (código + 3 fixtures). Tomás 1,5 h (aprobar 12 conocimientos ya escritos, uno por uno; ~7 min cada uno).
- **Riesgo:** palabras clave nuevas compiten con alias o temas existentes en la comprensión.
- **Aprobación:** sí, cada `_2` marcado `[x]` en `docs/conocimientos-propuestos.md`, y autorización explícita para tocar `contenido-v3.json`.
- **Pautas:** respeta (lore crece con conocimientos aprobados).
- **Éxito:** suite en verde con 24 conocimientos; test "Maren con relación 30–39 no revela `_2` sin `_1`"; test "Ivor sin evento no revela `_2`".

### 2.4 Completar p1 de caso_02 a caso_04 con los `_2`
- **Juego:** el mismo caso se juega con otra pista de arranque; caso_03 ya no espera la tormenta para empezar.
- **Dónde:** contenido (`casos.json`: p1 = `_1` / `_2` del mismo dueño). Depende de 2.3.
- **Costo:** Sonnet 1 h. Tomás 0,5 h (los textos de h1–h7 usan `{conocimiento:p1}`, no cambian; revisar que la frase de h1 siga teniendo sentido con la pista nueva).
- **Riesgo:** un texto de hito redactado pensando en el `_1` puede no encajar con el `_2`.
- **Aprobación:** sí, decisiones 1 y 2 de "Pendiente de Tomás" en `docs/SUPUESTOS.md` (Ronda Opus).
- **Pautas:** respeta.
- **Éxito:** `validarCasos` sin errores; test: caso_02 a caso_04 tienen 8 firmas válidas; caso_03 tiene al menos una firma sin `requiereEvento` en p1.

### 2.5 Narrar eventos y gancho con plantillas genéricas por familia de tag
- **Juego:** el mundo avisa lo que pasa ("Se arma revuelo en el mercado", "Alguien te busca en el camino del norte") en lugar de cambiar en silencio.
- **Dónde:** ambos (contenido: bloque de plantillas por familia de evento/estado y por gancho; código: `narracion.js` las agrega después de la frase de la acción).
- **Costo:** Sonnet 2 h (borrador de ~3 frases × 6 estados de escena + 3 de gancho ≈ 27 frases). Code 3 h. Tomás 1 h de revisión.
- **Riesgo:** frases genéricas repetidas cansan rápido si no hay ventana de aperturas propia.
- **Aprobación:** sí, Tomás aprueba cada frase antes de cargarla (las escribe Sonnet como propuesta en un doc aparte).
- **Pautas:** respeta (texto solo en `plantillas`, aprobado).
- **Éxito:** test: un turno que dispara un evento incluye una frase del bloque nuevo; el simulador muestra 0 turnos con evento disparado sin texto; ninguna apertura se repite dentro de la ventana de 5.

### 2.6 Narrar el movimiento de NPCs con presencia en la escena
- **Juego:** el jugador se entera de que Brenn, Sarin, Ysolde u Hollis llegaron o se fueron; los hitos de reparación (h5/h6) dejan de depender de la suerte de cruzarse.
- **Dónde:** ambos (contenido: plantillas `llega` / `se_va`, ~6 frases; código: `turno.js` ya devuelve posiciones, falta comparar antes y después en la escena del jugador).
- **Costo:** Sonnet 0,5 h. Code 2 h. Tomás 0,5 h.
- **Riesgo:** ruido si el jugador se queda muchos turnos donde pasan NPCs que rotan.
- **Aprobación:** sí, las 6 frases.
- **Pautas:** respeta.
- **Éxito:** test: avanzar el reloj 12 h en `escena_lago_espejos` con Ysolde presente produce una frase de `se_va`; simulador: % de partidas de caso_02 que disparan h5 y h6 sube respecto de la medición base.

### 2.7 Cerrar el mapeo intención → acción de caso (8 aproximadas)
- **Juego:** lo que el jugador hace (amenazar, ayudar, comerciar) deja marcas visibles en el caso; hoy el contexto de la acción va vacío y el nivel es siempre el mínimo.
- **Dónde:** código (`casos/acciones.js` + contexto desde `turno`: resultado, NPC, visto/detectado según estado de escena).
- **Costo:** Code 4 h. Tomás 1 h (decidir 3 reglas: cuándo un hablar es "amable", nivel de gratitud por éxito, "visto" según estado de escena).
- **Riesgo:** una regla mal elegida escribe rencor o gratitud por acciones triviales.
- **Aprobación:** sí, las 3 reglas (lista corta en `docs/SUPUESTOS.md`).
- **Pautas:** respeta (tags sin resentimiento salvo el grave, que sigue con el dueño y tres condiciones).
- **Éxito:** test por intención aproximada con contexto (éxito/fallo, visto/no visto) que comprueba el tag y nivel escrito; simulador: % de partidas con algún tag escrito por el jugador.

### 2.8 Variantes de `revelar_conocimiento` y `no_se`
- **Juego:** el momento de la pista y el "no sé" suenan distintos de una vez a la otra.
- **Dónde:** contenido (`plantillas.revelar_conocimiento.exito` de 2 a 5; `no_se` de las actuales a 5).
- **Costo:** Sonnet 0,5 h (propuesta). Tomás 0,5 h.
- **Riesgo:** bajo; solo validador de aperturas.
- **Aprobación:** sí, cada frase.
- **Pautas:** respeta.
- **Éxito:** validador sin errores; simulador: ninguna frase de revelación se repite dentro de una misma partida de 60 turnos.

## 3. Descartadas
- IA para narrar eventos o ganchos sin aprobación: viola "la IA no narra sin aprobación".
- Subir el presupuesto de IA o llamarla en la primera pasada para subir la tasa: viola el tope de 800 tokens y el objetivo de 80 % por código.
- Que la IA proponga conocimientos y se carguen en caliente: viola "nada se agrega sin revisión humana".
- Reparar el rencor grave con hitos genéricos o acciones de rutina: viola la regla del NPC dueño y tres condiciones.
- Hitos con plazo en horas o derrota por tiempo: viola "sin límite de tiempo" y "hitos por turnos o condición".
- Dar `movimiento` a más NPCs para variar p1: cambia el mundo fijo y rompe tests de escena; los `_2` resuelven lo mismo.
- Tanda 2 de casos (caso_05 a caso_12) antes del simulador: se escriben 8 casos sin poder medir si los 4 actuales llegan a desenlace.
- Las 11 acciones sin intención (robar, mentir, etc.) como intenciones nuevas: amplía el catálogo y la comprensión; no aporta hasta que 2.7 esté cerrado.

## 4. Recomendación de orden
1. **2.1 Activar caso + 2.2 simulador.** Criterio: sin esto el jugador no ve ninguna historia y nada se puede medir. Son solo código y no esperan a Tomás. La primera corrida del simulador da la línea base del 80 %.
2. **2.3 `_2` con orden estricto + 2.4 p1 completo.** Criterio: mayor ganancia de variedad entre partidas por hora de Tomás (2 h de revisión de texto ya escrito); destraba caso_03 y la tanda 2.
3. **2.5 + 2.6 narrar eventos, gancho y movimiento.** Criterio: es lo que más hace sentir que "la historia avanza" una vez que el caso corre; se mide con el simulador ya armado. 2.7 y 2.8 después, según lo que muestre el simulador (tags escritos y repetición de frases).
