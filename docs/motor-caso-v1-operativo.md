# Motor de Caso v1 — Operativo

## 1. Módulos

`narrador/casos/*.js`; pruebas `*.test.js` (node --test). Lote: `narrador/sim/runner.js`, fuera de npm test.

## 2. Datos

- **Caso**: id, tono, escenas_origen, ranuras_pista[3], bandos, hitos[8], ramas, desenlaces.
- **Ranura**: id p1–p3, conocimientos_validos (2). El NPC de la pista es el dueño del conocimiento en contenido-v3.json.
- **Instancia**: casoId, firma, pistas[{ranura, conocimientoId, npcId (dueño), orden}], semilla. Firma = conjunto de conocimientos por ranura, sin orden. 8 firmas por caso (2 × 2 × 2).
- **Hito**: id, condiciones, escena_entrega (escena | escena(pN) | null), textos[4], efectos, es_reparacion, repara_rencor_grave, bloquea, final.
- **Tag**: tipo, objetivo, nivel 1–3, creadoHora, creadoHito, casoId, origen. Único por (tipo, objetivo).

IndexedDB (versionContenido; una transacción por turno):

| Store | Clave |
|---|---|
| partidas | partidaId |
| estado_caso | partidaId |
| historial_instancias | [jugadorId, casoId, firma] |
| uso_textos | [jugadorId, textoId] |
| historial_tonos | jugadorId |
| reacciones_aprobadas | id |

## 3. Elección de caso

1. Pool = 12 − casosJugados.
2. Pesos: tono = último ×0.3; = dos anteriores ×0.6; ×1/(1+partidas jugadas); escena inicial en origen ×1.2.
3. Sorteo con semilla.

Secuencia: siguen reloj, contadorHitos, relaciones, textosUsados, efectos_post, tags con decaimiento propio. Se borran cierres de caso y ranuras (qué conocimiento ocupaba p1–p3). pista_conocida se conserva con su nivel; si coincide con una ranura nueva, la ranura arranca con ese nivel. hitoPrevio = null. Arranque al entrar a escenas_origen o a las 6 h con gancho. Pool agotado → modo libre.

## 4. Instanciación

1. Candidatos: 2 conocimientos por ranura, sin dueño ni conocimiento repetido.
2. Excluir en p1 conocimiento cuyo dueño tenga rencor grave.
3. Firma no jugada por el jugador; si no hay, menos usos (empate: más vieja).
4. Orden: permutación válida menos usada.
5. Guardar y sumar uso.

## 5. Hitos

Condiciones: requiere_hitos, tags (por ranura), escena, hora (rango o relativa), estado_evento, pistas.

hitoPrevio = último hito disparado del caso activo (hora, escena, contador); sin hitos, el momento de instanciación.

Ranura habilitada cuando la anterior en el orden llega a nivel 1.

Ciclo por turno:
1. Acción → tags.
2. Reloj → decaimiento por horas.
3. Condición cumplida → hitosListos.
4. Disparar si el jugador está en escena_entrega.
5. Prioridad: reparación > bloquea ramas > menor id. Máx. 1 por turno.
6. Al disparar: contadorHitos+1, hitoPrevio, efectos, bloqueos, decaimiento por hitos, texto.

Fuera de escena: gancho; a 12 h, escena del NPC de ranura más cercano.

Anti-traba: 8 turnos sin listos → bajar umbral; rencor grave → habilitar reparación; 24 h sin avance → pista nivel 1; finales bloqueados → neutro por abandono.

## 6. Tags por acción

| Acción | Tags (nivel) |
|---|---|
| hablar_amable | curiosidad 1 |
| ayudar | gratitud 1–2, favor_debido 1 |
| regalar_objeto | gratitud 1 (2 si precio ≥ umbral) |
| mentir detectado | desconfianza 1 (2 si reincide) |
| amenazar | miedo 2, rencor 1, chisme_activo 1 |
| atacar | miedo 3, rencor 2, fama_violenta 2, vigilancia_escena 2, sospecha_crimen 1 |
| robar visto | desconfianza 2, vigilancia_escena 2, sospecha_crimen 2, reputacion_ciudad −1 |
| robar no visto | vigilancia_escena 1 |
| pedir_prestado | deuda_personal 1 |
| pagar_deuda | quita deuda; gratitud 1 |
| cobrar_favor | consume favor_debido |
| preguntar_clave | pista_conocida +1 (umbral y ranura habilitada), curiosidad 1 |
| examinar | pista_conocida 1 (2 con objeto) |
| escuchar_oculto | pista_conocida 1–2; vigilancia 1 si falla |
| guardar_secreto | secreto_compartido 1, gratitud 1 |
| revelar_secreto | rencor 2, chisme_activo 2 |
| ponerse_de_lado | pacto_caso 1–3, favor_casa_aster/favor_archivo 1 |
| aliarse | alianza_npc 1 |
| viajar_camino | alerta_camino 1 (noche o fama ≥ 2) |
| escoltar_caravana | lealtad_caravana 1–2 |
| comerciar_justo | reputacion_ciudad +1 |

