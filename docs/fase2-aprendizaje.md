# Fase 2: registro de análisis (aprendizaje)

Documento nuevo (v0.0.35). Describe qué turnos entran al registro de análisis (`narrador/registro/`, `opciones.registroTurnos` de `narrar`). No es la cola de sincronización de la partida (`narrador/registro.js`), que sigue aparte y registra todo turno de texto libre.

## Regla
Se registra cuando **el jugador escribió algo que el motor no entendió**. Un pedido de aclaración (el motor entendió y falta un dato, o el mundo no lo permite) no se registra.

## Lista exacta (supuesto revisable)
Motivos de reformulación que devuelve `decidir()` / `ejecutarTurno`:

| Motivo | ¿Se registra? | Por qué |
|---|---|---|
| `no_entendido` | sí | no hay intención |
| `intencion_ambigua` | sí | la frase no dice cuál de dos intenciones |
| `falta_destino` | no | aclaración: entendió "viajar", falta el destino |
| `destino_ambiguo` | no | aclaración: varias salidas |
| `destino_repetido` | no | aclaración: respuesta corta que coincide con varias |
| `falta_npc` | no | aclaración: falta a quién |
| `npc_ambiguo` | no | aclaración |
| `npc_ausente` | no | entendió; el NPC no está |
| `sin_npcs` | no | entendió; no hay con quién |
| `falta_objeto` | no | aclaración |
| `objeto_ambiguo` | no | aclaración |
| `sin_objetos` | no | entendió; no hay objetos aplicables |
| `sin_salidas` | no | entendió; la escena no tiene salidas |

El código lo fija `MOTIVOS_REGISTRABLES` y `MOTIVOS_DE_ACLARACION` (`narrador/registro/registroTurnos.js`); un test falla si aparece un motivo nuevo sin clasificar.

## Turnos que pasan a la IA
Siempre se registran (la frase no se resolvió ni tras reformular). Su `motivo` es el de la reformulación anterior (por ejemplo `falta_destino`), no `no_entendido` genérico: el estado guarda `motivoReformulacion` (solo el id, nunca la frase) y se borra con cualquier turno que no sea reformulación. `respuestaIA` solo si respondió la IA; sin clave (plantilla `sin_ia`) queda `null`.

## Una línea por frase (v0.0.36)
Una reformulación registrable no se escribe en el momento: su línea queda **pendiente en memoria** (un `WeakMap` de `narrador/index.js`, por destino `RegistroTurnos`); el estado de la partida sigue guardando solo `motivoReformulacion` (id). El turno siguiente decide:

| Turno siguiente | Líneas |
|---|---|
| texto que el motor resuelve por regla | 0: la pendiente se descarta; la segunda no se registra |
| texto que pasa a la IA | 1: la del turno de IA, con `respuestaIA` y el motivo original |
| texto no entendido sin IA (plantilla `sin_ia`) | 1: la del turno `sin_ia`, motivo original, `respuestaIA: null` |
| botón (no es texto) | 1: la pendiente, con su motivo, escrita al cerrar ese turno, una vez |

La pendiente solo vale si el estado recibido sigue en esa reformulación (mismo id de motivo); si no, se descarta. La lista de motivos registrables y el formato del registro no cambian.

- SUPUESTO: texto seguido de un pedido de aclaración (p. ej. `banana xyz` → `viajar`, que da `falta_destino`) cuenta como "el motor entiende": la pendiente se descarta.
- SUPUESTO: dos reformulaciones registrables seguidas (dos frases distintas) escriben la primera y dejan pendiente la segunda.
- SUPUESTO: una pendiente que no llegó a cerrarse (se cierra la página, se exporta antes del turno siguiente) no está en el archivo exportado: el turno no terminó.
- SUPUESTO: un turno con entrada inválida (error) no toca la pendiente.
- SUPUESTO: la pendiente es por destino `RegistroTurnos`, no por partida: dos partidas que comparten destino a la vez se pisan (hoy la página de prueba usa una sola).

## Qué no se registra
Acciones, consultas, saludos, reconocimientos y botones.
