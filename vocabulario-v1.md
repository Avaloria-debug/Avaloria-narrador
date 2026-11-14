# VOCABULARIO — Versión 1 — Crónicas de Avaloria

Fija los términos del narrador por código, el sistema de registro y Firestore. Todo el código, los datos y los tests usan exactamente estos valores. Los textos en castellano para el jugador no pasan por acá: solo los ids y valores técnicos.

Regla: **un concepto, un valor.** Si aparece otra forma en un .md o en el JSON, manda este archivo.

---

## 1. Ids de escena

Formato: `escena_<nombre_en_snake_case>`. Se usan en `salidas`, `escenaInicialId`, `escenas` de eventos y `escenaVenta` de objetos.

| Id | Nombre para el jugador |
|---|---|
| `escena_mercado_circular` | Mercado Circular |
| `escena_archivo_real` | Archivo Real |
| `escena_plaza_cambistas` | Plaza de los Cambistas |
| `escena_taberna_lareth` | Taberna de la Campana Tardía |
| `escena_biblioteca_publica` | Biblioteca pública de Halenor |
| `escena_aula_cartografia` | Aula de cartografía |
| `escena_camino_norte` | Camino del norte |
| `escena_camino_este` | Camino del este |
| `escena_camino_sur` | Camino del sur |
| `escena_lago_espejos` | Lago de espejos |
| `escena_puente_aduana` | Puente de la aduana |
| `escena_cruce_colinas` | Cruce de colinas |

---

## 2. Ids de NPC

Formato: `<nombre>_<arquetipo>`, en snake_case, sin tildes. Ya definidos en `npcs.json`.

Ejemplos: `maren_archivista`, `serel_panadero`, `sarin_mensajera`, `brenn_arriero`.

---

## 3. Ids de objeto

Formato: `objeto_<nombre>`. Ya definidos en `objetos`.

---

## 4. Ids de evento

Formato: `evento_<nombre>`. Los tres referenciados por NPCs son fijos:
- `evento_deuda_impaga` (Ivor)
- `evento_disputa_aduana` (Darío)
- `evento_tormenta_verano` (Hollis)

---

## 5. Verbos e intenciones

Cada intención tiene un **id de intención** (`intencion_<verbo>`) y un **id de verbo** (el que usa el motor y las transiciones). Son distintos a propósito: el id de intención va con prefijo, el de verbo no.

| Verbo para el jugador | Id de verbo | Id de intención |
|---|---|---|
| Explorar | `explorar` | `intencion_explorar` |
| Descansar | `descansar` | `intencion_descansar` |
| Observar | `observar` | `intencion_observar` |
| Trabajar | `trabajar` | `intencion_trabajar` |
| Comprar | `comprar` | `intencion_comprar` |
| Leer | `leer` | `intencion_leer` |
| Ayudar a alguien | `ayudar` | `intencion_ayudar` |
| Negociar | `negociar` | `intencion_negociar` |
| Presionar | `presionar` | `intencion_presionar` |
| Retirarse | `retirarse` | `intencion_retirarse` |
| Huir | `huir` | `intencion_huir` |
| Atacar | `atacar` | `intencion_atacar` |
| Emboscar | `emboscar` | `intencion_emboscar` |
| Calmar la situación | `calmar_la_situacion` | `intencion_calmar` |
| Ocultarse | `ocultarse` | `intencion_ocultarse` |
| Avanzar con cautela | `avanzar_cautela` | `intencion_avanzar_cautela` |
| Distraer | `distraer` | `intencion_distraer` |
| Abortar | `abortar` | `intencion_abortar` |
| Defender | `defender` | `intencion_defender` |
| Rendirse | `rendirse` | `intencion_rendirse` |
| Hablar con... | `hablar_con` | `intencion_hablar_con` |
| Examinar | `examinar` | `intencion_examinar` |
| Usar | `usar` | `intencion_usar` |
| Viajar | `viajar` | `intencion_viajar` |

**Nota de nombres:** `intencion_calmar` y `calmar_la_situacion` no coinciden en el sufijo. Es el único caso. Se mantiene así porque ya está en los datos. El id de verbo es el que vale para transiciones.

---

## 6. Resultados de una acción

| Valor | Significado |
|---|---|
| `exito` | La acción sale bien |
| `fallo` | La acción sale mal |
| `neutro` | La acción no tiene chequeo de resultado |

