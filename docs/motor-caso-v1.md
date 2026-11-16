# Motor de Caso v1

## 1. Alcance

- Capa sobre el mundo fijo: 12 escenas, 12 NPCs, 40 objetos (`data/contenido/contenido-v3.json`), conocimientos, eventos de escena y reloj del mundo.
- Por partida: elige un caso, lo instancia, lo avanza por 8 hitos disparados por estado, escribe tags por acción, decae tags, elige desenlace, rota textos y, si la partida sigue, elige el caso siguiente.
- No modifica lore, historia pasada, escenas, NPCs ni objetos existentes.
- Implementación: JavaScript con módulos ES en `narrador/casos/`, pruebas con `node --test`.
- Groq solo actúa dentro del narrador (sección 7.3). Nunca escribe hechos ni tags.
- Los jugadores simulados usan Haiku (sección 10).

### 1.1 Mundo de referencia

| Tipo | Ids |
|---|---|
| Ardenhall | escena_mercado_circular, escena_archivo_real |
| Lareth | escena_plaza_cambistas, escena_taberna_lareth |
| Halenor | escena_biblioteca_publica, escena_aula_cartografia |
| Caminos | escena_camino_norte, escena_camino_este, escena_camino_sur |
| Lugares de camino | escena_lago_espejos, escena_puente_aduana, escena_cruce_colinas |
| NPCs | serel_panadero, maren_archivista, ivor_cambista, naela_tabernera, tiren_docente, elia_bibliotecaria, brenn_arriero, ysolde_pescadora, dario_guardia, sarin_mensajera, hollis_pastor, oren_peregrino |
| Conocimientos | conocimiento_<nombrePila>_1 (p. ej. conocimiento_maren_1), conocimiento_sendero_sin_vigilancia |
| Objetos | objeto_* en data/contenido/contenido-v3.json |

## 2. Modelo de datos

### 2.1 Caso (plantilla)

| Campo | Tipo | Descripción |
|---|---|---|
| id | string | `caso_01` … `caso_12` |
| tono | enum | intriga, calido, misterio, tension, humor, melancolia |
| escenas_origen | string[] | Escenas donde puede arrancar |
| ranuras_pista | Ranura[] | Huecos de pista que se llenan al instanciar (2.2) |
| bandos | string[] | 1–3 valores posibles de pacto_caso |
| hitos | Hito[] | Exactamente 8 |
| ramas | Rama[] | Caminos alternativos entre hitos |
| desenlaces | Desenlace[] | ≥1 neutro o positivo |
| instancias_minimas | number | ≥ 4 (sección 3.3) |

### 2.2 Ranura de pista

| Campo | Descripción |
|---|---|
| id | `p1`, `p2`, `p3` |
| conocimientos_validos | 2 conocimientos que pueden hacer de esta pista (existentes o nuevos aprobados) |
| escenas_validas | Derivadas del NPC dueño del conocimiento elegido |

Cada conocimiento tiene un único NPC dueño según contenido-v3.json. El NPC que da la pista es ese dueño.

Los hitos no nombran conocimientos ni NPCs concretos: nombran ranuras (`pista:p1 >= 2`, `npc:p1`). La instancia las resuelve.

### 2.3 Instancia

```
{ casoId, firma, pistas: [ {ranura, conocimientoId, npcId, orden} ], semilla }
```

- `npcId`: dueño del conocimiento; no se elige.
- `firma`: cadena canónica de los conocimientos ordenados por ranura (el NPC queda determinado por el conocimiento). El orden de aparición no entra en la firma.
- `orden`: secuencia en que las ranuras se habilitan (ver 4.1, bloque `pistas`).

### 2.4 Hito

| Campo | Tipo | Descripción |
|---|---|---|
| id | string | `h1` … `h8` |
| condiciones | Condicion | Sección 4 |
| escena_entrega | string \| ranura \| null | Escena fija, escena del dueño del conocimiento de una ranura, o cualquiera |
| textos | Texto[4] | `{id, texto, tono}` |
| efectos | EfectoTag[] | Tags que escribe al dispararse |
| es_reparacion | bool | Puede quitar rencor/desconfianza/miedo medio o grave |
| repara_rencor_grave | bool | Reparación explícita del caso |
| bloquea | string[] | Hitos que quedan inaccesibles |
| final | bool | Habilita evaluación de desenlace |

### 2.5 Tag en estado

```
{ tipo: "rencor", objetivo: "maren_archivista", nivel: 2,
  creadoHora: 34, creadoHito: 3, casoId: "caso_07", origen: "accion:amenazar" }
```

- nivel: 1 leve, 2 medio, 3 grave. En pista_conocida: 1 vista, 2 entendida, 3 confirmada.
- Único por `(tipo, objetivo)`. Escribir uno existente aplica combinación (5.3).

### 2.6 Estado en IndexedDB

Base `avaloria`, una versión de esquema por cambio de stores. Cada registro guarda `versionContenido` (la de `data/contenido/contenido-v3.json`); al cargar una partida con versión distinta se corre la migración del contenido o se marca la partida como incompatible.