- Tenso/peligroso: amenazar da miedo 3. Social: chisme +1.
- Combinación: mayor gana; igual +1 (máx 3); menor reinicia decaimiento. Rencor nuevo baja gratitud 1. Traición baja gratitud grave a medio.
- Relación: gratitud +5×n, rencor −8×n, desconfianza −4×n, miedo −3×n, reparación +15.

## 7. Decaimiento

| Tag | Leve | Medio | Grave |
|---|---|---|---|
| desconfianza | 2 hitos | 4 hitos | reparación |
| rencor | 3 hitos | reparación | reparación explícita |
| gratitud | 3 hitos | 6 hitos | traición |
| miedo | 6 h | 24 h | reparación |
| curiosidad | 4 hitos | 4 hitos | respuesta |
| deuda_personal | +1 nivel/4 hitos | ídem | NPC no colabora |
| favor_debido | 6 hitos | ídem | ídem |
| secreto_compartido | no | — | — |
| reputacion_ciudad | 1 paso/24 h | — | — |
| fama_violenta | −1/12 h | — | — |
| vigilancia_escena | 3 h | 6 h | 12 h |
| chisme_activo | 6 h | — | — |
| pista_conocida | no | — | — |
| lealtad_caravana | 8 hitos | — | — |
| alerta_camino | 6 h | — | — |
| sospecha_crimen, favor_casa_aster, favor_archivo, pacto_caso, alianza_npc | cierre de caso | — | — |

Reparación: quita un tag medio/grave (rencor/desconfianza/miedo) del NPC y baja el resto 1. contadorHitos es global.

## 8. Texto

1. Candidatos = 4 textos − textosUsados.
2. Menor uso del jugador; empate por semilla.
3. Registrar.

Bloque: hito + reacción + gancho. Marcadores `{npc:pN}` (dueño del conocimiento de pN), `{conocimiento:pN}`.

Reacción: aprobada → genérica de la familia del tag. Familias (2 textos c/u): confianza, rencor, miedo, curiosidad, deuda-favor, reputación. Groq genera candidatas fuera del turno; nunca narra sin aprobación manual.

## 9. Desenlaces

Al final o abandono: candidatos con requiere → mayor prioridad → mayor coincidencia → neutro default. Negativos solo por condición del jugador. efectos_post sin tags de cierre. Mínimo: 1 positivo, 1 neutro default.

## 10. Validación

Error si: hitos ≠ 8; textos ≠ 4; id de texto duplicado; sin neutro default; sin reparación; final inalcanzable en alguna instancia; < 4 firmas; id inexistente; marcador inválido; tag fuera de los 20; tag en cuerpo del jugador; efectos_post con tag de cierre.

## 11. Cambios

| # | Ruta | Tipo | h |
|---|---|---|---|
| 1 | persistencia.js | Code | 7 |
| 2 | tags.js | Code | 6 |
| 3 | decaimiento.js | Code | 5 |
| 4 | acciones.js | Code | 6 |
| 5 | hitos.js | Code | 9 |
| 6 | instancias.js | Code | 8 |
| 7 | seleccion.js | Code | 4 |
| 8 | textos.js | Code | 3 |
| 9 | desenlaces.js | Code | 5 |
| 10 | validador.js | Code | 6 |
| 11 | hitos.js, narrador/ganchos.js | Code | 4 |
| 12 | narrar.js | Code | 5 |
| 13 | *.test.js | Code | 8 |
| 14 | narrador/sim/jugadores.js | Code | 6 |
| 15 | narrador/sim/runner.js, metricas.js | Code | 7 |
| 16 | 12 plantillas de caso | Sonnet | 18 |
| 17 | 384 textos de hito | Sonnet | 20 |
| 18 | conocimientos nuevos | Sonnet | 5 |
| 19 | reacciones base | Sonnet | 10 |
| 19b | reacciones genéricas: 12 textos | Sonnet | 2 |
| 20 | revisión 16–19 | Tomás | 14 |

Code 94 · Sonnet 55 · Revisión 14 · Total 163.

Cambios: §8 cascada aprobada → genérica; recorte de redacción en §1, §2, §5.
