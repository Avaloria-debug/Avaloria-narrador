# Motor de Caso v1 — Operativo

## 1. Módulos

`narrador/casos/*.js`; pruebas `*.test.js` (node --test). Lote: `narrador/sim/runner.js`, fuera de npm test.

## 2. Datos

- **Caso**: id, tono, escenas_origen, ranuras_pista[3], bandos, hitos[8], ramas, desenlaces.
- **Ranura**: id p1–p3, conocimientos_validos (2). El NPC de la pista es el dueño del conocimiento en contenido-v3.json.
- **Instancia**: casoId, firma, pistas[{ranura, conocimientoId, npcId (dueño), orden}], semilla. Firma = conjunto de conocimientos por ranura, sin orden. 8 firmas por caso (2 × 2 × 2).
- **Hito**: id, condiciones, escena_entrega (escena | escena(pN) | null), escena_alternativa (opcional), textos[4], efectos, es_reparacion, repara_rencor_grave, npc_reparacion, bloquea, final.
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

## 2b. Esquema de condiciones

Fuente de verdad de `narrador/casos/hitos.js`. Un hito se cumple si se cumplen todas las condiciones que trae; las que faltan no cuentan. La escena de entrega no es condición.

Hito de ejemplo:

```json
{
  "id": "h4",
  "condiciones": {
    "requiere_hitos": { "todos": ["h1"], "alguno": ["h2", "h3"] },
    "tags": [
      { "tipo": "pista_conocida", "objetivo": "p1", "op": ">=", "nivel": 2 },
      { "tipo": "desconfianza", "objetivo": "npc(p2)", "op": "<", "nivel": 2 },
      { "tipo": "rencor", "objetivo": "npc(p1)", "op": "ausente" }
    ],
    "escena": { "en": ["escena_archivo_real", "escena(p2)"], "no_en": ["escena_puente_aduana"] },
    "hora": { "rango": [18, 24], "desde_previo": 6 },
    "contador": { "desde_previo": 1 },
    "estado_evento": ["sigilo", "tenso"],
    "pistas": { "cantidad": 2, "nivel": 2, "habilitada": "p3" }
  },
  "escena_entrega": "escena(p2)",
  "efectos": [
    { "tipo": "gratitud", "objetivo": "npc(p1)", "nivel": 1 },
    { "tipo": "pista_conocida", "objetivo": "p3", "op": "subir" }
  ],
  "es_reparacion": false,
  "repara_rencor_grave": false,
  "bloquea": ["h5"],
  "final": false
}
```

| Condición | Forma | Se cumple si |
|---|---|---|
| requiere_hitos | lista (= todos) o `{todos, alguno}` | todos alcanzados y, si hay `alguno`, al menos uno |
| tags | `{tipo, objetivo, op, nivel}` | nivel del tag `>=`, `<` o `==` al nivel dado; `ausente`: no hay tag (sin `nivel`) |
| escena | id, lista o `{en, no_en}` | el jugador está en una de `en` y en ninguna de `no_en` |
| hora.rango | `[desde, hasta]` | hora del día: desde ≤ h < hasta; `[22, 4]` cruza la medianoche |
| hora.desde_previo | n | hora del reloj ≥ hitoPrevio.hora + n |
| contador.desde_previo | n | contadorHitos ≥ hitoPrevio.contador + n |
| estado_evento | id o lista | el estado de la escena es uno de esos |
| pistas.cantidad, nivel | n, nivel (por defecto 2) | n ranuras con pista_conocida ≥ nivel |
| pistas.habilitada | ranura o lista | la ranura está habilitada según el orden de la instancia |

Objetivos y escenas: `p1` = conocimiento de la ranura; `npc(p1)` = su dueño; `escena(p1)` = escena donde está el dueño; `escena` = escena del jugador; otro texto = id literal.

Efectos: `{tipo, objetivo, nivel}` escribe el tag; `op` puede ser `subir` (+1), `quitar` o `reputacion` (con `paso`).

Estado del caso (lo que hitos.js lee y escribe):