| Store | Clave | Contenido |
|---|---|---|
| partidas | partidaId | jugadorId, versionContenido, reloj, escenaActual, inventario, relaciones |
| estado_caso | partidaId | casoActivo, instanciaActiva, casosJugados, hitosAlcanzados `{id, hora, escena, contador}`, hitosListos, hitosBloqueados, contadorHitos, hitoPrevio, tags, textosUsados |
| historial_instancias | [jugadorId, casoId, firma] | usos, ultimaPartida, ultimaFecha |
| uso_textos | [jugadorId, textoId] | usos |
| historial_tonos | jugadorId | últimos 3 tonos jugados |
| reacciones_aprobadas | id | npcId, tipoTag, nivel, texto, origen (manual / groq), estado (candidata / aprobada), versionContenido |

- Se escribe en una transacción por turno (estado_caso + partidas). Fallo de transacción = turno no aplicado.
- historial_instancias y uso_textos son por jugador, no por partida: sobreviven entre partidas.

## 3. Elección e instanciación del caso

### 3.1 Elección al crear la partida

1. Pool = 12 casos − casosJugados (de esta partida).
2. Peso base 1.0.
3. Tono igual al último jugado (historial_tonos) → × 0.3; igual a alguno de los dos anteriores → × 0.6.
4. Casos jugados entre partidas → × 1 / (1 + partidas en que se jugó). Repetir es válido: la instancia cambia (3.3).
5. Escena inicial del jugador dentro de escenas_origen → × 1.2.
6. Sorteo ponderado con semilla de partida (reproducible).

### 3.2 Casos en secuencia

Al cerrar un caso (desenlace elegido), si la partida sigue:

| Elemento | Qué pasa |
|---|---|
| Elección | Mismo algoritmo 3.1, con el caso cerrado agregado a casosJugados y su tono al historial |
| Reloj | Continúa. No se reinicia. |
| Escena | El jugador queda donde estaba. El caso nuevo arranca cuando el jugador entra a una de sus escenas_origen o, a los 6 turnos, con un gancho en la escena actual |
| contadorHitos | Continúa (es global de la partida, alimenta decaimiento por hitos) |
| hitoPrevio | Se reinicia a null para el caso nuevo |
| hitosAlcanzados, hitosListos, hitosBloqueados | Se archivan con el casoId y se vacían |
| textosUsados | Se conservan (garantiza no repetición en toda la partida) |
| Tags con "cierre de caso" | Se borran: sospecha_crimen, favor_casa_aster, favor_archivo, pacto_caso, alianza_npc |
| Tags de efectos_post | Sobreviven con el nivel que fija el desenlace |
| Resto de tags | Siguen con su decaimiento normal |
| Ranuras | Se borran: qué conocimiento ocupaba p1, p2 y p3 en la instancia anterior |
| pista_conocida | Se conserva con su nivel. Si un pista_conocida coincide con una ranura de la instancia nueva, esa ranura arranca con ese nivel, con máximo nivel 1 |
| Relaciones numéricas | Continúan |

Límite: sin límite de casos por partida; el pool no se repite dentro de la partida. Si se agota (12 casos), la partida pasa a modo libre sin caso.

### 3.3 Instanciación

Al elegir un caso:

1. Generar candidatos: producto de los 2 conocimientos de cada ranura (8 firmas), descartando combinaciones donde un mismo dueño dé más de una pista o un mismo conocimiento llene dos ranuras. Un conocimiento con `requiereEvento` o `requiereMarca` puede ser pista. Si al preguntarlo su condición no se cumple, el NPC responde `no_se` y la pista queda pendiente: se revela al preguntar con la condición cumplida.
2. Filtrar por coherencia del estado: descartar en p1 un conocimiento cuyo dueño tenga rencor grave activo hacia el jugador (evita traba en el arranque).
3. Leer historial_instancias del jugador para el caso.
4. Candidatos no jugados = candidatos cuya firma no está en el historial.
5. Si hay no jugados: sorteo con semilla entre ellos.
6. Si no hay: elegir la firma de menor usos; empate → la de ultimaFecha más vieja.
7. Orden de pistas: permutación de ranuras permitida por el grafo de hitos (p1 siempre primera si h1 depende de ella); se elige la permutación menos usada para esa firma.
8. Guardar instancia en estado_caso y sumar uso en historial_instancias.

### 3.4 Mínimo de instancias

| Regla | Valor |
|---|---|
| Instancias distintas mínimas por caso | 4 |
| Ranuras por caso | 3 |
| Opciones por ranura | 2 conocimientos (2 × 2 × 2 = 8 firmas) |
| Validación | El validador cuenta firmas válidas; < 4 = error de contenido |

## 4. Disparo de hitos por estado

### 4.1 Condición

