# Formato de los diccionarios

Los cinco archivos de `data/diccionarios/` se leen con `narrador/diccionarios.js` (`cargarDiccionarios`, `validarDiccionario`). Este documento describe lo que ese código valida, no más. Si el código cambia, este documento se actualiza.

## Reglas comunes

- Texto UTF-8. Se aceptan saltos de línea `\n` y `\r\n`, y un BOM al principio.
- **Front matter** al principio del archivo, entre dos líneas `---`. Cada línea es `clave: valor` (se corta en el primer `:`). Campos que se validan:
  - `tipo`: tiene que ser el nombre del diccionario (`diccionario-lexico`, `ortografia-tipeo`, `frases-patrones`, `contexto-palabras`, `temas-conocimiento`).
  - `version`: entero mayor o igual a 1.
  - `entradas`: entero. Tiene que ser igual a la cantidad de **líneas de datos** del archivo.
  - Si falta el front matter (no hay `---` de apertura y de cierre) es un error y el archivo se lee entero como cuerpo.
- **Líneas de datos**: todas las que no están vacías ni empiezan con `#`. Cuentan para `entradas` aunque después se descarten.
- **Títulos**: líneas que empiezan con `#` (cualquier cantidad de `#`). El texto del título, en minúsculas y sin los `#`, es la sección de las líneas siguientes. Solo importa la sección en `temas-conocimiento`; en los otros cuatro archivos los títulos agrupan y no cambian cómo se lee la línea.
- **Columnas**: separadas por `|`, con los espacios de alrededor recortados. La cantidad es fija por archivo (ver abajo). Una columna vacía es un error.
- **Líneas inválidas**: una línea con otra cantidad de columnas, una columna vacía, un tipo o valor no permitido, o un id que no existe en `data/contenido/contenido-v3.json` se **descarta**. Queda en `descartados` (con número de línea, texto y motivo) y en `errores` como `archivo.md:LINEA: motivo`. La carga sigue con el resto.
- **Resultado** de cargar un archivo: `{ cargados, descartados, errores }`. Cada entrada cargada trae `linea` (número de línea del archivo) y `seccion`, más los campos de su archivo.
- Un archivo que falta o no se puede leer devuelve `cargados: []`, `descartados: []` y un solo error `archivo.md: no se pudo leer (motivo)`. Los otros archivos se cargan igual. Nunca se lanza una excepción.
- Los diccionarios se leen en memoria. Nada se escribe.

### Clases de id

Los ids se buscan en el contenido, por clase:

| Clase | De dónde sale |
| --- | --- |
| intencion | `intenciones[].id` |
| objeto | `objetos[].id` |
| npc | `npcs[].id` |
| escena | `escenas[].id` |
| ciudad | `ciudad_ardenhall`, `ciudad_lareth`, `ciudad_halenor` |
| evento | `eventos[].id` |
| conocimiento | `npcs[].conocimientos[].id` |

## `diccionario-lexico.md` (3 columnas)

`forma | id | tipo`

- `forma`: texto libre, una palabra o una frase.
- `tipo` (obligatorio, uno de): `infinitivo`, `conjugada`, `sinonimo`, `coloquial`, `regional`, `objeto`, `npc`, `escena`.
- `id`, según el `tipo`:
  - `infinitivo`, `conjugada`, `sinonimo`, `coloquial`, `regional` (formas de un verbo): id de **intención**.
  - `objeto`: id de objeto. `npc`: id de NPC.
  - `escena`: id de escena **o** de ciudad (`ciudad_*`).
- Secciones del archivo real: Verbos, Objetos, NPCs, Escenas (un título por clase; no se valida que el tipo coincida con el título).

## `ortografia-tipeo.md` (3 columnas)

`escrita | correcta | tipo`

- `escrita`: cómo lo escribe el jugador (con el error). `correcta`: cómo debería escribirse.
- `tipo` (uno de): `tilde`, `b_v`, `ll_y`, `s_z_c`, `h`, `g_j`, `qu_k`, `tecla_adyacente`, `letra_repetida`, `letra_omitida`, `letra_cambiada`, `voseo_mal`, `apocope`, `valida`.
- `valida` marca una palabra que **no es un error**: tiene que ser igual en `escrita` y en `correcta`, si no la línea se descarta. Sirve para decir que esa palabra no se corrige.
- No se validan los ids: las frases pueden ser de varias palabras (nombres del juego mal escritos).

## `frases-patrones.md` (4 columnas)

`patrón | intención o categoría | parámetros | ejemplo`

- `patrón`: frase con marcadores como `{npc}`. No se valida que los marcadores coincidan con los parámetros.
- Segunda columna: un id de **intención**, o una categoría: `consulta`, `multi` (frase con dos intenciones) o `ignorar` (ruido: saludos y similares).
- `parámetros`: `-` si no hay, o una lista `clave=id` separada por `;`. Claves permitidas y clase de id de cada una:
  - `npc`: npc. `objeto`: objeto. `destino`: escena o ciudad.
  - `primera`, `segunda`: intención (en las frases `multi`).
  - `tema`: npc, objeto, escena, ciudad, evento o conocimiento.
  - Una clave repetida en la misma línea es un error.
- `ejemplo`: la frase escrita como la diría el jugador. Solo se exige que no esté vacía.
- Secciones del archivo real: una por intención, más Consultas, Frases con dos intenciones y Ruido.

## `contexto-palabras.md` (4 columnas)

`palabra | sentido | id | estado`

- `palabra`: palabra que puede tener más de un sentido. `sentido`: texto libre que describe ese sentido.
- `id`: `-` (sin id) o un id de intención, objeto, NPC, escena o ciudad. Con `-`, la entrada carga con `id: null`.
- `estado`: cuándo vale ese sentido. Uno de:
  - `siempre`;
  - un estado de escena: `tranquilo`, `social`, `sigilo`, `tenso`, `peligroso`, `combate`;
  - un id de escena (tiene que empezar con `escena_` y existir).
- Secciones del archivo real: Palabras con más de un sentido, Pronombres y referencias.

## `temas-conocimiento.md` (2 columnas)

`primera | segunda`

La lectura depende de la sección (título en minúsculas):

- **Sección `Conocimientos`** (el título tiene que ser exactamente ese): `id de conocimiento | temas`. `temas` es una lista separada por `;`, sin elementos vacíos. Cada entrada carga como `{ bloque: 'conocimientos', conocimientoId, temas }`.
- **Cualquier otra sección** (en el archivo real, `Temas generales`): `tema | NPCs`. `NPCs` es una lista de ids de NPC separada por `;`, sin elementos vacíos. Cada entrada carga como `{ bloque, tema, npcs }`.
  - **`*`** en la columna de NPCs significa **cualquier NPC**: la entrada carga con `npcs: ['*']`. `*` no se puede mezclar con ids en la misma lista (`*` junto a otros ids es un id inexistente y la línea se descarta).

## Qué no se valida

- Que `entradas` o los títulos reflejen secciones concretas (salvo `Conocimientos`).
- Que dos entradas no se contradigan (la misma `forma` con dos ids, la misma `escrita` con dos `correcta`). Eso lo resuelve quien usa el diccionario.
- Que los marcadores `{...}` de un patrón estén en los parámetros.
- Que los textos estén sin tildes o en minúsculas.