| Campo | Forma | Lee | Escribe |
|---|---|---|---|
| casoId | id | sí | — |
| instancia | `{pistas: [{ranura, conocimientoId, npcId, orden}]}` | sí | — |
| tags | Tag[] | sí | disparo, anti-traba 24 h |
| contadorHitos | número | sí | disparo |
| hitoPrevio | `{id, hora, escena, contador}`; `id` null si es la instanciación | sí | disparo |
| hitosAlcanzados | id[] | sí | disparo |
| hitosListos | id[] | sí | listos, disparo |
| listosDesde | `{hitoId: hora}` | sí | listos, disparo |
| hitosBloqueados | id[] | sí | disparo |
| entregasMovidas | `{hitoId: escena}` | sí | gancho, disparo |
| reparados | npcId[] | sí | disparo |
| progresoReparacion | `{npcId: escena[]}` | sí | disparo de un hito de reparación; traición lo borra |
| umbralesBajados | hitoId[] | sí | anti-traba 8 turnos, disparo |
| reparacionHabilitada | hitoId[] | sí | anti-traba rencor grave, disparo |
| sinListosDesde | turno o null | sí | listos, disparo, anti-traba 8 turnos |
| ultimoAvance | `{hora}` | sí | disparo, anti-traba 24 h |
| turnoUltimoDisparo | turno o null | sí | disparo |
| finalAlcanzado | hitoId | — | disparo de un hito final |
| abandonoHabilitado | bool | sí | anti-traba finales bloqueados |

Estado del mundo (solo lectura, salvo `npcs` en el disparo): `{caso, hora, turno, escena, estadoEvento, npcs: {id: {escena, relacion, bloqueadoConocimientos}}, distancia(a, b)}`. `hora` es la hora total del reloj; `caso` es la plantilla con sus hitos.

Escena alternativa y reparación (campos del hito que no están en el ejemplo):

| Campo | Forma | Regla |
|---|---|---|
| escena_alternativa | escena o `escena(pN)`; opcional, una sola | El hito se entrega en escena_entrega o en escena_alternativa; hitos.js acepta cualquiera de las dos desde que el hito está listo. Solo con escena_entrega no nula y distinta de ella. |
| npc_reparacion | `npc(pN)` o id de NPC; obligatorio si es_reparacion | NPC dueño de los tags que el hito repara. El hito solo toca tags cuyo objetivo es ese NPC, nunca los de otro. |

- Validador: en cada instancia válida, al menos una de las dos escenas (escena_entrega, escena_alternativa) es alcanzable desde alguna escena de origen del caso. Si no, error.
- Hito de reparación = hito con es_reparacion y sin repara_rencor_grave. Al dispararse suma su escena a `progresoReparacion[npc]` si no estaba. Ninguna acción de rutina cuenta como hito de reparación.
- Reparación explícita = hito con repara_rencor_grave. Es la única que quita un rencor grave, y solo el del NPC de npc_reparacion. Se cumple si se cumplen las tres, además de sus condiciones:
  1. `progresoReparacion[npc]` tiene al menos 2 escenas distintas (2 hitos de reparación previos sobre ese NPC, cada uno en otra escena).
  2. Relación con el NPC ≥ 15 (`RELACION_MINIMA_REPARACION`).
  3. gratitud ≥ 2 (medio o grave) sobre ese NPC.
- Traición a ese NPC (acción que escribe traición o rencor sobre él): `progresoReparacion[npc]` se borra y hay que empezar de nuevo.
- `progresoReparacion` es por NPC y sigue entre casos en secuencia.

## 3. Elección de caso

1. Pool = 12 − casosJugados.
2. Pesos: tono = último ×0.3; = dos anteriores ×0.6; ×1/(1+partidas jugadas); escena inicial en origen ×1.2.
3. Sorteo con semilla.

Secuencia: siguen reloj, contadorHitos, relaciones, textosUsados, efectos_post, tags con decaimiento propio. Se borran cierres de caso y ranuras (qué conocimiento ocupaba p1–p3). pista_conocida se conserva con su nivel; si coincide con una ranura nueva, la ranura arranca con ese nivel, con máximo nivel 1. hitoPrevio = null. Arranque al entrar a escenas_origen o a las 6 h de reloj con gancho. Pool agotado → modo libre.

## 4. Instanciación