| Bloque | Ejemplos | Operadores |
|---|---|---|
| requiere_hitos | h2 o h3 | todos / alguno |
| tags | `pista_conocida:p1 >= 2`, `desconfianza:npc(p2) < 2` | >=, <, ==, ausente |
| escena | escena_archivo_real, grupo caminos, `escena(p2)` | en / no en |
| hora | rango 18–24 | rango |
| turnos | `turno >= hitoPrevio.turno + 6` | relativo a hitoPrevio |
| estado_evento | sigilo, tenso | en |
| pistas | n ranuras en nivel ≥ entendida; ranura habilitada según orden de la instancia | conteo, habilitada |

**hitoPrevio**: el último hito disparado en la partida dentro del caso activo, con su hora del reloj del mundo, su escena, su turno (contadorTurnos, en el estado) y el valor de contadorHitos en ese momento. Si no hay hito disparado en el caso activo, vale el momento de instanciación (hora y escena en que arrancó el caso). Las condiciones relativas (`turno >= hitoPrevio.turno + 6`, `contadorHitos >= hitoPrevio.contador + 2`) se calculan contra ese registro.

- No hay orden fijo de hitos. h5 puede ocurrir antes que h4 si su condición no depende de él.
- Estructura mínima por caso: h1 entrada, 5 intermedios, ≥1 reparación, ≥1 final. Algunos casos tienen 2 finales alternativos.
- Una ranura está habilitada cuando la ranura anterior en el orden de la instancia llegó a nivel 1 (vista). Antes de eso, su conocimiento no sube por preguntas del caso.

### 4.2 Ciclo por turno

1. Aplicar acción → escribir tags.
2. Avanzar reloj → decaimiento por horas.
3. Para cada hito no alcanzado ni bloqueado: evaluar condición sin escena_entrega. Si cumple → hitosListos.
4. Si el jugador está en la escena_entrega (o es null) de un hito listo → se dispara.
5. Varios listos en la misma escena: prioridad (a) reparación si hay tags medio/grave pendientes, (b) el que bloquea ramas, (c) menor id.
6. Máximo 1 hito disparado por turno.
7. Al disparar: contadorHitos += 1, hitoPrevio = este hito, efectos, bloqueos, decaimiento por hitos, elección de texto.

### 4.3 Hito listo fuera de escena

- Queda en hitosListos.
- El narrador agrega un gancho en la escena actual (rumor, NPC que menciona algo, chisme_activo en la escena de entrega). El gancho sale de la tabla de reacciones, no de los textos de hito.
- Si pasan 12 turnos sin entregarse y el hito admite escena alternativa, se mueve a la escena del NPC de ranura más cercano.

### 4.4 Anti-traba

| Situación | Respuesta |
|---|---|
| 0 hitos listos durante 8 turnos | Baja un umbral de pista del siguiente hito alcanzable (vista en lugar de entendida) |
| Hito requiere NPC con rencor grave | Se habilita su hito de reparación sin otras condiciones |
| 24 horas de reloj sin avance | Evento de escena que siembra pista_conocida nivel 1 de la siguiente ranura habilitada |
| Todos los finales bloqueados | Se habilita el desenlace neutro por abandono |

## 5. Escritura de tags por acción

### 5.1 Tipos de acción

SUPUESTO: el parser actual del narrador clasifica la entrada en estos tipos por código; lo no clasificable pasa por la cascada del narrador (7.3), no por un paso de Groq propio del parser.

| Acción | Tags (nivel) | Objetivo |
|---|---|---|
| hablar_amable | curiosidad (1) | NPC |
| ayudar | gratitud (1–2), favor_debido (1) | NPC |
| regalar_objeto | gratitud (1; 2 si precio ≥ umbral) | NPC |
| mentir (detectado) | desconfianza (1; 2 si reincide) | NPC |
| mentir (no detectado) | — | — |
| amenazar | miedo (2), rencor (1), chisme_activo (1) | NPC, escena |
| atacar | miedo (3), rencor (2), fama_violenta (2), vigilancia_escena (2), sospecha_crimen (1) | NPC, jugador, escena |
| robar (visto) | desconfianza (2), vigilancia_escena (2), sospecha_crimen (2), reputacion_ciudad (−1) | NPC, escena, jugador, ciudad |
| robar (no visto) | vigilancia_escena (1) | escena |
| pedir_prestado | deuda_personal (1) | NPC |
| pagar_deuda | quita deuda_personal; gratitud (1) | NPC |
| cobrar_favor | consume favor_debido | NPC |
| preguntar_clave | pista_conocida +1 si supera umbral y la ranura está habilitada; curiosidad (1) | conocimiento, NPC |
| examinar | pista_conocida (1; 2 con objeto adecuado) | conocimiento |
| escuchar_oculto | pista_conocida (1–2); vigilancia_escena (1) si falla sigilo | conocimiento, escena |
| guardar_secreto | secreto_compartido (1), gratitud (1) | NPC |
| revelar_secreto | rencor (2) al dueño; chisme_activo (2) | NPC, escena |
| ponerse_de_lado | pacto_caso (1–3), favor_casa_aster o favor_archivo (1) | bando, facción |
| aliarse | alianza_npc (1) | NPC |
| viajar_camino | alerta_camino (1) si es de noche o fama_violenta ≥ 2 | camino |
| escoltar_caravana | lealtad_caravana (1–2) | facción |
| comerciar_justo | reputacion_ciudad (+1) | ciudad |
| esperar | — | — |

