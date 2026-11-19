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

## Qué no se registra
Acciones, consultas, saludos, reconocimientos y botones.
