# Auditoría del motor de caso v1

Auditado: `docs/motor-caso-v1-operativo.md` (y `docs/motor-caso-v1.md` donde el operativo no alcanza) contra `narrador/` y `data/contenido/contenido-v3.json` (v3.1). No se modificó código ni contenido. Suite al auditar: 1185 pruebas en verde.

Gravedad: **A** impide implementar o deja partidas sin salida · **B** obliga a cambiar un módulo existente o una regla · **C** imprecisión que hay que fijar antes de escribir casos.

## 1. Hallazgos por gravedad

### A

**A1. El estado del caso no sobrevive a un turno.** `narrar` vuelve a pasar el estado por `cargarPartida` (`narrador/index.js:278`) y `conValoresPorDefecto` copia solo una lista fija de campos (`narrador/index.js:113-146`). Tags, hitos, instancia y `contadorHitos` se pierden en cada turno si viajan en el estado. Además el contrato dice que el narrador recibe y devuelve el estado sin guardar nada (`narrador/index.js:1-8`), y el operativo §2 pide una transacción de IndexedDB por turno dentro del motor.

**A2. 11 de las 20 acciones de §6 no tienen forma de entrar.** La comprensión solo reconoce las 24 intenciones del contenido (`narrador/comprension.js:164`, `:670`). Sin intención ni verbo: regalar_objeto, mentir, robar, pedir_prestado, pagar_deuda, cobrar_favor, guardar_secreto, revelar_secreto, ponerse_de_lado, aliarse, escoltar_caravana. El supuesto de la referencia §5.1 ("el parser actual clasifica la entrada en estos tipos") es falso. Los tags que solo salen de esas acciones no se pueden escribir nunca: deuda_personal, secreto_compartido, pacto_caso, favor_casa_aster, favor_archivo, alianza_npc, lealtad_caravana, y sospecha_crimen nivel 2.

**A3. 5 de los 12 conocimientos tienen compuerta que el operativo no contempla.** Una pista cuyo conocimiento pide evento o marca no sube aunque la ranura esté habilitada (`narrador/conocimientos.js:28-36`):

| Conocimiento | Compuerta |
|---|---|
| conocimiento_ivor_1 | evento_deuda_impaga (azar 0,06, dura 8 turnos) |
| conocimiento_dario_1 | evento_disputa_aduana (azar 0,08, dura 6 turnos) |
| conocimiento_sendero_sin_vigilancia | evento_tormenta_verano (azar 0,04, dura 4 h) |
| conocimiento_elia_1 | marca `leyo` |
| conocimiento_oren_1 | marca `leyo` |

El ejemplo caso_07 usa tres de ellos (elia en p1, ivor en p2, dario en p3). Ver 3.1.

**A4. Atacar bloquea los conocimientos del NPC para siempre.** `bloqueaConocimientos` en atacar y emboscar (`narrador/npcs.js:76-81`, `narrador/conocimientos.js:25`) no tiene vuelta atrás; la reparación del operativo §7 quita tags pero no ese bloqueo. Ver 3.2.

**A5. El conocimiento es binario y de una sola vez; `pista_conocida` tiene niveles.** Una consulta revela y la segunda devuelve `ya_revelado` (`narrador/conocimientos.js:26`, `narrador/turno.js:193-200`). "preguntar_clave: pista_conocida +1" no puede pasar de 1 por preguntas.

**A6. El motor no existe.** 0 de 15 módulos completos (sección 4). No hay `narrador/casos/` ni `narrador/sim/`.

### B

**B1. Hablar revela sin mirar ranuras.** `hablar_con` con éxito revela el primer conocimiento disponible del NPC (`narrador/turno.js:156-162`) y la consulta también (`narrador/turno.js:192-197`). Contradice "ranura habilitada cuando la anterior llega a nivel 1": el jugador obtiene p3 antes que p1.

**B2. La relación se movería dos veces.** `aplicarTransicion` ya suma relación por verbo desde `transiciones` del contenido (`narrador/turno.js:134-135`): ayudar +10, atacar −40. El operativo §6 suma además gratitud +5×n, rencor −8×n, etc. Con los umbrales actuales (30 a 50) el doble conteo cambia cuándo se abre cada pista.

**B3. Groq narra dentro del turno.** Si el código no entiende tras reformular, el texto de Groq se muestra tras `validarSalida` (`narrador/index.js:297-327`). El operativo §8 dice que Groq genera fuera del turno y nunca narra sin aprobación manual.

**B4. La consulta sale del turno antes del reloj y los eventos.** `ejecutarTurno` devuelve en `narrador/turno.js:233` (y saludos en `:236-243`, reformulación en `:244-252`). El ciclo de §5 (tags → reloj → hitos) tiene que correr también ahí, y no hay punto de enganche: preguntar_clave es justamente una consulta.

**B5. Casi ninguna acción gasta horas.** `costoHorasPorVerbo` es 0 salvo ayudar, usar, leer (1), descansar y trabajar (4) y el viaje; el reloj solo avanza por ese costo (`narrador/turno.js:283`). Ver 3.5. Tampoco hay contador de turnos en el estado (`narrador/estado.js:35-45`) para "8 turnos sin listos".