- Una acción escribe todos los tags de su fila; una entrada puede componerse de dos acciones.
- Estado de evento: en tenso o peligroso, amenazar sube miedo a 3; en social, chisme_activo +1; en sigilo, robar no visto es más probable.
- No existe ningún tag con objetivo el cuerpo del jugador.

### 5.2 Relación numérica

| Evento | Relación (−100 a 100) |
|---|---|
| gratitud escrita | +5 × nivel |
| rencor escrito | −8 × nivel |
| desconfianza escrita | −4 × nivel |
| miedo escrito | −3 × nivel |
| reparación | +15 |

### 5.3 Combinación

| Caso | Regla |
|---|---|
| Mismo tag, nivel nuevo > actual | sube al nuevo |
| Mismo tag, mismo nivel | +1 (máx 3) |
| Mismo tag, nivel nuevo < actual | se ignora; reinicia el contador de decaimiento |
| gratitud + rencor mismo NPC | rencor nuevo baja gratitud 1 nivel; gratitud nueva no baja rencor medio/grave |
| traición con gratitud grave | gratitud grave baja a medio |
| reputacion_ciudad | rango −3 a +3 |

## 6. Decaimiento

### 6.1 Relojes

- Horas: reloj del mundo, evaluado solo cuando avanza. Las acciones de 0 horas no mueven el decaimiento por horas ni las 24 h de anti-traba.
- Turnos: contadorTurnos, en el estado. Hitos, ramas, arranque y entrega fuera de escena van por turnos o por condición.
- Hitos: contadorHitos (global de la partida), evaluado al disparar un hito.
- Cierre de caso: al elegir desenlace.
- Reparación: solo un hito con es_reparacion; es repetible, una vez por NPC.

### 6.2 Tabla

| Tag | Leve | Medio | Grave |
|---|---|---|---|
| desconfianza | 2 hitos | 4 hitos | reparación |
| rencor | 3 hitos | reparación | reparación explícita del caso |
| gratitud | 3 hitos | 6 hitos | desgaste por traición |
| miedo | 6 h | 24 h | reparación |
| curiosidad | 4 hitos | 4 hitos | al responder la pregunta |
| deuda_personal | sube 1 nivel cada 4 hitos sin pago | ídem | se mantiene; NPC no colabora |
| favor_debido | se cobra o se pierde a los 6 hitos | ídem | ídem |
| secreto_compartido | no decae | — | — |
| reputacion_ciudad | 1 paso hacia 0 cada 24 h | — | — |
| fama_violenta | baja 1 nivel cada 12 h | — | — |
| vigilancia_escena | 3 h | 6 h | 12 h |
| chisme_activo | 6 h | — | — |
| sospecha_crimen | cierre de caso | — | — |
| pista_conocida | no decae | — | — |
| favor_casa_aster | cierre de caso | — | — |
| favor_archivo | cierre de caso | — | — |
| lealtad_caravana | 8 hitos | — | — |
| pacto_caso | cierre de caso | — | — |
| alianza_npc | cierre de caso | — | — |
| alerta_camino | 6 h | — | — |

- Decaer = quitar el tag, salvo reputacion_ciudad y fama_violenta, que bajan por pasos.
- Ninguna acción de rutina quita rencor, desconfianza o miedo medio/grave.
- Un hito de reparación quita un tag medio/grave de esos tres sobre su NPC objetivo y baja el resto 1 nivel; también levanta `bloqueadoConocimientos` de ese NPC. Rencor grave solo con repara_rencor_grave.
- Los tags decaen por hitos usando contadorHitos global, también a través de casos en secuencia. Sin caso activo (modo libre), el decaimiento por hitos cuenta turnos: 1 hito = 8 turnos.

## 7. Variación de texto

### 7.1 Regla

1. Candidatos = 4 textos del hito − textosUsados (partida).
2. Elegir el de menor usos en uso_textos (por jugador); empate → sorteo con semilla.
3. Registrar en textosUsados y sumar en uso_textos.

Como un caso no se repite dentro de la partida, cada hito se entrega como máximo una vez por partida y siempre hay candidatos.

### 7.2 Composición del bloque narrado

| Parte | Fuente |
|---|---|
| Apertura | Texto de hito |
| Matiz | Reacción del NPC según tags activos (reacciones_aprobadas con estado aprobada) |
| Cierre | Gancho hacia hitos listos |

Los textos de hito pueden incluir marcadores de ranura (`{npc:p1}`, `{conocimiento:p2}`), que se resuelven con la instancia. Así el mismo texto cambia de NPC y de pista entre partidas.

### 7.3 Groq

Groq entra igual que en el resto del narrador, como último paso de la cascada:

| Paso | Qué hace | Toca hechos o tags |
|---|---|---|
| 1. Código | Texto de hito, reacción aprobada o gancho de tabla | No |
| 1b. Genérica | Si el par (NPC, familia de tag) no tiene reacción aprobada ni candidata de Groq aprobada: reacción genérica de la familia | No |
| 3. IA (Groq) | Fuera del turno: redacta candidatas para pares sin reacción aprobada. No narra en el turno | No |

- El motor decide tags, hitos y desenlace antes de llamar al narrador.
- La salida de Groq se valida (no nombra hechos nuevos, no contradice tags, no menciona objetos ausentes, longitud en rango, distancia léxica mínima). Se guarda en reacciones_aprobadas con origen groq y estado candidata.
- Una candidata no se usa hasta aprobación manual. Sin excepción en v1. Groq nunca interviene en la narración sin aprobación manual.

Reacciones genéricas: 6 familias × 2 textos.

| Familia | Tags |
|---|---|
| confianza | desconfianza, gratitud, secreto_compartido, alianza_npc |
| rencor | rencor |
| miedo | miedo |
| curiosidad | curiosidad |
| deuda-favor | deuda_personal, favor_debido |
| reputación | reputacion_ciudad, fama_violenta, chisme_activo |

## 8. Desenlaces

### 8.1 Estructura

| Campo | Descripción |
|---|---|
| id | `d_<caso>_<n>` |
| tipo | positivo, neutro, negativo |
| requiere | Condición sobre estado final (formato 4.1) |
| prioridad | entero |
| efectos_post | Tags que sobreviven al caso con su nivel (p. ej. gratitud:npc(p1)=1, reputacion_ciudad:+1, secreto_compartido) |

### 8.2 Elección

1. Se evalúa al disparar un hito final o al activarse el cierre por abandono.
2. Candidatos = desenlaces cuyo requiere se cumple.
3. Mayor prioridad; empate → mayor coincidencia de tags.
4. Sin candidatos → neutro por defecto (requiere vacío, obligatorio).
5. Negativos solo con condición causada por el jugador (p. ej. sospecha_crimen ≥ 3 y rencor:npc(p1) ≥ 2). Nunca son default.
6. Se aplican efectos_post, se borran tags de cierre de caso y se pasa a 3.2.

Los efectos_post no pueden escribir tags de cierre de caso (sospecha_crimen, favor_casa_aster, favor_archivo, pacto_caso, alianza_npc).

### 8.3 Mínimos por caso

| Tipo | Cantidad |
|---|---|
| positivo | ≥1 |
| neutro | ≥1 (uno es default) |
| negativo | 0–2 |

## 9. Simulación

### 9.1 Métricas

| Métrica | Definición | Meta |
|---|---|---|
| % trabadas | sin hito nuevo en 30 turnos o sin desenlace en 200 turnos | < 3 % |
| hitos alcanzados | media por caso | ≥ 6 de 8 |
| textos repetidos | repeticiones dentro de partida | 0 |
| textos sin uso | 0 usos tras el lote | < 10 % |
| tags nunca usados | 0 escrituras | 0 |
| tags sin efecto | escritos y nunca condicionan hito ni desenlace | listar |
| instancias repetidas | misma firma para el mismo jugador simulado con firmas libres | 0 |
| cobertura de instancias | % de firmas válidas jugadas por caso | ≥ 80 % |
| desenlace por tipo | % por perfil | negativo solo con agresivo |
| ramas recorridas | % de ramas tocadas | ≥ 80 % |
| casos por partida | media en partidas largas | informar |

### 9.2 Categorías

| Categoría | % de partidas | Narrador |
|---|---|---|
| Solo código | 40 % | Pasos 1 y 1b de 7.3 |
| Código con IA | 60 % | Pasos 1, 1b y 3 (Groq) |

El lote de 1000 partidas es un script (`narrador/sim/runner.js`, se corre con `node narrador/sim/runner.js`), fuera de npm test. 200 turnos máximo, 50 jugadores simulados con historial persistente, IndexedDB en memoria (fake-indexeddb). npm test solo corre las pruebas unitarias de `narrador/casos/*.test.js`.

## 10. Jugadores simulados

### 10.1 Mezcla

- 90 % de acciones: reglas en código con pesos por perfil.
- 10 % de acciones: elegidas por Haiku a partir de un resumen del estado, restringidas a la lista de tipos de acción y a objetivos existentes. Sin Groq.

### 10.2 Pesos por perfil

| Acción | Explorador | Amable | Agresivo | Curioso |
|---|---|---|---|---|
| viajar_camino | 30 | 10 | 10 | 10 |
| examinar | 20 | 5 | 5 | 20 |
| preguntar_clave | 10 | 15 | 5 | 30 |
| hablar_amable | 5 | 25 | 2 | 10 |
| ayudar | 5 | 20 | 2 | 5 |
| regalar_objeto | 2 | 8 | 0 | 2 |
| comerciar_justo | 5 | 5 | 3 | 3 |
| amenazar | 2 | 0 | 20 | 2 |
| atacar | 1 | 0 | 15 | 0 |
| robar | 3 | 0 | 15 | 3 |
| mentir | 2 | 1 | 8 | 5 |
| escuchar_oculto | 5 | 1 | 5 | 8 |
| ponerse_de_lado / aliarse | 5 | 5 | 5 | 2 |
| esperar | 5 | 5 | 5 | 0 |