1. Candidatos: 2 conocimientos por ranura, sin dueño ni conocimiento repetido. Un conocimiento con `requiereEvento` o `requiereMarca` puede ser pista. Si al preguntarlo su condición no se cumple, el NPC responde `no_se` y la pista queda pendiente: se revela al preguntar con la condición cumplida.
2. Excluir en p1 conocimiento cuyo dueño tenga rencor grave.
3. Firma no jugada por el jugador; si no hay, menos usos (empate: más vieja).
4. Orden: permutación válida menos usada.
5. Guardar y sumar uso.

## 5. Hitos

Condiciones (esquema en §2b): requiere_hitos, tags (por ranura), escena, hora (rango o relativa a hitoPrevio, en horas del reloj), contador (relativo a hitoPrevio), estado_evento, pistas.

hitoPrevio = último hito disparado del caso activo (id, hora, escena, contador); sin hitos, el momento de instanciación.

Ranura habilitada cuando la anterior en el orden llega a nivel 1.

Ciclo por turno:
1. Acción → tags.
2. Reloj → decaimiento por horas.
3. Condición cumplida → hitosListos.
4. Disparar si el jugador está en escena_entrega o en escena_alternativa (escena_entrega null = cualquiera).
5. Prioridad: reparación > bloquea ramas > menor id. Máx. 1 por turno.
6. Al disparar: contadorHitos+1, hitoPrevio, efectos, bloqueos, decaimiento por hitos, texto.

Fuera de escena: gancho hacia escena_entrega; a las 12 h de reloj, si el hito tiene escena_alternativa, el gancho pasa a nombrarla. Sin escena_alternativa la entrega no se mueve.

Reparación: un hito con es_reparacion va sobre su npc_reparacion. El de repara_rencor_grave no queda listo sin las tres condiciones de §2b.

Anti-traba: 8 turnos sin listos → bajar umbral; rencor grave → habilitar los hitos de reparación de ese NPC sin otras condiciones (las tres de la reparación explícita no se saltean); 24 h sin avance → pista nivel 1; finales bloqueados → neutro por abandono.

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

Unidades: el decaimiento por horas, las 24 h de anti-traba, las 6 h de arranque y las 12 h de entrega fuera de escena usan el reloj del mundo y se evalúan solo cuando el reloj avanza; las acciones de 0 horas no los mueven. Hitos y ramas van por turnos o por condición.

Reparación: solo con el NPC dueño del tag (npc_reparacion), nunca con otro. Un hito de reparación quita un tag medio/grave (rencor medio, desconfianza, miedo) de ese NPC, baja el resto 1 y levanta `bloqueadoConocimientos`. Es repetible: cuenta una vez por (NPC, escena). El rencor grave solo sale con la reparación explícita y sus tres condiciones (§2b: 2 hitos de reparación en escenas distintas, relación ≥ 15, gratitud ≥ 2). Una traición a ese NPC borra el progreso. contadorHitos es global; sin caso activo (modo libre), el decaimiento por hitos cuenta turnos: 1 hito = 8 turnos. Los turnos salen de contadorTurnos, en el estado.

## 8. Texto

1. Candidatos = 4 textos − textosUsados.
2. Menor uso del jugador; empate por semilla.
3. Registrar.

Bloque: hito + reacción + gancho. Marcadores `{npc:pN}` (dueño del conocimiento de pN), `{conocimiento:pN}`.

Reacción: aprobada → genérica de la familia del tag. Familias (2 textos c/u): confianza, rencor, miedo, curiosidad, deuda-favor, reputación. Groq genera candidatas fuera del turno; nunca narra sin aprobación manual.

## 9. Desenlaces

Al final o abandono: candidatos con requiere → mayor prioridad → mayor coincidencia → neutro default. Negativos solo por condición del jugador. efectos_post sin tags de cierre. Mínimo: 1 positivo, 1 neutro default.

## 10. Validación

Error si: hitos ≠ 8; textos ≠ 4; id de texto duplicado; sin neutro default; sin reparación; reparación sin npc_reparacion; ni escena_entrega ni escena_alternativa alcanzable desde el origen; final inalcanzable en alguna instancia; < 4 firmas; id inexistente; marcador inválido; tag fuera de los 20; tag en cuerpo del jugador; efectos_post con tag de cierre.

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