Se escribe siempre sin tildes: `exito`, nunca `éxito`.

---

## 7. Estados

Hay tres familias de estado. Son distintas, y no se mezclan entre sí.

### 7.1 Estado de escena
`tranquilo`, `social`, `sigilo`, `tenso`, `peligroso`, `combate`.

Orden de gravedad (de menor a mayor): tranquilo < social < sigilo < tenso < peligroso < combate.

Un neutro de evento **no** es un estado de escena. Por eso los neutros tienen `estado: null`.

### 7.2 Estado emocional del NPC
`neutral`, `desconfiado`, `amable`, `hostil`, `temeroso`, `enojado`.

Es el valor de `estadoEmocional`. Va en minúscula, sin tildes. `neutral` (estado emocional) y `neutro` (resultado) son distintos. Los dos se mantienen porque están en los datos, y el código no los compara entre sí.

### 7.3 Disposición del NPC (para el narrador IA)
Se traduce a palabra a partir del número: `hostil`, `desconfiado`, `neutral`, `amable`, `cercano`.

Rangos de disposición: -2 a 2. El código nunca muestra el número.

---

## 8. Categorías de escena

`ciudad`, `mercado`, `conocimiento`, `camino`, `bosque`, `frontera`.

Son la categoría base de cada escena, no un estado.

---

## 9. Tipos de objeto

`arma`, `herramienta`, `consumible`, `narrativo`.

---

## 10. Categorías de evento

Coinciden con los estados de escena, más `neutro` para los eventos que no producen estado:
`tranquilo`, `social`, `tenso`, `peligroso`, `sigilo`, `combate`, `neutro`.

Acá `neutro` es una categoría de evento, no un resultado ni un estado.

---

## 11. Fin de evento

| Valor | Significado |
|---|---|
| `tiempo` | Termina por duración (turnos u horas) |
| `hora` | Termina a una hora del reloj |
| `accion` | Termina por una acción del jugador |

---

## 12. Disparo de evento

| Valor | Significado |
|---|---|
| `azar` | Probabilidad por turno, en su escena |
| `hora` | Se dispara a una hora del reloj |
| `accion` | Se dispara por un verbo del jugador |

---

## 13. Registro

| Campo | Valores |
|---|---|
| `ruta` | `grupo_1` (código), `grupo_2` (IA) |
| `origen_respuesta` | `codigo`, `ia` |
| `revision` | `pendiente`, `aprobada`, `descartada` |
| `intento_reformulacion` | `true`, `false` |
| `intencion_detectada` | id de intención, o `null` |

Los textos del jugador se guardan tal cual. Los valores de esta tabla son los únicos permitidos.

---

## 14. Firestore

| Elemento | Valor |
|---|---|
| Colección de registros | `registros` |
| Documento | un registro por documento, id `reg_<número>` |
| Colección de partidas | `partidas` (la del zip, sin cambios) |

---

## 15. Cambios necesarios en `contenido-v1.json`

Antes de que Fable lo use, hay que corregir estos puntos. Son cambios de forma, no de contenido:

1. **Escenas por nombre, no por id.** En `objetos.escenaVenta`, `objetos.escenaAparece`, `eventos.escenas` y `npcs.escena` se usan nombres ("Mercado Circular"). Deben usar ids de la sección 1.
2. **Nombres de NPC por nombre, no por id.** En `objetos.npcAsociado` se usa "Ysolde Varn". Debe usar `ysolde_pescadora`.
3. **Verbos con nombre de la UI.** En `intenciones.verbo` aparecen "Hablar con...", "Calmar la situación", etc. Deben usar los ids de la sección 5.
4. **Disparo y fin de eventos en texto libre.** Hoy dicen "Azar, 10% por turno" o "Hora del reloj: 07:00". Deben ser campos separados: `disparo: {tipo, valor}` y `fin: {tipo, valor}`.
5. **`estado` en eventos.** Los neutros tienen `null`. Se mantiene, pero debe quedar como `neutro` si el campo es de categoría.

Puedo hacer estos cambios con un script, como el anterior, y dejar el informe de qué se modificó.

---

## 16. Verificación

- Todo id del JSON existe en este archivo.
- Ningún campo de registro tiene un valor fuera de la sección 13.
- Ningún texto de evento o de objeto usa un nombre donde debe ir un id.