### 10.3 Reglas de contexto

- Hito listo fuera de escena: +50 % a viajar hacia esa escena (explorador +20 %).
- deuda_personal ≥ 2: amable y curioso priorizan pagar.
- vigilancia_escena ≥ 2: agresivo cambia de escena con 40 %.
- Perfiles en el lote: 25 % cada uno.

## 11. Ejemplos

Objeto nuevo `objeto_lupa_bronce` (precio 12, 3 usos), se agrega a data/contenido/contenido-v3.json.
Conocimiento nuevo `conocimiento_sello_doble` (palabrasClave: sello, lacre, doble; umbral 0), dueño maren_archivista.

### 11.1 Caso caso_07 "El sello doble" (intriga)

Ranuras:

| Ranura | Conocimientos válidos (dueño) |
|---|---|
| p1 | conocimiento_sello_doble (maren_archivista), conocimiento_elia_1 (elia_bibliotecaria) |
| p2 | conocimiento_ivor_1 (ivor_cambista), conocimiento_sarin_1 (sarin_mensajera) |
| p3 | conocimiento_dario_1 (dario_guardia, sobornos), conocimiento_brenn_1 (brenn_arriero, posada escondida) |

Firmas válidas: 2 × 2 × 2 = 8. Supera el mínimo de 4.

Hitos relevantes:

| Hito | Condición | Escena entrega |
|---|---|---|
| h1 | inicio del caso | escena(p1) |
| h2 | pista_conocida:p1 ≥ 2 | cualquiera |
| h3 | alianza_npc:npc(p1) o favor_archivo ≥ 1 | escena_archivo_real |
| h4 | pista_conocida:p3 ≥ 2, hora 18–24, turno ≥ hitoPrevio.turno + 6 | escena_camino_norte |
| h6 (reparación) | rencor:npc(p1) ≥ 2 y gratitud:npc(p1) ≥ 1 | escena(p1) |

### 11.2 Elección de instancia

Historial del jugador para caso_07 (de una partida anterior):

| Firma | Usos |
|---|---|
| p1=conocimiento_sello_doble · p2=conocimiento_ivor_1 · p3=conocimiento_dario_1 | 1 |

Partida nueva (semilla 4471, inicio en escena_mercado_circular, hora 8):

1. caso_07 elegido: último tono jugado fue calido, sin penalización; ya jugado una vez → peso × 0.5; aun así gana el sorteo.
2. Candidatos: 8 firmas. Una ya jugada → 7 no jugadas.
3. Sorteo entre no jugadas → **p1 = conocimiento_sello_doble (maren_archivista) · p2 = conocimiento_sarin_1 (sarin_mensajera) · p3 = conocimiento_brenn_1 (brenn_arriero)**.
4. No repite: aunque p1 coincide, p2 y p3 cambian de conocimiento (y por lo tanto de dueño); la firma es distinta.
5. Orden: p1 → p3 → p2 (p1 fija; entre p3 y p2 se elige la permutación sin uso).

Ejemplo corto de una pista en otra instancia: en la partida anterior, la pista p3 era conocimiento_dario_1 (sobornos) y la daba dario_guardia en escena_puente_aduana; en esta, p3 es conocimiento_brenn_1 (posada escondida) y la da brenn_arriero en escena_camino_norte. El hito h4 es el mismo, pero el jugador llega por otro NPC, otro lugar y otro hecho.

### 11.3 Tres acciones

Estado inicial: h1 disparado al instanciar, en escena_mercado_circular; texto `c07_h1_t3` (menor uso del jugador). contadorHitos = 1. hitoPrevio = h1 (hora 8).

**Acción 1 — "Le pregunto a la archivista por el sello del documento"**

- maren_archivista está en escena_mercado_circular (SUPUESTO: hace compras de mañana; si no, el jugador viaja a escena_archivo_real).
- Tipo: preguntar_clave → conocimiento_sello_doble (umbral 0, ranura p1 habilitada).
- Tags: pista_conocida:conocimiento_sello_doble = 1, curiosidad:maren_archivista = 1.
- Reloj 8 → 9. Se habilita la ranura p3 (siguiente en el orden).
- Hitos listos: ninguno. Narración: reacción aprobada (maren_archivista, curiosidad, 1).

**Acción 2 — "Examino el sello con la lupa"**

- Tipo: examinar con objeto_lupa_bronce (1 uso consumido) → +2 por objeto adecuado, tope entendida.
- Tags: pista_conocida:conocimiento_sello_doble = 2.
- Reloj 9 → 10. h2 cumple, entrega en cualquiera → se dispara.
- contadorHitos = 2; hitoPrevio = h2 (hora 10, escena_mercado_circular).
- Efectos de h2: chisme_activo:escena_mercado_circular = 1, curiosidad:brenn_arriero = 1.
- Texto: `c07_h2_t1..t4`, usos del jugador 3, 1, 2, 1 → empate t2/t4 → semilla elige `c07_h2_t4`. Marcador `{npc:p3}` se resuelve como brenn_arriero: el texto nombra al arriero, no al guardia de la partida anterior.

