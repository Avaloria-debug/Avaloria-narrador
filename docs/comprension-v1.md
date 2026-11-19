# COMPRENSIÓN DEL TEXTO LIBRE — Versión 1 — Crónicas de Avaloria

Define cómo el código interpreta lo que escribe el jugador. Complementa a `catalogo-intenciones-v1.md`, que define las formas. Usa los ids de `vocabulario-v1.md`.

---

## 1. Pipeline

1. **Normalizar:** minúsculas, sin tildes, sin signos de puntuación, espacios simples.
2. **Tokenizar:** separar en palabras.
3. **Quitar palabras vacías:** a, al, el, la, los, las, un, una, de, del, en, con, por, para, que, le, lo, y.
4. **Buscar intención** (sección 2).
5. **Resolver parámetros** (secciones 3 y 4).
6. **Decidir:** ejecutar, reformular una vez, o pasar a IA.

---

## 2. Coincidencia de intención

### 2.1 Tolerancia a typos, por palabra
- Palabra de 3 letras o menos: coincidencia exacta.
- Palabra de 4 letras o más: distancia de Damerau-Levenshtein ≤ 1 sobre la palabra completa. Insertar, borrar, cambiar una letra o intercambiar dos letras adyacentes ("comrpar", "tabenra", "huri") cuesta 1. Sin coincidencia por prefijo ni subcadena ("decir" no es "decirle"). *(R4 final. Reemplaza la regla anterior: más de 4 letras, distancia ≤ 2, y la versión intermedia de R4: Levenshtein ≤ 1 sin transposición.)*

**R4 (ajuste): verbos de riesgo.** `huir`, `atacar`, `emboscar`, `abortar`, `rendirse` y `defender` no tienen tolerancia a typos: solo coinciden escritos exactos ("huri" no es `huir`: da reformulación). La tolerancia de arriba vale para el resto de los verbos.

**R6: voseo.** Antes de comparar, una palabra que termina en `-á`, `-é` o `-í` se cambia por el infinitivo (`-ar`, `-er`, `-ir`) si ese infinitivo es una palabra de alguna forma del catálogo de intenciones: "viajá" → "viajar", "hablá" → "hablar", "leé" → "leer", "dormí" → "dormir". Se aplica a la frase y a las formas del catálogo. Si con esa conversión no coincide ninguna intención, se compara como siempre (así "hui" sin tilde sigue siendo "huí"). Una palabra sin infinitivo en el catálogo ("comé") no se toca.

### 2.2 Formas de varias palabras
Cada forma del catálogo se tokeniza igual que la entrada (sin palabras vacías). Una forma coincide si todas sus palabras aparecen **en orden** dentro de la entrada, cada una con la tolerancia de 2.1. Se permite que haya otras palabras entre medio.

Ejemplos:
- "calmá la sitiacion" coincide con "calmar la situación" (calmá → calmar, sitiacion → situación: distancia 1 y 2).
- "ir a la plaza" coincide con la forma "ir a" de viajar, pero la palabra "plaza" no es un destino válido (ver 2.4).

### 2.3 Prioridad entre intenciones
- Gana la forma que coincide con más palabras.
- Si empatan, gana la que aparece primero en la frase.
- Si la frase trae dos intenciones, se responde a la primera y se pide repetir la segunda (regla del catálogo).

### 2.4 Viajar
El parámetro destino es uno de estos tres:

| Destino | Id | Cómo se reconoce |
|---|---|---|
| Ciudad | `ciudad_ardenhall`, `ciudad_lareth`, `ciudad_halenor` | Por el nombre de la ciudad ("Ardenhall", "Lareth", "Halenor"). |
| Escena de camino | `escena_camino_norte`, `escena_camino_este`, `escena_camino_sur` | Por el nombre completo ("camino del norte"), o por la dirección sola si está escrita exacta ("norte"). |
| Escena de ciudad | las 6 escenas con ciudad (mercado, archivo, plaza, taberna, biblioteca, aula) | Por la primera palabra del nombre de la escena ("taberna", "archivo"). |
| Lugar de camino | `escena_lago_espejos`, `escena_puente_aduana`, `escena_cruce_colinas` | Por la primera palabra del nombre ("lago", "puente", "cruce"). |