**B6. Los nuevos del ejemplo rompen la validación actual.** `CONTEOS.objetos` es 40 (`narrador/contenido.js:4-11`): agregar objeto_lupa_bronce hace fallar `validarContenido`. CLAUDE.md además prohíbe modificar `contenido-v3.json`, y la fila 18 del operativo §11 lo modifica.

**B7. Anti-traba por "evento de escena" no cabe en `eventos.js`.** Los eventos salen solo del contenido, con disparo `azar`, `hora` o `accion`, efectos `disposicion`, `bloqueo`, `habilita`, `precio` (`narrador/contenido.js:72`) y máximo 2 por escena (`narrador/eventos.js:10`, `:23`). No hay efecto que siembre una pista ni disparo por inactividad.

**B8. `examinar` no apunta a conocimientos.** Exige un objeto (`narrador/comprension.js:30`) y no hay vínculo objeto → conocimiento salvo los 12 narrativos, que revelan con `usar` frente a su NPC (`narrador/turno.js:145-154`). "examinar: pista_conocida 1 (2 con objeto)" necesita dos objetos en una frase y una tabla "objeto adecuado" que no existe.

**B9. Persistencia distinta.** El adaptador existente abre la base `motor_narracion`, versión 1, con un único store `kv` (`persistencia/adaptadores/almacenIndexedDB.js:17-32`). El diseño pide base `avaloria` con 6 stores y claves compuestas. No existe `jugadorId` en ningún módulo de `narrador/`, y tres stores lo usan de clave.

**B10. Textos fuera de `plantillas`.** Los textos de hito y de reacción van a `narrador/contenido/casos/*.json` y `reacciones*.json`. CLAUDE.md y `narrador/index.js:8` dicen que todo texto sale de `plantillas` del contenido.

### C

**C1. `estado_evento` no es el estado propio de la escena.** `estadoDeEscena` sube un nivel si una vecina está peor (`narrador/estadoEscena.js:30-36`). Un hito con `estado_evento: tenso` o el modificador "tenso → miedo 3" se activa por un evento de la escena de al lado. Hay que decir cuál de las dos funciones se usa.

**C2. `escena(pN)` con NPCs que se mueven.** brenn_arriero alterna norte/sur cada 24 h y sarin_mensajera rota tres caminos cada 8 h (`narrador/turno.js:298`, `narrador/movimientoNpcs.js`). El ejemplo de la referencia §11.2 fija a brenn en escena_camino_norte. Falta decir si `escena(pN)` es la inicial o la actual.

**C3. `reputacion_ciudad` contradice el dato Tag.** §2 dice nivel 1–3; §6 escribe −1 y la referencia §5.3 da rango −3 a +3.

**C4. Objetivos sin id.** Facción (Casa Aster, Archivo, caravana), bando y camino no son entidades del contenido. "Casa Aster" aparece solo dentro de nombres y textos. Ciudad sí existe como campo de escena (Ardenhall, Lareth, Halenor; `null` en caminos y lugares).

**C5. Sin definir:** "umbral" de precio de regalar_objeto, "traición", "respuesta" (decaimiento de curiosidad grave), "mentir detectado", "robar visto", nombres de nivel (vista / entendida), "vigilancia" a secas en escuchar_oculto.

**C6. `hora` relativa.** El reloj es `{ dia, hora }`; `hora >= hitoPrevio.hora + 6` necesita horas absolutas (`minutosAbsolutos` en `narrador/reloj.js:19`), y el rango 18–24 cruza de día.

**C7. `fake-indexeddb`** (referencia §13, fila 15) no está instalado; `package.json` no tiene dependencias.

**C8. conocimiento_sello_doble en maren_archivista con umbral 0.** Pasa a ser lo primero que Maren cuenta al hablarle (`narrador/turno.js:156-162`), sin que el caso esté activo.

## 2. Ids

Ids de mundo mencionados en los dos documentos: 12 escenas, 12 NPCs, 8 conocimientos. **Todos existen** en `contenido-v3.json`, con el dueño que los documentos indican (conocimiento_sendero_sin_vigilancia es de hollis_pastor). Faltan solo los dos marcados como nuevos: conocimiento_sello_doble, objeto_lupa_bronce.

No son ids de mundo y no existen en el contenido ni están marcados como nuevos:

| Tipo | Faltantes |
|---|---|
| Acciones sin intención (11) | regalar_objeto, mentir, robar, pedir_prestado, pagar_deuda, cobrar_favor, guardar_secreto, revelar_secreto, ponerse_de_lado, aliarse, escoltar_caravana |
| Acciones con equivalente aproximado (9) | hablar_amable ≈ intencion_hablar_con · ayudar = intencion_ayudar · amenazar ≈ intencion_presionar · atacar = intencion_atacar · preguntar_clave ≈ consulta (sin intención) · examinar = intencion_examinar · escuchar_oculto ≈ intencion_ocultarse / intencion_observar · viajar_camino ≈ intencion_viajar · comerciar_justo ≈ intencion_comprar / intencion_negociar |
| Tags (20) | Ninguno existe en contenido ni en `docs/vocabulario-v1.md`: desconfianza, rencor, gratitud, miedo, curiosidad, deuda_personal, favor_debido, secreto_compartido, reputacion_ciudad, fama_violenta, vigilancia_escena, chisme_activo, pista_conocida, lealtad_caravana, alerta_camino, sospecha_crimen, favor_casa_aster, favor_archivo, pacto_caso, alianza_npc |
| Objetivos | facción, bando (C4) |
| Casos y textos | caso_01, caso_03, caso_07, caso_12, d_caso_07_1, c07_h2_t1..t4: no hay archivo de casos |

Intenciones del contenido sin fila en §6 (no escriben tags): usar, explorar, descansar, observar, trabajar, leer, retirarse, huir, emboscar, calmar, avanzar_cautela, distraer, abortar, defender, rendirse. `emboscar` bloquea conocimientos igual que atacar y no escribe rencor ni miedo.

## 3. Reglas incompatibles o hitos sin disparo (5)

1. **Pista con compuerta de evento o marca (A3).** Ranura habilitada + conocimiento que pide un evento de azar: el hito que exige esa pista no se dispara hasta que el azar quiera. *Corrección: el validador rechaza como candidato de ranura todo conocimiento con `requiereEvento` o `requiereMarca`, o la pista del caso ignora esas compuertas.*
2. **Atacar y reparar (A4).** La reparación quita rencor y miedo, pero el NPC sigue sin contar nada: su pista queda en 0 y el final que la pide es inalcanzable. *Corrección: la reparación también levanta `bloqueadoConocimientos`, o toda pista tiene una vía sin el NPC.*
3. **Una reparación por caso, varios tags que solo se van con reparación.** Rencor medio/grave, desconfianza grave y miedo grave solo bajan por reparación; cada caso tiene un hito de reparación que se dispara una vez y quita un tag de un NPC. Con dos NPCs ofendidos, el segundo queda así para siempre y pasa a los casos siguientes. *Corrección: el hito de reparación es repetible, una vez por NPC.*
4. **`pista_conocida` no decae y se conserva; 12 conocimientos para 72 lugares de ranura (12 casos × 3 × 2).** Cada conocimiento se repite unas 6 veces (3 con los 12 nuevos): los casos posteriores arrancan con ranuras ya en nivel 2, los hitos de pista quedan listos en el primer turno y el orden de ranuras deja de valer. El validador es estático y no puede evitarlo. *Corrección: una ranura nueva hereda como máximo nivel 1.*
5. **Reglas por horas con acciones de 0 horas, y decaimiento por hitos sin hitos (B5).** Gancho a 6 h, reubicación a 12 h, anti-traba a 24 h y `hora >= hitoPrevio.hora + 6` no avanzan mientras el jugador hable, pregunte o examine; en modo libre no hay hitos y gratitud, rencor leve, curiosidad y favor_debido dejan de decaer. *Corrección: esas reglas cuentan turnos, con un contador de turnos en el estado.*

## 4. Módulos de la sección 11

| # | Ruta | Estado | Qué hay hoy |
|---|---|---|---|
| 1 | casos/persistencia.js | existe parcial | `versionContenido` y reconstrucción en `narrador/index.js:148-203`; almacén `kv` en `persistencia/adaptadores/almacenIndexedDB.js`. Ninguno de los stores |
| 2 | casos/tags.js | no existe | Solo relación, disposición y marcas |
| 3 | casos/decaimiento.js | no existe | `narrador/reloj.js` da horas absolutas |
| 4 | casos/acciones.js | no existe | `transiciones` del contenido (verbo → relación) |
| 5 | casos/hitos.js | no existe | — |
| 6 | casos/instancias.js | no existe | — |
| 7 | casos/seleccion.js | no existe | — |
| 8 | casos/textos.js | no existe | `elegirPlantilla` evita aperturas repetidas (`narrador/narracion.js:66`); sin uso por jugador |
| 9 | casos/desenlaces.js | no existe | — |
| 10 | casos/validador.js | no existe | `narrador/contenido.js` valida ids del mundo; nada de casos |
| 11 | casos/hitos.js, ganchos.js | no existe | — |
| 12 | casos/narrar.js | existe parcial | Cascada en `narrador/index.js:253-394`, con Groq dentro del turno (B3) |
| 13 | casos/*.test.js | no existe | — |
| 14 | sim/jugadores.js | no existe | — |
| 15 | sim/runner.js, metricas.js | no existe | — |

Completos: 0. Parciales: 2. No existen: 13.

## 5. Veredicto

Apto para escribir casos: no. Motivo: 11 de las 20 acciones y 7 de los 20 tags no se pueden producir con la comprensión actual, 5 de los 12 conocimientos tienen compuertas que dejan hitos sin disparo, y falta decidir las cinco correcciones de la sección 3; un caso escrito hoy usaría condiciones que después cambian.