**Acción 3 — "Le prometo a la archivista guardar el secreto si me deja ver el registro"**

- Tipos: guardar_secreto + aliarse.
- Tags: secreto_compartido:maren_archivista = 1, gratitud:maren_archivista = 1, alianza_npc:maren_archivista = 1. Relación +5.
- Reloj 10 → 11. h3 cumple; entrega en escena_archivo_real → hitosListos.
- Gancho: maren_archivista dice que vuelve al archivo a mediodía (reacción de tabla).
- h4 no está listo: falta pista p3 en 2 y 6 turnos desde hitoPrevio y franja 18–24.

Estado:

| Tag | Objetivo | Nivel | Decae |
|---|---|---|---|
| pista_conocida | conocimiento_sello_doble | 2 | no |
| curiosidad | maren_archivista | 1 | contadorHitos 5 |
| curiosidad | brenn_arriero | 1 | contadorHitos 6 |
| chisme_activo | escena_mercado_circular | 1 | hora 16 |
| secreto_compartido | maren_archivista | 1 | no |
| gratitud | maren_archivista | 1 | contadorHitos 5 |
| alianza_npc | maren_archivista | 1 | cierre de caso |

Rama: si después el jugador amenaza a brenn_arriero en escena_camino_norte, escribe miedo 2 y rencor 1; el positivo "sello expuesto con apoyo del Archivo y la caravana" queda fuera; el neutro "sello expuesto sin aliados" sigue disponible.

### 11.4 Caso en secuencia

caso_07 cierra a la hora 41 en escena_archivo_real con d_caso_07_1 (positivo). efectos_post: gratitud:maren_archivista = 1, reputacion_ciudad:Ardenhall = +1.

1. Se borran alianza_npc:maren_archivista, favor_archivo, sospecha_crimen.
2. Se borran las ranuras de caso_07 (p1–p3). Sobreviven: gratitud:maren_archivista (1), reputacion_ciudad Ardenhall (+1), secreto_compartido:maren_archivista, pista_conocida:conocimiento_sello_doble (2), curiosidad:brenn_arriero si no venció.
3. Pool: 11 casos. historial_tonos = [intriga, calido, …] → casos de intriga × 0.3.
4. Sorteo → caso_03 "La deuda del pastor" (melancolia), escenas_origen escena_cruce_colinas y escena_taberna_lareth.
5. Instancia: primera vez para este jugador → cualquier firma; se elige p1 = conocimiento_sendero_sin_vigilancia (dueño hollis_pastor).
6. Reloj sigue en 41; contadorHitos sigue en 7; hitoPrevio = null hasta que arranque.
7. El jugador está en Ardenhall: a los 6 turnos sin entrar a una escena de origen, sarin_mensajera trae un gancho en la escena actual. Al entrar a escena_taberna_lareth, se dispara h1 de caso_03 y hitoPrevio = ese momento.

## 12. Validación de contenido

| Chequeo | Error si |
|---|---|
| Hitos por caso | ≠ 8 |
| Textos por hito | ≠ 4 |
| Ids de texto | duplicado global |
| Desenlace default | no hay neutro con requiere vacío |
| Positivo o neutro | ninguno |
| Hito de reparación | ninguno |
| Alcanzabilidad | algún final inalcanzable en alguna instancia válida |
| Instancias | < 4 firmas válidas |
| Ids de mundo | escena, NPC, objeto o conocimiento inexistente en contenido-v3.json o en conocimientos aprobados |
| Marcadores de ranura | ranura inexistente en el caso |
| Tags | tipo fuera de los 20 |
| Tag físico | objetivo en el cuerpo del jugador |
| efectos_post | escribe tags de cierre de caso |

## 13. Cambios al código (por prioridad)

Code = escribir la lógica. Sonnet = escribir contenido, con revisión de Tomás.