Los nombres se comparan sin tildes y con la tolerancia de 2.1.

Si la frase nombra una escena y su propia ciudad ("la biblioteca de Halenor"), el destino es la escena. Si nombra dos destinos distintos, se reformula con los nombres.

**Costo:**
- Escena de la misma ciudad que la escena actual: `reglas.viajeHorasIntraCiudad` (1 hora del reloj).
- Cualquier otro destino (otra ciudad, una escena de otra ciudad, un camino): se viaja por los caminos, con `reglas.viajeHorasPorCamino`.
- Entre un lugar de camino y su camino: `reglas.viajeHorasLugarCamino` (1 hora del reloj).

Si la frase trae "viajar" con un lugar que no es destino, se reformula: "¿A dónde querés ir?"

---

## 3. Resolver NPC

### 3.1 Solo se consideran NPCs presentes en la escena actual
Un NPC que está en otra escena no se busca. Si el jugador lo nombra y no está, el código responde: "No lo ves por acá."

### 3.2 Alias por NPC
Cada NPC tiene un nombre, un rol y alias. El código compara la frase contra estos términos (con la tolerancia de 2.1):

| NPC | Alias |
|---|---|
| `maren_archivista` | maren, archivista, orst |
| `serel_panadero` | serel, panadero, norlen |
| `ivor_cambista` | ivor, cambista, aster, prestamista |
| `naela_tabernera` | naela, tabernera, riven |
| `tiren_docente` | tiren, docente, profesor, selvan |
| `elia_bibliotecaria` | elia, bibliotecaria, miren |
| `brenn_arriero` | brenn, arriero, holt, caravana |
| `ysolde_pescadora` | ysolde, pescadora, varn |
| `dario_guardia` | dario, guardia, aduanero, keth |
| `sarin_mensajera` | sarin, mensajera, tolle |
| `hollis_pastor` | hollis, pastor, dren |
| `oren_peregrino` | oren, peregrino, basil |

*Supuesto menor: "guardia" en la aduana apunta a Darío. Si después hay otro guardia en otra escena, no hay conflicto porque solo se buscan los NPCs presentes.*

### 3.3 Resultado de la búsqueda
- **Un NPC coincide** → es el objetivo.
- **Ninguno coincide** → si el verbo lo necesita, se reformula: "¿Con quién?"
- **Dos o más coinciden** → ver 4.

---

## 4. Parámetros faltantes y empates

Los verbos se dividen en dos grupos.

### 4.1 Verbos que exigen elegir a la persona
Solo `hablar_con`. Si el jugador no nombra a nadie:
- Sin NPC en la escena → "No hay nadie con quien hablar acá."
- Un NPC en la escena, ningún nombre y ninguna palabra clave de otro NPC (presente o no) en la frase → se habla con ese NPC, sin reformular. *(R2. Reemplaza la regla anterior: "nunca se elige por él"; con un NPC y ningún nombre se reformulaba.)*
- Un NPC en la escena y la palabra clave de un NPC ausente → se reformula (R3).
- Dos o más → se reformula con los nombres de los presentes: "¿Con cuál de los dos: Maren o Serel?" *(El código muestra solo los nombres, nunca los números.)* (R3)

Consulta de tema sin pregunta (R1): si la frase trae una palabra clave de un conocimiento de un NPC presente, es una consulta de tema con ese NPC, tenga o no un verbo. Si la palabra clave es de dos o más NPC presentes, se reformula. Se eliminó la excepción "verbo exacto distinto de hablar", salvo las dos siguientes, que sí quedan escritas:
- "hablame" y "háblame" son entradas del léxico (`data/diccionarios/diccionario-lexico.md`, `intencion_hablar_con`, coloquial), exactas. "hablá" ya entra por "hablá con" y el voseo (R6). Con ellas "hablame sobre Serel" ejecuta `hablar_con` con Serel (NPC nombrado, 3.3).
- "hablar con" explícito (forma de `hablar_con` de dos palabras o más, con su preposición) más una palabra clave de tema, sin nombrar a ningún NPC presente y sin léxico de NPC: se reformula (`falta_npc`); la palabra clave no dice a quién. Con el nombre del NPC sigue siendo consulta de tema. "hablame sobre el tratado" (sin preposición) es consulta. **Regla confirmada** (fase 1).
- R1b: si la frase trae `hablar_con` (forma exacta o con la tolerancia de 2.1) y una referencia a un NPC presente que sale del léxico de NPC ("hablar con el de la harina"), es una orden de hablar y se ejecuta `hablar_con` con ese NPC. Las palabras clave que forman parte de esa referencia no son un tema. Con el nombre del NPC y un tema ("hablá con Serel de la harina") sigue siendo consulta de tema.
- R1c: si la frase trae una intención de movimiento escrita exacta, no es consulta de tema y sigue el flujo normal. **La lista sale del catálogo, sin listas nuevas**: son las intenciones de `contenido-v3.json` que cambian al jugador de lugar, por id: `intencion_viajar` e `intencion_retirarse` (`INTENCIONES_MOVIMIENTO` en `comprension.js`, que reemplaza a la lista provisoria de verbos). `huir` y `avanzar_cautela` ya no cuentan: no cambian de escena por sí solas.
- `retirarse` sin destino ("salir de acá", "retirarse"): se mira `salidas` de la escena actual. Una sola → se ejecuta el movimiento a esa salida (`intencion_viajar` con `destino`). Varias → se reformula (`destino_ambiguo`) con los nombres de las salidas. Ninguna → se reformula con el motivo `sin_salidas` ("no hay salidas"); ese texto no tiene plantilla todavía (ver PENDIENTES) y la narración usa el respaldo. Si la escena no está en el contenido, se ejecuta como antes.

### 4.2 Verbos que pueden elegir por el jugador
`ayudar`, `negociar`, `presionar`, `atacar`, `emboscar`, `defender`, `distraer`, `observar`.

- Sin NPC nombrado, con un solo NPC presente → ese NPC.
- Sin NPC nombrado, con dos o más presentes → se usa `resolverNpcObjetivo` (menor relación, con reporte de ambigüedad), como ya está definido.
- Sin NPC presente → se ejecuta sin objetivo, si el verbo lo permite (por ejemplo, observar), o se reformula.

### 4.3 Objetos
`usar` y `examinar` exigen un objeto.
- Sin objeto nombrado y un solo objeto aplicable en la escena o en el inventario → ese objeto.
- Varios → reformulación: "¿Qué querés usar?"
- Sin ninguno → "No tenés nada para usar."

`comprar` y `atacar` (con arma) aceptan objeto opcional. Sin objeto, se usa el que corresponda por defecto, o se reformula si no hay ninguno.

### 4.4 Empates de nombre o alias
Si dos NPCs o dos objetos coinciden con la misma palabra, el código **reformula**, en vez de elegir por distancia. Esto reemplaza la regla anterior de "nombre más corto", porque elegir mal sin avisar es peor que preguntar.

---

## 5. Reformulación

- Solo una vez por turno.
- Texto breve y natural, sin mencionar ids ni la palabra "intención".
- Si la segunda entrada tampoco se entiende, pasa a la IA (narrador de última instancia).

Ejemplos de texto: "No entendí bien. ¿Podés decirlo de otra forma?" o la reformulación específica de la sección 4.

---

## 6. Qué registra el código

Cada entrada de texto libre que no se resolvió por código en la primera pasada queda marcada como `intento_reformulacion: true` en el registro, y se guarda la frase de la segunda pasada. El resultado de la comprensión se guarda en `intencion_detectada` (el id, o `null`).

---

## 7. Verificación

- Un texto con typo en una palabra larga ("calmá la sitiacion") se resuelve por código.
- "Hablá con el panadero" resuelve a `serel_panadero` si está en la plaza.
- "Hablá con" sin nombre, con dos NPCs presentes, reformula.
- "Atacar" con dos NPCs presentes, sin nombre, usa `resolverNpcObjetivo`.
- "Usar" sin objeto y con dos objetos, reformula.
- "Ir a la casa" no viaja: reformula el destino. ("Ir a la plaza" e "ir al lago" sí viajan: son destinos, ver 2.4.)
- Una frase con dos intenciones responde a la primera y pide la segunda.