| # | Cambio | Ruta | Tipo | Horas |
|---|---|---|---|---|
| 1 | Stores IndexedDB (estado_caso, historial_instancias, uso_textos, historial_tonos, reacciones_aprobadas), versión del contenido y migración | narrador/casos/persistencia.js | Code | 7 |
| 2 | Registro de tags: escribir, combinar, consultar | narrador/casos/tags.js | Code | 6 |
| 3 | Decaimiento por horas, por hitos y por cierre, enganchado al reloj | narrador/casos/decaimiento.js | Code | 5 |
| 4 | Tabla acción → tags y modificadores por estado de evento | narrador/casos/acciones.js | Code | 6 |
| 5 | Evaluador de condiciones, hitoPrevio, ciclo de disparo, prioridad, bloqueos | narrador/casos/hitos.js | Code | 9 |
| 6 | Instanciación: candidatos, firma, historial, orden de ranuras, resolución de marcadores | narrador/casos/instancias.js | Code | 8 |
| 7 | Elección de caso y casos en secuencia | narrador/casos/seleccion.js | Code | 4 |
| 8 | Selector de texto (partida + uso por jugador) | narrador/casos/textos.js | Code | 3 |
| 9 | Desenlaces, efectos_post, reparación | narrador/casos/desenlaces.js | Code | 5 |
| 10 | Validador de contenido (sección 12) | narrador/casos/validador.js | Code | 6 |
| 11 | Anti-traba y ganchos fuera de escena | narrador/casos/hitos.js, narrador/ganchos.js | Code | 4 |
| 12 | Integración con la cascada del narrador (aprobada → genérica; Groq fuera del turno) y guardado de reacciones | narrador/casos/narrar.js | Code | 5 |
| 13 | Pruebas node --test de los módulos 1–12 | narrador/casos/*.test.js | Code | 8 |
| 14 | Jugadores simulados (perfiles, reglas, 10 % Haiku) | narrador/sim/jugadores.js | Code | 6 |
| 15 | Script de lote y métricas (40/60, fake-indexeddb, fuera de npm test) | narrador/sim/runner.js, narrador/sim/metricas.js | Code | 7 |
| 16 | 12 plantillas de caso: ranuras, 8 hitos con condiciones, ramas, desenlaces | narrador/contenido/casos/*.json | Sonnet | 18 |
| 17 | 384 textos de hito (12 × 8 × 4) con marcadores de ranura | narrador/contenido/casos/*.json | Sonnet | 20 |
| 18 | Conocimientos nuevos para ranuras (aprox. 12) con palabrasClave, umbral y condiciones | data/contenido/contenido-v3.json | Sonnet | 5 |
| 19 | Tablas de reacción base por (NPC, tag, nivel) | narrador/contenido/reacciones.json | Sonnet | 10 |
| 19b | Reacciones genéricas: 12 textos (6 familias × 2) | narrador/contenido/reacciones_genericas.json | Sonnet | 2 |
| 20 | Revisión de Tomás de 16–19 (coherencia con el lore y canon) | — | Revisión | 14 |

| Total | Horas |
|---|---|
| Code | 94 |
| Sonnet (contenido) | 55 |
| Revisión | 14 |
| **Total** | **163** |

## 14. Decisiones

- DECIDIDO: 3 ranuras de pista, 2 conocimientos cada una (2 × 2 × 2 = 8 instancias, supera el mínimo de 4).
- DECIDIDO: Firma de instancia: conjunto de conocimientos por ranura, sin orden. El NPC es el dueño del conocimiento según contenido-v3.json.
- DECIDIDO: Mínimo 4 instancias por caso; el validador rechaza casos con menos.
- DECIDIDO: historial_instancias por jugador (IndexedDB), no se borra al borrar partidas.
- DECIDIDO: Entre casos en secuencia: se borran cierres de caso y ranuras (qué conocimiento ocupaba p1–p3); se conservan efectos_post, tags con decaimiento propio, relaciones, reloj, contadorHitos y pista_conocida.
- DECIDIDO: Regla en 3.2: pista_conocida se conserva y, si coincide con una ranura nueva, la ranura arranca con ese nivel; el validador evita que dispare un final en el primer turno.
- DECIDIDO: Sin límite de casos por partida; el pool no se repite dentro de la partida; agotado, modo libre.
- DECIDIDO: El caso siguiente arranca al entrar a una de sus escenas de origen, o a los 6 turnos con un gancho en la escena actual.
- DECIDIDO: objeto_lupa_bronce y conocimiento_sello_doble son nuevos: se agregan a data/contenido/contenido-v3.json antes de validar el caso.

- DECIDIDO: conocimiento_sendero_sin_vigilancia pertenece a hollis_pastor.
- DECIDIDO: sin reacción aprobada para (NPC, familia de tag), se narra una reacción genérica de la familia (6 familias × 2 textos).

## RESUELTAS

- R1: una opción de ranura es un conocimiento; el NPC es su dueño; npcs_validos eliminado; 8 firmas por caso.
- R2: al cambiar de caso se borran las ranuras; pista_conocida se conserva y, si coincide con una ranura nueva, la ranura arranca con ese nivel (regla única en 3.2).
- R3: conocimiento_sendero_sin_vigilancia es de hollis_pastor; en caso_07 p3 pasa a conocimiento_dario_1 / conocimiento_brenn_1.
- R4: sin reacción aprobada ni candidata aprobada, se narra una reacción genérica por familia (6 × 2); Groq no narra sin aprobación manual.

Cambios aplicados: R1 R2 R3 R4 — R1: 2.2, 2.3, 2.4, 3.3, 3.4, 11.1, 11.2, 14. R2: 3.2, 11.4, 14. R3: 11.1, 11.2, 11.4, 14. R4: 7.3, 13 (fila 19b, totales), 14.

Cambios: 7.3 cascada aprobada → genérica (sin reformulación); 9.2 y 13 fila 12 ajustadas a esa cascada.
