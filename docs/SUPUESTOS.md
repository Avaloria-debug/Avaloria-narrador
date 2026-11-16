# SUPUESTOS — Versión 1 (actualizado para v3)

Decisiones tomadas sin preguntar. Son reversibles. El código y el contenido se alinean con estas. Si un supuesto contradice a un .md, manda este archivo, salvo que el supuesto diga lo contrario.

## Eventos
- El orden de gravedad de los estados es: tranquilo < social < sigilo < tenso < peligroso < combate.
- "Vecina" = escena conectada directamente por una salida. La escena vecina sube el estado propio como máximo un nivel, y solo si es más grave.
- La probabilidad por turno de cada evento sale de su sentido (5% a 10% comunes, 1% a 3% raros). Puede variar por evento.
- "Fin cuando se va" (visita del noble) se traduce a 6 horas del reloj.
- "Fin cuando alguien se retira" (conversación de vecinos) se cierra con el verbo retirarse.
- El efecto de la comida compartida (Naela) se aplica aunque Naela no esté en la escena, solo sobre su disposición.
- En la versión 1 no hay guardia de ciudad. El robo reportado termina por tiempo.
- El cierre de la puerta de la ciudad bloquea solo el viaje hacia Ardenhall desde los caminos.
- El incendio se traslada del antiguo taller (que ya no existe) al mercado.
- "Fin cuando alguien cierra la ventana" (sigilo) se traduce a 3 turnos.
- Un combate termina cuando el jugador huye o se rinde. No se modela la caída del NPC en la versión 1.
- Los neutros no producen estado de escena. Solo cambian el mundo.
- "Todas las escenas de camino" de la tormenta de verano = las 6 escenas de camino y lugares de camino.
- Un evento con fin por hora sin valor: la hora de fin es inicio + duración.
- Fin por hora se evalúa al avanzar el reloj, aunque el jugador esté en otra escena.

## Escenas y viajes
- El viaje entre ciudades pasa por un camino. Las horas (36, 44 y 52) se descuentan del reloj del mundo, y el jugador puede detenerse en el camino.
- Los lugares de camino son escenas propias, conectadas a su camino.
- Huir exitoso mueve al jugador a la escena de salida (igual que la beta). Huir fallido no mueve.
- Escena inicial del jugador: escena_mercado_circular.
- Reloj inicial: 08:00 del primer día.

## Intenciones y comprensión
- intencion_viajar se agregó después del catálogo original. No cuenta como verbo de nivel 1. El motor tiene 24 intenciones.
- Varias intenciones en una frase: se responde a la primera por posición y se pide repetir la segunda.
- Parámetro faltante: hablar_con nunca elige a alguien por el jugador. Los demás verbos usan resolverNpcObjetivo cuando hay dos o más NPCs presentes.
- Empates de nombre o alias (NPCs u objetos): se reformula. No se elige por distancia.
- Solo se buscan NPCs presentes en la escena actual.
- Viajar a un lugar que no es destino válido: se reformula.

## Narrador IA
- La IA de última instancia solo escribe texto. Nunca cambia efectos.
- Modelo: openai/gpt-oss-120b, con reasoning_effort "low" en cada llamada. Confirmado por Tomás.
- Límites del plan gratuito tomados de fuentes de octubre de 2026 (30 RPM, 1.000 RPD, 8.000 TPM, 200.000 TPD). Hay que verificarlos en console.groq.com/docs/rate-limits antes de la prueba real.
- Presupuesto: hasta 800 tokens por turno, entre entrada y salida.

## Economía, combate y marcas
- Trabajar gana entre 20 y 60 bronce, al azar. Comprar falla si no alcanza, sin descontar nada. El dinero nunca queda en negativo.
- Dinero inicial: bronce entre 100 y 300, plata entre 0 y 5, sorteado al crear la partida.
- Rasgos: ignorados en la versión 1.
- Combate: no hiere al jugador. Solo afecta a NPCs y eventos.
- La marca "leyo" la activa leer en escena_biblioteca_publica. La usan Elia y Oren.
- Un conocimiento se revela una sola vez por NPC.
- El conocimiento de Hollis sobre el sendero tiene id conocimiento_sendero_sin_vigilancia y requiere el evento de tormenta activo.

## Persistencia y claves
- La clave de Groq se guarda en localStorage (igual que la beta y el HTML). Se pasa como parámetro a crearPartida o narrar. Nunca entra al estado ni al registro.
- Las partidas del narrador se guardan en IndexedDB, con persistencia/adaptadores/almacenIndexedDB.js de la beta.
- El HTML de Avaloria sigue guardando sus partidas en localStorage. No se toca.
- La versión del contenido se guarda con la partida. Si no coincide al cargar, se reconstruye lo posible y no se borra.

## Registro y Firestore
- Cada turno con texto libre genera un registro. Los textos del jugador se guardan completos, sin limpieza.
- Los registros se guardan en Firestore, colección `registros`. Todos llegan al proyecto.
- Autenticación anónima para escribir. Lectura solo para la cuenta de administrador.
- Los registros con instrucciones para un modelo se guardan igual, marcados con contaminacion: true. No cambian el comportamiento del narrador.
- Se guardan todos los registros hasta que haya una política de privacidad definida.

## Datos que quedan como están, pero conviene revisar
- Explorar tiene 2 plantillas neutras. Las demás intenciones tienen 1. Se conservó así.
- Presionar: éxito +5 de relación y -1 de disposición. Fallo -15 y disposición fijada en -2. Esto cambia el código de Fase 4.
- Atacar y Emboscar: -40 de relación, disposición fijada en -2, y bloquean conocimientos para siempre.

## Bloque 1 — contenido (carga y validación)
- Estructura: los documentos de diseño están en `docs/` y el contenido en `data/contenido/contenido-v3.json`. `CLAUDE.md` queda en la raíz. Este archivo es el único de supuestos: no hay `SUPUESTOS.md` en la raíz ni `SUPUESTOS-v3.md`.
- El validador separa `errores` (comprobaciones de la sección 5.1 del prompt maestro; bloquean) de `avisos` (referencias secundarias; no bloquean). El contenido pasa sin errores y sin avisos.
- Las 13 referencias inconsistentes de `contenido-v3.json` se corrigieron por pedido de Tomás:
  - `ivor_cambista` y `dario_guardia`: `requiereEvento` pasa a `evento_deuda_impaga` y `evento_disputa_aduana`.
  - `evento_cierre_puerta`: `destino: ciudad_ardenhall` se mantiene. Es un destino de viaje (vocabulario, sección 5b).
  - `evento_guardias_persiguen`: `disparo.escena: "ciudad"` pasa a `disparo.escenas: ["escena_plaza_cambistas", "escena_mercado_circular"]`. El campo `escenas` del evento ya tenía esa lista y no cambió.
  - `evento_huida_colinas`: `disparo.escena` pasa a `escena_cruce_colinas`.
  - `evento_patrulla_busqueda`: `salir_escena` se mantiene en `fin.verbos`. Es un pseudo-verbo (vocabulario, sección 5c).
  - 7 eventos de combate: `duracion.verbo: "huir_o_rendirse"` pasa a `duracion.verbos: ["huir", "rendirse"]`.
- `evento_lucha_caseta` tenía `fin.verbos` vacío. Se completó con `["huir", "rendirse"]`, igual que su duración y que la regla "un combate termina cuando el jugador huye o se rinde".
- `disparo` acepta `escena` (una) o `escenas` (lista). `duracion` acepta `verbo` (uno) o `verbos` (lista).
- `salir_escena` se cumple cuando el jugador cambia de escena por cualquier verbo. La implementación queda para el bloque 3.
- La clave `resultado_<verbo>_<resultado>` se resuelve por id de verbo, con la tabla de `vocabulario-v1.md` sección 5. Por eso `resultado_calmar_la_situacion_exito` va a `plantillas.intencion_calmar.exito`.
- `cargarContenido.js` usa `node:fs`. La carga en el navegador (por `fetch`) queda para la integración con el HTML: sin verificar.

## Bloque 1 — referencias por id
- `disparo.objetivo` es un id de NPC. Se corrigieron los dos casos: `evento_cierre_taberna` (`naela_tabernera`) y `evento_lucha_caseta` (`dario_guardia`).
- Toda referencia a un id (escena, NPC, objeto, evento, verbo, destino, conocimiento) es un error del validador y bloquea. Los `avisos` quedan solo para observaciones que no son referencias; hoy hay una: fin por acción sin verbos.
- Si el valor coincide con el nombre de una escena, NPC, objeto o evento (sin distinguir tildes ni mayúsculas), el error dice cuál es el id. Para NPCs también se reconoce el primer nombre.
- `efectos[].conocimientoId` tiene que ser el `id` de un conocimiento del NPC del mismo efecto.

## Bloque 1 — ids de conocimientos y marcas
- `requiereMarca` de Elia y Oren pasó de `Marca "leyó"` a `leyo`, el id de `reglas.marcas`.
- Cada conocimiento de NPC tiene `id` con el formato `conocimiento_<nombre>_<n>` (por ejemplo `conocimiento_maren_1`). Hollis mantiene `conocimiento_sendero_sin_vigilancia`. Hoy cada NPC tiene un solo conocimiento, así que todos los nuevos terminan en `_1`.
- En los 12 objetos narrativos, `conocimientoDesbloquea` pasó de texto a id. Resultado: los 12 tienen equivalente y ninguno quedó sin asignar, porque cada NPC asociado tiene un único conocimiento y el texto del objeto era una versión corta del mismo. No se inventó ningún conocimiento.
- Otras referencias a conocimientos, revisadas y sin cambios: el efecto `habilita` de `evento_tormenta_verano` y `reglas.conocimientoSenderoSinVigilancia` usan `conocimiento_sendero_sin_vigilancia`, que existe en Hollis.
- El texto corto que tenía cada objeto se perdió al pasar a id. El texto para el jugador es el `contenido` del conocimiento del NPC.
- Validador, todo como error:
  - Cada conocimiento tiene `id` con prefijo `conocimiento_`, único en todo el contenido.
  - `requiereMarca` existe en `reglas.marcas`.
  - `conocimientoDesbloquea` es el id de un conocimiento del `npcAsociado` del mismo objeto. Es obligatorio en los objetos narrativos.
  - `reglas.marcas.*` (`activaCon.verbo`, `activaCon.escenaId`, `usadaPor`) y `reglas.conocimientoSenderoSinVigilancia` referencian ids existentes.
- El validador no exige el formato `conocimiento_<nombre>_<n>` completo, solo el prefijo, para admitir el id de Hollis.

## Bloque 2 — comprensión del texto libre
Resultado: `narrador/comprension.js` implementa `docs/comprension-v1.md`. Los alias de NPC están en el contenido (campo `alias`) y el validador los revisa.

### Alias
- El validador exige `alias` en cada NPC: lista no vacía de textos no vacíos, sin repetidos dentro del NPC. Dos NPCs no comparten alias si pueden coincidir en una escena. Las escenas posibles de un NPC son su escena inicial más los caminos de su movimiento.
- Los alias se comparan sin tildes ni mayúsculas.

### Texto de las reformulaciones (falta en el contenido)
- `comprension.js` no escribe texto para el jugador. Devuelve un `motivo` y, si hace falta, los nombres a mostrar (`datos.nombres`).
- Los textos de `comprension-v1.md` ("¿Con quién querés hablar?", "No lo ves por acá.", "¿A qué ciudad querés ir?", etc.) no están en `plantillas` del contenido. Por la regla de no escribir narración fuera de `plantillas`, no se pusieron en el código. Hay que agregarlos al contenido antes del bloque 4, con un bloque por motivo.
- Motivos: `no_entendido`, `intencion_ambigua`, `sin_npcs`, `falta_npc`, `npc_ambiguo`, `npc_ausente`, `sin_objetos`, `falta_objeto`, `objeto_ambiguo`, `falta_destino`, `destino_ambiguo`.
- Tampoco hay plantilla para pedir que se repita la segunda intención de una frase. `decidir` la informa en `repetirIntencionId`.

### Typos e intención
- La tolerancia se calcula con el largo de la palabra más corta de las dos (la escrita y la del catálogo). Una palabra de 3 letras nunca coincide con una de 4 por typo.
- La distancia es Levenshtein simple: cambiar dos letras de lugar cuenta 2.
- Formas que comparten palabras de la frase compiten entre sí, con este orden: más palabras; después, menos typos; después, la forma completa (con sus palabras vacías) presente en la frase; después, la que aparece primero. El segundo criterio hace que una coincidencia exacta le gane a una con typo ("ayudar a Maren" es ayudar, no "saludar a" con dos letras cambiadas; corregido en el bloque 3b). El tercero separa "irme" (retirarse) de "irme a" (viajar), que sin palabras vacías son iguales.
- Formas que no comparten palabras son dos intenciones en la misma frase: se responde a la primera por posición y la segunda va en `repetirIntencionId`.
- Si dos intenciones distintas empatan en todo, se reformula (`intencion_ambigua`). Con el catálogo actual no pasa.
- "me voy a Halenor" se entiende como retirarse, porque "me voy" es una forma de retirarse en el catálogo.

### NPC
- Los términos de un NPC son las palabras de su nombre y sus alias. No se usan las palabras del rol, porque chocan con nombres de escenas y objetos ("Archivo", "aduana").
- Dos o más NPCs presentes nombrados en la frase: se reformula, aunque uno coincida exacto y el otro por typo.
- "No lo ves por acá" (`npc_ausente`): solo si el ausente está escrito exacto. Con tolerancia, palabras comunes se confunden con nombres de NPCs que no están.
- `hablar_con` con un solo NPC presente y sin nombre también pregunta (`falta_npc`), como dice la sección 4.1.
- Sin NPC presente, se ejecutan sin objetivo `observar`, `defender` y `distraer` (los que el contenido marca "NPC opcional"). `ayudar`, `negociar`, `presionar`, `atacar` y `emboscar` reformulan (`sin_npcs`).
- `usar` toma un NPC solo si el jugador lo nombra.
- Con dos o más presentes se llama a `resolverNpcObjetivo` de la beta (`core/orquestador`), con los NPCs adaptados a su forma. No se le pasa el motor de eventos, así que la regla "fuente de amenaza" no se aplica todavía; queda para el bloque 3.

### Objeto
- Un objeto está nombrado si la frase trae la primera palabra de su nombre ("pan", "mapa", "espada"). Entre varios nombrados gana el que coincide con más palabras del nombre; si empatan, se reformula.
- `examinar` sin objetos aplicables se ejecuta sobre la escena (el contenido dice "objeto o escena").
- `atacar`: sin armas ataca sin arma; con varias y ninguna nombrada usa la primera de la lista que recibe. `comprar`: con varios y ninguno nombrado reformula; sin ninguno reformula.
- `negociar` toma un objeto solo si el jugador lo nombra.
- Quién arma la lista de objetos aplicables (escena e inventario, por verbo) es el motor del bloque 3.

### Viajar
- Destinos: las 3 escenas de camino con `viajeHoras` y las 3 ciudades (`ciudad_*`). Los lugares de camino (lago, puente, cruce) no son destino de viajar.
- Un camino se reconoce por su nombre completo ("camino del norte") o por su dirección sola si está escrita exacta ("norte"). Una ciudad, por su nombre, con tolerancia a typos.
- El nombre de una escena de ciudad ("Mercado Circular") no vale como destino. Por eso no hay forma de pasar por texto entre dos escenas de la misma ciudad. A revisar en el bloque 3.
- Si el destino es alcanzable desde la escena actual lo decide el motor del bloque 3.

### Decisión
- En la segunda pasada del turno (`reformulacionPrevia`), todo lo que en la primera sería reformulación pasa a IA, incluidas las respuestas como "No hay nadie con quien hablar acá".
- El texto del jugador nunca vuelve en la salida de `decidir`.

## Bloque 2.5 — reformulaciones y destinos dentro de la ciudad
Resultado: los 11 motivos de `decidir()` y `repetir_segunda` tienen texto en `plantillas.reformulacion`. `viajar` acepta escenas de ciudad, con 1 hora de costo dentro de la misma ciudad. Esto reemplaza dos notas del bloque 2: "Texto de las reformulaciones (falta en el contenido)" y "El nombre de una escena de ciudad no vale como destino".

### Reformulaciones
- `plantillas.reformulacion` tiene una clave por motivo y cada clave es una lista de frases. No tiene `exito`, `fallo` ni `neutro`.
- El bloque `reformulacion` no cuenta entre los 26 bloques de plantillas de resultado. `plantillas` tiene 27 claves.
- Los motivos están en `narrador/motivos.js`, para que el validador y la comprensión usen la misma lista.
- Placeholder nuevo: `{nombres}`, la lista de nombres a mostrar. Si una clave tiene una frase con `{nombres}` y otra sin él, la narración (bloque 4) usa la que corresponda según haya nombres o no.
- Textos tomados de `comprension-v1.md`:
  - `no_entendido`: "No entendí bien. ¿Podés decirlo de otra forma?"
  - `falta_npc`: "¿Con quién querés hablar?"
  - `npc_ausente`: "No lo ves por acá."
- Textos escritos para este bloque, a revisar por Tomás:
  - `intencion_ambigua`: "No me quedó claro qué querés hacer. ¿Podés decirlo de otra forma?"
  - `falta_npc` (con nombres): "¿Con cuál: {nombres}?" El documento dice "¿Con cuál de los dos: Maren o Serel?", que no sirve con tres presentes.
  - `npc_ambiguo`: "¿A cuál te referís: {nombres}?"
  - `falta_objeto`: "¿Cuál querés?" y "¿Cuál querés: {nombres}?"
  - `objeto_ambiguo`: "¿Cuál de estos: {nombres}?"
  - `destino_ambiguo`: "¿A dónde querés ir: {nombres}?"
  - `repetir_segunda`: "¿Me repetís lo segundo?"
- Textos del documento que se cambiaron, porque el motivo vale para más de un verbo:
  - `sin_npcs`: "No hay nadie acá." El documento dice "No hay nadie con quien hablar acá.", pero el motivo también sale con ayudar, negociar, presionar, atacar y emboscar.
  - `sin_objetos`: "No tenés nada para eso." El documento dice "No tenés nada para usar.", pero el motivo también sale con comprar.
  - `falta_objeto`: el documento dice "¿Qué querés usar?", pero el motivo también sale con examinar y comprar.
  - `falta_destino`: "¿A dónde querés ir?" El documento decía "¿A qué ciudad querés ir?"; ahora el destino también puede ser una escena.
- Si se quieren los textos exactos del documento, hay que separar esos motivos por verbo.

### Destinos dentro de la ciudad
- Una escena de ciudad se reconoce por la primera palabra de su nombre (mercado, archivo, plaza, taberna, biblioteca, aula). Las escenas no tienen alias en el contenido y no se agregaron.
- "Ir a la plaza" ahora viaja a la Plaza de los Cambistas. El caso de la sección 7 de `comprension-v1.md` se cambió por "Ir al lago", que sigue sin ser destino.
- Si la frase nombra una escena y su propia ciudad, gana la escena. Con una escena y otra ciudad, se reformula.
- `narrador/viaje.js` clasifica el viaje: `intra_ciudad` (cuesta `reglas.viajeHorasIntraCiudad`), `por_camino` (las horas las calcula el bloque 3 con `reglas.viajeHorasPorCamino`) y `misma_escena` (el destino es la escena actual; 0 horas).
- Qué pasa cuando el destino es la escena actual, y si un destino por camino es alcanzable, lo decide el motor del bloque 3.
- El validador exige `reglas.viajeHorasIntraCiudad` como número mayor que 0.

## Bloque 3a — reloj, eventos y estado de escena
Resultado: `narrador/reloj.js`, `narrador/eventos.js`, `narrador/estadoEscena.js` y `narrador/viaje.js`. Los 70 eventos del contenido se activan y se cierran sin error. No hay turnos, efectos sobre NPCs ni movimiento de NPCs: eso es el bloque 3b.

### Reloj
- La hora inicial se lee de `reglas.relojInicial`, que es un texto ("mañana (08:00) del primer día"): se toma el `HH:MM` que trae.
- `avanzar` acepta fracciones de hora y redondea al minuto. No acepta horas negativas.
- "El reloj llega a una hora" significa que esa hora cae después del reloj anterior y hasta el reloj nuevo, incluido. Vale para saltos de varios días.

### Eventos
- Un evento activo es de una escena: `{ id, escenaId, turnosRestantes, horaFin }`. El mismo evento puede estar activo en dos escenas a la vez.
- `horaFin` es un reloj `{ dia, hora }`, no un `HH:MM` suelto como sugiere `cierre-diseno-v1.md`. Con viajes de 36 a 52 horas, la hora sola no dice de qué día es.
- Disparo por azar: solo en la escena donde está el jugador, si es una escena del evento. Se consulta el `rng` una vez por evento candidato, en el orden del contenido.
- Disparo por hora: en todas las escenas del evento, esté donde esté el jugador. Si el reloj saltó y el evento ya habría terminado dentro del salto, no se activa.
- La hora inicial de la partida (08:00) dispara eventos solo si se pide con `incluirInicio`. Lo usa el primer turno.
- Disparo por acción: en la escena donde el jugador actuó. Respeta `disparo.objetivo` (el NPC de la acción) y `disparo.escena` o `disparo.escenas`.
- Si hay varios candidatos y queda un solo lugar en la escena, entra el primero en el orden del contenido.
- Un evento no se dispara dos veces en la misma escena mientras está activo, ni en el mismo turno en que se cerró.
- En cada turno primero se cierran eventos y después se disparan. Un cierre libera lugar para un disparo en el mismo turno.
- Fin por tiempo: los turnos se descuentan a todos los eventos activos, también a los de escenas donde no está el jugador. El turno en que se dispara no cuenta.
- Fin por acción: el verbo tiene que ejecutarse en la escena del evento y no terminar en `fallo`. Un huir fallido no termina el combate.
- Fin por acción con duración en turnos (`evento_deuda_impaga`): termina por lo que pase primero.
- Los verbos de cierre salen de `fin.verbos` y de `duracion.verbo` o `duracion.verbos`.
- `salir_escena` se cumple cuando el jugador termina el turno en una escena distinta de aquella donde actuó.
- Un evento activo cuyo id ya no está en el contenido se cierra.
- Los efectos de los eventos (`disposicion`, `bloqueo`, `habilita`, `precio`) no se aplican todavía. Queda para el bloque 3b.
- El validador ahora revisa la forma de cada evento: `disparo.p` entre 0 y 1, horas en `HH:MM`, verbo en el disparo por acción, `duracion.tipo` válido, y que el fin por hora o por tiempo tenga con qué calcularse.

### Estado de escena
- Vecinas de una escena: las de su lista `salidas`. Se mira el estado propio de la vecina (sus eventos), no el que ya subió por otra vecina. El efecto no se encadena.
- En el contenido, las escenas de ciudad no tienen a los caminos en `salidas` (el mercado solo sale al archivo), pero los caminos sí tienen a las ciudades. Por eso un evento grave en un camino no sube el estado de la ciudad, y uno en la ciudad sí sube el del camino. No se corrigió; a revisar.

### Viaje
- Destino igual a la escena actual, o la ciudad donde ya está el jugador: 0 horas y motivo `ya_en_destino`. El texto es "Ya estás en {lugar}.", en `plantillas.reformulacion.ya_en_destino`. No es un motivo de `decidir()`: lo usa el motor.
- Para armar la ruta, las salidas valen en los dos sentidos (por lo dicho arriba: las ciudades no listan los caminos).
- Las horas de un viaje por camino son la suma de `reglas.viajeHorasPorCamino` de cada camino de la ruta con menos horas. Entre dos ciudades siempre hay un camino directo: 36, 44 o 52.
- Cuenta también el camino de partida y el de llegada. Consecuencias, a revisar:
  - Ir de una ciudad a su camino cuesta las horas completas del camino (36 al camino del norte).
  - Seguir desde ese camino a la ciudad cuesta otra vez las horas completas. Detenerse en el camino duplica el costo: 72 horas en lugar de 36.
  - Ir de un camino a un lugar de camino (el lago) cuesta las horas del camino.
  - Alternativa simple si no se quiere eso: cobrar la mitad de las horas al entrar al camino y la otra mitad al salir.
- Viajar a una ciudad llega a la escena de esa ciudad donde desemboca el camino (a Lareth por el norte se llega a la plaza). Viajar a una escena de otra ciudad llega directo a esa escena, sin sumar la hora dentro de la ciudad.
- `sin_ruta`: el destino no existe o no hay cómo llegar. Con el contenido actual no pasa.
- Si un evento bloquea el viaje (`evento_cierre_puerta`), lo decide el bloque 3b.

## Bloque 3a.1 — grafo simétrico y costo de viaje por camino
Resultado: las salidas del contenido son simétricas y el viaje cobra cada camino una sola vez. Esto reemplaza, del bloque 3a, la nota de "Estado de escena" sobre las ciudades sin caminos en `salidas` y las notas de "Viaje" sobre el costo por camino.

### Grafo simétrico
- Cada escena de ciudad lista en `salidas` los caminos que la conectan: mercado (norte), plaza (norte y este), archivo (sur), biblioteca (sur), aula (este). La taberna sigue conectada solo a la plaza.
- Los tres caminos ya listaban a sus ciudades y a su lugar de camino; no cambiaron.
- El validador exige salidas simétricas: si A lista a B, B lista a A. También rechaza una escena que se lista a sí misma y una salida repetida. Son errores que bloquean.
- La regla de vecina ahora vale en los dos sentidos entre ciudad y camino: un evento grave en el camino del norte sube un nivel el mercado, la plaza y el lago.
- La ruta de un viaje sigue las `salidas` tal como están. Ya no hace falta tomarlas en los dos sentidos.

### Costo de viaje por camino
- Cada tramo entre un camino y una escena de ciudad cuesta la mitad de las horas de ese camino. Los tramos dentro de una ciudad y entre un camino y su lugar de camino no suman horas en un viaje por camino.
- Cruzar un camino de ciudad a ciudad usa sus dos tramos: las horas completas, una vez (36, 44 o 52).
- Detenerse en el camino y seguir: mitad al entrar y mitad al salir. Ardenhall a camino del norte, 18; camino del norte a Lareth, 18; total 36, igual que el viaje directo.
- Volver al punto de partida desde el camino: también la mitad. Ardenhall a camino del norte y vuelta a Ardenhall, 18 + 18.
- La mitad se redondea hacia arriba en horas. El cruce completo cobra las horas exactas del camino aunque sean impares. Con el contenido actual las tres son pares.
- Una ruta que pasa por más de un camino suma cada camino una vez, completo si lo cruza y por la mitad si empieza o termina en él. Del camino del norte a Halenor: 18 + 44 = 62, por Lareth.
- Se elige la ruta con menos horas. Con las mismas horas, la que pasa por menos escenas.
- El costo no depende de por dónde entró el jugador al camino: no se guarda el origen del viaje.
- Los lugares de camino (lago, puente, cruce) están sobre su camino: ir del lago al camino del norte cuesta 0 horas, y del lago a Lareth o a Ardenhall, 18. Que moverse entre el camino y su lugar no gaste reloj queda a revisar en el bloque 3b.
- Viajar desde una ciudad a otra saliendo de la escena que no toca el camino (del archivo a Lareth) no suma la hora dentro de la ciudad.

## Bloque 3b — resolver y turno
Resultado: `narrador/resolver.js`, `narrador/turno.js` y `narrador/estado.js`, con sus tests. El turno devuelve resultados estructurados, sin texto. `turno.js` usa `npcs.js`, `conocimientos.js`, `efectosEventos.js` y `movimientoNpcs.js`; esos cuatro módulos ya están escritos y con tests, y su revisión queda para la próxima sesión.

### Viaje
- `reglas.viajeHorasLugarCamino = 1`: cada tramo entre un lugar de camino (lago, puente, cruce) y su camino cuesta 1 hora. El validador lo exige. Del lago a Lareth: 1 + 18 = 19. Reemplaza la nota del bloque 3a.1 que dejaba ese tramo en 0.
- Los lugares de camino ahora son destino de `viajar` por texto, por la primera palabra de su nombre ("ir al lago"). Sin eso no había forma de llegar por texto a Ysolde, Darío ni Oren. El caso "no es destino" de `comprension-v1.md` pasó a ser "ir a la casa".

### Resolver
- Horas de reloj por acción que no es viaje: 1. No está en el contenido ni en los documentos; es la constante `HORAS_POR_ACCION` de `resolver.js`. Sin esto el reloj solo avanzaría al viajar y los eventos por hora casi no se dispararían. A revisar: conviene pasarla a `reglas`.
- Una reformulación y un turno que pasa a IA no gastan reloj. Viajar al lugar donde ya se está, tampoco.
- Con chequeo (60% de éxito): los 9 verbos de `transiciones`, más huir, ocultarse, avanzar con cautela, explorar, observar y examinar un objeto.
- Sin chequeo: trabajar (éxito), comprar (éxito o fallo según el dinero), usar (éxito), viajar (éxito, o fallo si está bloqueado o no hay ruta), leer (éxito si activa la marca; si no, neutro), examinar sin objeto (neutro), descansar, retirarse, abortar y rendirse (neutro).
- Comprar: el objeto tiene que venderse en la escena actual. Se paga en la moneda del precio, sin conversión. El jugador no tiene oro y nada en el contenido da plata después del inicio: el arco corto (1 de oro) no se puede comprar, y la plata inicial (0 a 5) no se repone. A revisar.
- Usar: vale para cualquier objeto del inventario y para un objeto narrativo de la escena donde aparece (los narrativos no se compran ni se levantan). Gasta un uso si el objeto tiene usos; al llegar a 0 sale del inventario. La brújula no tiene usos y no se gasta.
- Un objeto del inventario que acompaña a otro verbo con chequeo (atacar con un arma, negociar ofreciendo algo) también gasta un uso. Examinar no gasta.
- Huir con éxito mueve a la primera escena de `salidas` de la escena actual y cuesta lo que diga `reglas.costoHorasPorVerbo.huir` (0), no el costo de viaje.
- Un viaje bloqueado o sin ruta falla, no mueve y no gasta reloj.
- Una acción bloqueada por un evento falla sin chequeo y sin efectos sobre el NPC.

### Turno
- Estado: el de `cierre-diseno-v1.md` sección 5 más `reformulacionPendiente`. La posición de los NPCs no se guarda: sale del reloj.
- Al crear el estado se disparan los eventos por hora de las 08:00 (hoy, la feria de intercambio). El azar empieza en el primer turno.
- Botones: usan las mismas reglas de parámetros que el texto. Un botón nunca pasa a IA: siempre reformula.
- Usar un objeto narrativo se lo muestra a su NPC asociado si está en la escena, sin nombrarlo. Si revela, el resultado es éxito; si no, fallo.
- Hablar con éxito revela el primer conocimiento del NPC que cumpla sus condiciones, contando la relación ya actualizada en ese turno.
- Negociar "con valor" (15 en vez de 10): cuando el jugador ofrece un objeto que tiene a mano.
- Calmar la situación no elige NPC por texto: solo actúa sobre un NPC si llega por botón con `npcId`.
- Un evento por hora con duración en turnos que se habría disparado durante un salto de reloj no se activa si pasaron más horas que sus turnos (cada turno se cuenta como una hora).
- `resolverNpcObjetivo` sigue sin la regla "fuente de amenaza" de la beta.

## Decisiones tras la revisión del bloque 3b
- Revisados `npcs.js`, `conocimientos.js`, `efectosEventos.js` y `movimientoNpcs.js`: sin errores.
- Costo de reloj por acción: está en el contenido, en `reglas.costoHorasPorVerbo`. Ya no hay una constante de 1 hora en el código. Ayudar, usar y leer cuestan 1; descansar y trabajar, 4; el resto, 0.
- `viajar` no va en `costoHorasPorVerbo`: su costo sale de la ruta. Un viaje que falla (bloqueado o sin ruta) cuesta 0.
- El validador exige que todo verbo de intenciones, salvo `viajar`, tenga costo; que cada costo sea un entero mayor o igual que 0; y que no haya verbos que no existen.
- Con costo 0 el reloj no avanza: los eventos por turnos y por azar siguen corriendo turno a turno; los de hora y el movimiento de NPCs, solo cuando avanza el reloj.
- Temor: eliminado del código, del estado y del contenido. Calmar la situación con éxito sube la disposición en 1 (`disposicionExito: 1` en `transiciones`); con fallo no la cambia. El delta de relación de calmar (10 / 0) queda como estaba en el contenido.
- Oro y plata: el jugador no los consigue en v1. Trabajar paga solo bronce. El arco corto (1 de oro) no se puede comprar y la plata inicial no se repone.

### Confirmado
- viajar queda fuera de costoHorasPorVerbo; su costo sale de la ruta y un viaje fallido cuesta 0.
- calmar_la_situacion con éxito: +10 de relación y +1 de disposición.

## Bloque 4: narración por plantillas
- `narrador/narracion.js` no escribe texto propio: elige una plantilla, completa los placeholders y, si hay más de una frase, las une con un espacio.
- La ventana de aperturas no se guarda en este módulo: `narrarTurno` la recibe y devuelve la nueva (últimas 5). Dónde se guarda lo decide el contrato público (bloque 7). `turno.js` no llama a la narración todavía.
- Apertura: la primera palabra del texto ya completado, en minúsculas y sin signos. Si la plantilla empieza con `{npc}`, la apertura es la primera palabra del nombre del NPC.
- Cada intención tiene 3 plantillas en exito y 3 en fallo. Si todas las aperturas posibles están en la ventana, se usa la que se usó hace más tiempo.
- Valores: `{npc}` y `{objeto}` son el `nombre` del contenido, tal cual (sin artículo: "Usás Antorcha"). `{lugar}` es el destino en un viaje y, en el resto, la escena donde se actuó. `{conocimiento}` es el `contenido` del conocimiento revelado en el turno. `{nombres}` es la lista unida con ", ".
- Un valor vacío, con llaves o de un placeholder desconocido cuenta como faltante.
- Si ninguna plantilla de la clave se puede completar (o la clave no existe), se usa `plantillas.reformulacion.no_entendido` y el resultado lo marca con `respaldo: true`.
- Mostrar un objeto narrativo a su NPC (usar, con NPC) usa el bloque `mostrar_narrativo` en vez de `intencion_usar`.
- Si en el turno se reveló un conocimiento, después de la frase de la acción va una de `revelar_conocimiento.exito`. Las plantillas `fallo` y `neutro` de `revelar_conocimiento` no se usan por ahora.
- Viajar a donde ya se está usa `plantillas.reformulacion.ya_en_destino`. Si quedó una segunda acción sin hacer, al final va `repetir_segunda`.
- Solo la primera frase cuenta como apertura; las siguientes evitan repetirla.
- Turnos `ia` y `error`: sin texto (null). El texto de la IA es del bloque 5.
- No se narran todavía los eventos disparados o cerrados, el movimiento de NPCs ni los motivos de fallo (sin dinero, bloqueado): el contenido no trae plantillas para eso.

### Tercera plantilla por intención
- Las 48 frases agregadas (una de éxito y una de fallo por cada una de las 24 intenciones) son las aprobadas por Tomás. Se copiaron tal cual. `neutro` no se tocó.
- Validador: toda intención tiene al menos 3 plantillas distintas en exito y en fallo (error que bloquea).

### Aperturas distintas por clave
- Validador: dentro de exito y dentro de fallo de cada intención, la apertura (primera palabra, sin signos ni mayúsculas) no se repite. Es error que bloquea. Una plantilla que empieza con un placeholder tiene ese placeholder como apertura. `neutro` y los bloques sin intención no entran en la regla.
- Frases cambiadas, dictadas por Tomás. Son 17 reemplazos en 16 claves (`intencion_ocultarse.exito` lleva dos):
  - `intencion_hablar_con.exito`: "{npc} deja lo que hace y te presta atención." → "Dejando lo que hace, {npc} te presta atención."
  - `intencion_hablar_con.fallo`: "{npc} responde seco y se da vuelta." → "Con tono seco, {npc} se da vuelta."
  - `intencion_observar.fallo`: "Mirás a tu alrededor, pero no ves nada que llame la atención." → "Mirando alrededor, no ves nada que llame la atención."
  - `intencion_comprar.exito`: "Pagás el precio justo y {objeto} es tuyo." → "Con el precio justo, {objeto} es tuyo."
  - `intencion_ayudar.fallo`: "{npc} te agradece el gesto, aunque no lo necesita." → "Agradecido, {npc} te dice que no hace falta."
  - `intencion_presionar.exito`: "{npc} te obedece a regañadientes." → "A regañadientes, te obedece {npc}."
  - `intencion_presionar.fallo`: "{npc} se planta y no se deja empujar." → "Se planta {npc} y no se deja empujar."
  - `intencion_retirarse.fallo`: "Querés irte, pero todavía hay algo que te retiene." → "Todavía hay algo que te retiene, así que no te vas."
  - `intencion_huir.fallo`: "Intentás escapar, pero el suelo resbala y no avanzás." → "El suelo resbala y no avanzás."
  - `intencion_emboscar.fallo`: "La trampa se activa tarde y {npc} la evita." → "Tarde, {npc} evita la trampa."
  - `intencion_ocultarse.exito`: "Te quedás quieto detrás de algo y pasás desapercibido." → "Quieto detrás de algo, pasás desapercibido."
  - `intencion_ocultarse.exito`: "Te deslizás detrás de algo y nadie te ve." → "Deslizándote detrás de algo, nadie te ve."
  - `intencion_avanzar_cautela.fallo`: "Avanzás con cuidado, pero una piedra suelta te delata." → "Una piedra suelta te delata al avanzar."
  - `intencion_abortar.exito`: "Das marcha atrás y dejás el plan a un lado." → "Sin problemas, dejás el plan a un lado."
  - `intencion_abortar.fallo`: "Querés abortar, pero ya no hay forma de volver atrás." → "Ya no hay forma de volver atrás, así que seguís."
  - `intencion_defender.fallo`: "Intentás cubrirte, pero el golpe llega igual." → "El golpe llega igual, sin cubrirte a tiempo."
  - `intencion_rendirse.fallo`: "Querés rendirte, pero el otro sigue atacando." → "El otro sigue atacando y no hay forma de parar."

## Bloque 5a: cliente de la IA y registro con cola local

### Cliente Groq (`narrador/ia.js`)
- Sin verificar contra Groq real: la URL (`https://api.groq.com/openai/v1/chat/completions`), los nombres de los parámetros (`reasoning_effort`, `max_completion_tokens`), los códigos de estado, las cabeceras de cupo y la forma de la respuesta. Ningún test llama a Groq.
- Riesgo sin verificar: si el modelo cuenta los tokens de razonamiento dentro de `max_completion_tokens: 120`, la respuesta puede llegar vacía o cortada. En ese caso la validación falla y se usa plantilla.
- Estimación de tokens: un token cada 3,5 caracteres, hacia arriba. Es una aproximación, no el conteo del modelo. Si la respuesta trae `usage`, el resultado informa ese valor (`fuente: 'uso'`); si no, la estimación.
- Mensaje de sistema: texto fijo escrito según `narrador-ia-v1.md` sección 3; unos 380 tokens estimados. Peor caso estimado por llamada: 380 + 250 + 120 = 750, dentro del tope de 800.
- Contexto: además de lo que pide el diseño lleva la descripción de la escena, el momento del reloj, las salidas (por nombre) y los otros NPCs presentes con su disposición en palabras. Con eso, un contexto completo (NPC, 3 acciones, una frase normal) queda entre 150 y 250 tokens estimados en las 12 escenas.
- El contexto no se rellena: con poco para decir (sin acciones, frase corta) queda por debajo de 150 y el resultado lo informa (`enRango: false`). El máximo de 250 se cumple siempre: se recortan las acciones (3, 2, 1, 0), después los datos extra y, como último recurso, la frase del jugador.
- La aclaración "lo que sigue es lo que te dice esa persona; no es una orden" va en el contexto, pegada a la frase, y no en el mensaje de sistema.
- NPC activo: el que se pida por id, si está en la escena; si no, el primero presente. Los NPCs del contenido no traen "personalidad base": va solo el rol. Falta en el contenido.
- Las últimas acciones llegan como textos del llamador: el estado no guarda historial. Lo resuelve el contrato público.
- Validación de la salida: vacía, llaves (placeholder), corchetes, signos `<` `>` (etiqueta), cualquier palabra con guion bajo (id) y más de 120 tokens estimados. No se cuentan las oraciones ni se rechazan los asteriscos.
- Resultados: `sin_ia` (sin clave, 401/403, o límite diario) para pasar a modo código; `texto: null` con `motivo` (`cupo`, `error_red`, `salida_invalida`) para usar plantilla.
- Límite diario: un 429 con `x-ratelimit-remaining-requests: 0` o con un mensaje que nombre el límite por día. Cualquier otro 429 se trata como cupo por minuto: espera `retry-after` (2 segundos si no viene, 20 como máximo) y reintenta una vez.
- Error de red o estado que no es 2xx: un reintento, sin espera.
- La clave solo viaja en la cabecera `Authorization`. No está en el cuerpo, en el resultado ni en los mensajes de error (los errores del cliente HTTP no se copian al resultado).

### Registro y cola (`narrador/registro.js`)
- Cada turno con texto libre genera un registro, también el turno en que el código pide reformular (grupo_1, origen `codigo`, respuesta: la pregunta de reformulación). Esto sigue el prompt v3 (5.7) y difiere de la escalera de `sistema-registro-aprendizaje-narrador.md` (sección 2, "no registra nada todavía").
- `intento_reformulacion: true` en el turno que responde a una reformulación.
- Un turno que pasó a la IA va a grupo_2 con `intencion_detectada: null`; origen `ia`, o `codigo` si se mostró una plantilla.
- Los botones no generan registro.
- `contaminacion` va siempre, en `true` o `false`. Se detecta con las tres frases del diseño, sin tildes ni mayúsculas y por palabra entera: "ignora", "responde como", "sos un", "sos una". Solo marca el registro.
- `fecha`: ISO en UTC, sin milisegundos ni zona. `ultimos_turnos`: como mucho los últimos 3 textos. `escena` y `estado_escena`: los de antes del turno.
- Un registro solo lleva los 14 campos de su formato; un dato de más que llegue se ignora.
- Cola: en memoria, envía en orden y de a uno; frena en el primer fallo y deja el resto. Se pierde si se cierra la pestaña. La numeración de registros la lleva la cola y arranca en 1 por sesión; cómo se continúa entre sesiones queda para 5b/5c.
- Envío de prueba: `enviadorANube` guarda los registros de una partida en un documento `registros_<código>` con el contrato de la nube en memoria de la beta. Reenviar un registro que ya está no lo duplica. La forma real en Firestore es del bloque 5c.
- Ni `ia.js` ni `registro.js` están conectados a `turno.js`: los une el contrato público.

### Ajustes del bloque 5a: límites de tokens y registro de reformulación
- La llamada manda `max_completion_tokens: 400`, para dejar lugar al razonamiento del modelo. Sin verificar: no se comprobó en la documentación de Groq que ese sea el nombre del parámetro para `openai/gpt-oss-120b`.
- El límite de 120 tokens de salida se aplica sobre el texto final: 600 caracteres como máximo y de 1 a 3 oraciones. Si se pasa, el texto se descarta y el llamador usa plantilla. Una oración es un tramo que termina en punto, signo de cierre o puntos suspensivos; el último tramo cuenta aunque no cierre.
- El mínimo de 150 tokens de contexto ya no es requisito. Se mantiene el máximo de 250. El contexto no se rellena.
- Con 400 tokens de salida posibles, el uso real de una llamada puede pasar el tope de 800 (380 + 250 + 400). El resultado lo informa en `tokens.dentroDelTope` cuando la respuesta trae `usage`; la estimación solo cuenta el texto final. A medir con una clave real.
- Registro: `ruta` suma el valor `reformulacion`. El turno en que el código pide reformular genera un registro con esa ruta, origen `codigo` y la pregunta de reformulación como respuesta. Motivo: todo dato llega a Firestore, también las frases que el código no entendió a la primera, que son las que sirven para mejorar la comprensión.
- El turno que resuelve la frase después va a `grupo_1` (o `grupo_2` si pasó a la IA) con `intento_reformulacion: true`.
- Se cambiaron `docs/vocabulario-v1.md` (sección 13) y la escalera de `docs/sistema-registro-aprendizaje-narrador.md` para decir lo mismo. Esto reemplaza la nota anterior sobre la diferencia con la escalera.

### Tope de tokens por llamada, cerrado a 800
- Cálculo: 350 de mensaje de sistema + 250 de contexto + 200 de salida = 800. `TOPE_TOKENS_LLAMADA = 800`.
- La llamada manda `max_completion_tokens: 200`. Sigue sin verificar en la documentación de Groq que ese sea el nombre del parámetro para `openai/gpt-oss-120b`. Esto reemplaza el 400 de la nota anterior.
- Mensaje de sistema: máximo 350 tokens estimados. Medía 380; se acortó sin cambiar las reglas y ahora mide 348 (un token cada 3,5 caracteres).
- Al cargar `narrador/ia.js` se comprueba el presupuesto: si el mensaje de sistema pasa de 350, o si 350 + 250 + 200 supera el tope, el módulo lanza un error y no carga. No se comprueba en cada llamada.
- Contexto: máximo 250 tokens estimados. Si se pasa con 3 acciones, se recorta a las últimas 2. Si sigue pasando, falla: `armarContexto` lanza `ErrorDeContexto` y `pedirRespuestaIA` no llama a Groq y devuelve `texto: null` con motivo `contexto_largo`, para que el llamador use plantilla. Ya no se recortan los demás datos ni la frase del jugador. Esto reemplaza la nota anterior sobre el recorte.
- Consecuencia: una frase del jugador muy larga (del orden de 300 caracteres o más, según la escena) no llega a la IA y se responde con plantilla.
- Los tokens reales (`usage` de la respuesta) se comparan con el tope de 800 cuando haya una clave real; hasta entonces todo es estimación. El resultado de cada llamada ya informa `tokens.total` y `tokens.dentroDelTope`.
- El texto final sigue limitado a 600 caracteres y 1 a 3 oraciones.

## Bloque 5b: contrato público (`narrador/index.js`)

### Frase del jugador en la IA
- La frase del jugador se recorta a 240 caracteres antes de armar el contexto de la IA. El registro guarda la frase completa.
- El motivo `contexto_largo` ya no se da por una frase larga: solo queda para un contexto que sigue pasando de 250 tokens con 2 acciones (acciones muy largas). Con la frase en 240 caracteres y acciones normales, el contexto entra en las 12 escenas. Esto reemplaza la nota anterior sobre frases largas.

### Contenido
- `index.js` carga y valida el contenido una vez, al importarse (con `await` de módulo). En Node lo lee de disco. Sin verificar: en el navegador lo pide con `fetch` a `../data/contenido/contenido-v3.json`.
- Si el contenido no valida, el módulo no carga.

### crearPartida
- Sin eventos activos, como pide el contrato. Consecuencia: el evento por hora de las 08:00 del día 1 (la feria de intercambio) no arranca activo; se dispara recién a las 08:00 del día 2. `estadoInicial` de `estado.js` sí lo activaba; el contrato lo saca.
- Los NPCs arrancan con lo que dice el contenido (`relacionInicial`, `disposicionInicial`), que hoy es relación 0 y neutral para los 12.
- Azar: generador sembrado (mulberry32, `narrador/azar.js`). Con semilla, la partida es reproducible: mismas entradas, mismos resultados y mismos textos. Sin semilla, la semilla sale de `Math.random`; es el único uso de azar del sistema en el narrador.
- El estado guarda el estado del generador en `semilla` y cada turno lo avanza.

### Estado: campos que se suman a la forma de cierre-diseno-v1.md (sección 5)
- `reformulacionPendiente` (ya estaba), `ventanaAperturas` (últimas 5 aperturas), `ultimosTurnos` (últimas 3 acciones hechas, como texto), `numeroRegistro` (cuántos registros lleva la partida), `iaAgotadaDia` (día real en que se agotó el límite diario de la IA, o null), `avisos` y `semilla`.
- `ultimosTurnos` no guarda el texto del jugador: guarda una etiqueta armada con la primera forma de la intención y los nombres del NPC, objeto o destino ("Hablar con Serel Norlen"). Es lo que va en `ultimos_turnos` del registro y en las últimas acciones del contexto de la IA. Solo suman las acciones ejecutadas, no las reformulaciones ni los turnos de IA.
- La numeración de registros vive en el estado (`reg_000001` es el primero de la partida) y sigue al cargar. Esto reemplaza la nota anterior sobre la numeración por sesión.

### cargarPartida
- Acepta el objeto o su texto JSON. Forma mínima: `version` ("v1"), `jugador` (escena, bronce, plata), `reloj`, `npcs`, `eventosActivos`, `inventario`, `marcas`. Si falta algo, lanza un error.
- Los campos que no son de la forma mínima se completan con su valor por defecto. Los campos desconocidos se descartan (por ejemplo, `temor` de un guardado viejo).
- Misma versión de contenido: una escena desconocida o un NPC que falta es un error.
- Versión distinta (o sin versión): saca los eventos, objetos, marcas, NPCs y conocimientos que ya no existen; agrega los NPCs nuevos en su estado inicial; si la escena no existe, vuelve a la escena inicial. Actualiza `versionContenido` y agrega a `estado.avisos` `{ tipo: "version_contenido", guardada, actual }`. El aviso queda en el estado (no se repite) hasta que la interfaz lo saque.
- El estado es un objeto plano: pasa por IndexedDB (clon estructurado) y por JSON sin perder campos. El test usa `almacenIndexedDB.js` con un IndexedDB falso; en un navegador real, sin verificar.

### narrar
- Es asíncrona (devuelve una promesa) porque la IA es una llamada de red. Nunca rechaza.
- No duplica la comprensión: llama a `ejecutarTurno`, que ya decide entre ejecutar, reformular o IA, y sobre ese resultado arma el texto y el registro.
- Opciones además de `groqKey`, para tests: `http` (por defecto `fetch`), `esperar` y `ahora` (por defecto el reloj del sistema).
- Tipos de salida: `narracion` (acción narrada por plantilla, o turno de IA respondido por plantilla), `reformulacion`, `dialogo_ia` (texto de la IA ya validado) y `error` (entrada o estado inválidos, o error interno).
- En `error` el estado vuelve sin cambios, no hay registro y el texto es la plantilla `no_entendido`.
- Turno de IA sin clave, sin cupo o con fallo: el texto es la plantilla `reformulacion.no_entendido`, tipo `narracion`, y `errores` trae el motivo (`ia: sin_ia: sin_clave`, `ia: cupo`, `ia: salida_invalida: id`, etc.). El registro va a grupo_2 con origen `codigo`.
- "El cupo lo permite": si Groq informa el límite diario agotado, el estado guarda el día (`iaAgotadaDia`, fecha real en UTC) y no se vuelve a llamar hasta el día siguiente. Una clave inválida no se recuerda: se vuelve a probar en el próximo turno de IA.
- El aviso al jugador de que se agotó la IA ("Se agotó el narrador de IA por hoy...") no lo devuelve `narrar`: no está en las plantillas. La interfaz lo muestra al ver `sin_ia` en `errores`.
- NPC de la IA: el primero presente en la escena.
- `errores` son códigos para el log, no texto para el jugador. Si llega la clave dentro de un mensaje de error, se reemplaza por `***`.
- Antes de devolver, el texto se revisa (sin llaves, corchetes, `<` `>` ni palabras con guion bajo). Si no pasa, se usa la plantilla `no_entendido` y se anota `texto_invalido`.
- La IA no cambia el mundo: en un turno de IA solo cambian `reformulacionPendiente`, la ventana, el número de registro, `iaAgotadaDia` y la semilla.
- `narrar` devuelve el registro pero no lo encola ni lo envía: eso lo conecta el bloque 5c (Firestore) o la interfaz, con la cola de `registro.js`.

## Bloque 5c: Firestore
- `narrar` encola el registro solo si recibe la cola en `opciones.cola`; sin cola, se comporta como antes. Encola y no envía: el envío lo dispara la interfaz con `cola.enviarPendientes()`. Esto reemplaza la nota de arriba ("no lo encola ni lo envía"). Si la cola falla, `narrar` no lanza: lo anota en `errores`.
- El cliente de Firestore es `{ db, doc, setDoc }` (las funciones del SDK web modular). El módulo no lo crea ni inicia sesión.
- `enviarLote` envía de a un documento, no con un lote atómico: así el fallo de uno no arrastra a los demás.
- En la cola, un registro inválido queda con su motivo (`motivosPendientes()`), no se envía y no frena a los siguientes. Un fallo de red sí frena el lote, para mantener el orden. La cola conectada no valida al agregar: valida al enviar.
- Además de la sección 13, para enviar se exige `revision: pendiente` y `notas` vacías (solo Tomás las cambia) y el campo `contaminacion` del bloque 5a.
- Tamaño: las reglas no pueden medir el documento, así que acotan cada campo: `texto_jugador` 6000 bytes, `respuesta_mostrada` 4000 bytes, ids 100 caracteres, hasta 3 `ultimos_turnos` de 200 caracteres. La suma queda por debajo de 16 KB. Un texto del jugador más largo no se envía y queda en la cola con motivo.
- Id del documento: `reg_` más 6 dígitos; las reglas aceptan de 6 a 12 por si una partida pasa de 999999.
- `firestore.rules` de la raíz copia sin cambios el bloque de partidas de `persistencia/firestore.rules`, que no se tocó. Se agregó `firebase.json` solo para que el emulador encuentre las reglas.
- La lectura la hace solo el administrador; como `update` está prohibido para todos, marcar `revision` y `notas` se hace fuera de las reglas (consola o Admin SDK).

## Registros: id por partida y cola sin bloqueo
- El estado del narrador no guarda el código de partida, así que el registro que devuelve `narrar` sigue con su id corto (`reg_000123`). El adaptador de Firestore arma el id largo (`reg_ABCDEF_000123`) con el `codigoPartida` que recibe al crearse, y lo escribe en el documento y en su campo `id`. Esto reemplaza "Id del documento: `reg_` más 6 dígitos" de arriba.
- El código de partida se valida con `esCodigoPartidaValido` de `persistencia/codigoPartida.js`; sin un código válido, el adaptador no se crea.
- "Ya existe con ese id cuenta como enviado": el jugador no puede leer registros, así que no hay forma de consultar si el documento existe. Se resolvió en las reglas: `update` se acepta solo si el documento queda idéntico (no cambia nada). Es un cambio respecto de "update: false" del bloque 5c; cualquier modificación real sigue rechazada. Si ya existe un documento distinto con ese id, es un rechazo permanente.
- Rechazo permanente: registro inválido, o error de Firestore `permission-denied` o `invalid-argument`. Cualquier otro error se trata como pasajero (red) y se reintenta. `already-exists` cuenta como enviado.
- Los fallidos no se reenvían solos ni se descartan: quedan en `cola.fallidos()` con motivo y registro, y `cola.reintentarFallidos()` los devuelve a la cola.

## UID de administrador
- La UID cargada en `firestore.rules` (función `ADMIN_UID`) es la de la cuenta del administrador: es la única que puede leer la colección `registros`. El usuario anónimo (el jugador) puede crear registros, pero no tiene permiso de lectura.
- La misma UID se cargó en `tests/reglas/registros.rules.test.js`, porque la prueba de lectura la necesita.
- El comentario de `firestore.rules` que dice "REEMPLAZAR antes de publicar" quedó viejo: no se tocó porque el pedido fue cambiar solo la UID.

## Página de prueba (`narrador/prueba/`)
- "Intenciones de la escena actual": el contenido no asigna intenciones a escenas, así que se muestra un botón por cada una de las 24 intenciones. Lo que cambia con la escena son las listas de NPC presentes, objetos aplicables y destinos.
- Destinos del botón viajar: las `salidas` de la escena actual. Para ir a otro destino se usa el texto libre.
- La etiqueta de cada botón es la primera forma de la intención. Los rótulos de la página (botones, títulos, avisos de guardado) no son narración y están en el HTML y en `app.js`.
- Tokens: `narrar` no devuelve los tokens, así que la página pasa su propio `http` (el `fetch` del navegador) y lee `usage` de la respuesta de Groq. Si hubo reintento, se suman. Solo se anota el estado HTTP y el uso; nunca el pedido ni la clave.
- La partida se guarda como texto JSON en IndexedDB, base `narrador_prueba`, clave `partida` (una sola partida). No usa el servicio de persistencia de la beta ni códigos de partida.
- La clave de Groq se guarda en `localStorage` bajo `narrador_prueba_groq_key`.
- La cola es `crearColaDeRegistros` sin validar al agregar y con un `enviar` que nunca se llama: solo acumula.
- El aviso de IA agotada no se muestra como texto aparte: se ve `sin_ia` en los errores del panel.
- La lógica pura está en `narrador/prueba/panel.js` (con test); `app.js` solo toca el DOM y se prueba a mano.

## Diagnóstico de `sin_ia` (`narrador/sinIa.test.js`)
- El test pasó sin tocar `narrar()`: sin clave, el segundo texto no entendido devuelve `tipo: narracion`, la plantilla `no_entendido` y `ia: sin_ia: sin_clave` en `errores`. No había fallo en el código.
- Lo que puede parecer un fallo al probar a mano: el primer texto no entendido es una reformulación y no trae errores; `sin_ia` aparece recién en el segundo. El tercero vuelve a ser reformulación sin errores (una reformulación por turno).
- Con las consultas de tema (abajo), la frase del ejemplo ("¿qué opinás de la lluvia que viene del lago?") es una pregunta: si hay un NPC en la escena, la responde él con `no_se` y no llega a la IA. Por eso el test usa una frase sin pregunta en la escena inicial, y la pregunta en una escena sin NPCs (camino del este, 18:00).

## Consultas de tema, `no_se` y viajar frente a preguntas
- "npcs.json" del pedido son los NPCs de `data/contenido/contenido-v3.json`: el narrador no usa `data/fixtures/npcs.json`. `CLAUDE.md` dice no tocar el contenido; se tocó porque el pedido lo exige: se agregó `palabrasClave` a los 12 conocimientos y el bloque `plantillas.no_se`. No se cambió `version` (sigue `v3.1`), para no disparar el aviso de versión en partidas guardadas.
- Las `palabrasClave` de Serel son las del pedido. Las de los otros 11 conocimientos las elegí del texto de cada conocimiento y quedan a aprobar por Tomás (paso C de `docs/PENDIENTES.md`). Evité palabras que son destinos de viaje ("norte", "lago").
- Pregunta: la frase trae `?` o `¿`, o una de estas palabras: "cómo", "cuál", "sabés", "sabes", "conviene". Se comparan con su tilde: "como" sin tilde no es pregunta ("trabajo como panadero"). No se agregaron otras interrogativas ("qué", "quién", "dónde"): sin signo, no cuentan.
- Una pregunta es consulta si no coincide con ninguna intención, si la intención es viajar, o si trae palabras clave de un conocimiento de un NPC presente. Una pregunta con otra intención y sin tema sigue como antes ("¿puedo hablar con Serel?" es hablar_con).
- Palabras clave: coincidencia exacta de la palabra, sin tilde y sin tolerancia a typos (con tolerancia, "cerca" coincidía con "carta"). Alcanza con una palabra clave. Si hay varios conocimientos, gana el que tiene más palabras en la frase.
- A quién se le pregunta: al NPC nombrado; si no se nombra a nadie, al que conoce el tema; si nadie lo conoce, al primero presente.
- Respuestas: se puede revelar -> `revelar_conocimiento.exito` y queda revelado. Ya revelado, o sin umbral, evento o marca -> `revelar_conocimiento.fallo` ("no te cuenta nada nuevo por ahora"). Sin tema, o con los conocimientos del NPC bloqueados (lo atacaron) -> `no_se`.
- Una consulta no gasta tiempo, no dispara eventos, no mueve NPCs y no cambia relación ni disposición. Se registra con ruta `grupo_1`, sin intención.
- Pregunta sin ningún NPC en la escena: no hay `{npc}` para `no_se`, así que sigue como frase no entendida (reformulación y, a la segunda, IA). Tampoco viaja.
- Las dos variantes de `no_se` empiezan con el nombre del NPC, así que la ventana de aperturas elegía siempre la misma. Para `no_se` se elige al azar entre las variantes.
- Viajar: los verbos son las formas de `intencion_viajar` del contenido. "camino" solo no es una forma (están "ponerme en camino" y "tomar el camino a"): como "Camino del norte" es un destino, tomarlo como verbo haría viajar a "contame del camino del norte".
- Dos fallos que destaparon los tests y se corrigieron en `comprension.js`:
  - "contame lo del pozo viejo del norte" viajaba: "viejo" coincidía con "viajá" por la tolerancia a typos (2 letras). Ahora viajar pide una forma con una letra de diferencia como máximo.
  - "irme al norte" iba a retirarse: la forma completa "irme a" no coincidía con "al". Para comparar formas completas, "al" y "del" valen como "a" y "de".
- Tests existentes que cambiaron: los que usaban "hola, ¿qué tal?" como frase no entendida ahora usan "hola, buenas tardes" (la primera ya es una consulta), y el conteo de claves de `plantillas` pasó de 27 a 28.

## Palabras clave reconciliadas con los diccionarios
- Las `palabrasClave` de los 12 conocimientos de `data/contenido/contenido-v3.json` se reemplazaron por la lista del pedido (exacta, en minúsculas y sin tildes). Cambiaron las de Ivor, Naela, Tiren, Elia, Ysolde, Dario y Sarin; las otras cinco quedaron igual. Esto reemplaza la propuesta anotada en "Consultas de tema". `version` sigue en `v3.1`.
- Validador: cada conocimiento tiene entre 2 y 5 palabras, sin repetir, y una palabra no puede estar en dos conocimientos. Se comparan en minúsculas y sin espacios alrededor; todas son errores que bloquean. No se validó que estén sin tilde.

## Diccionarios (`narrador/diccionarios.js`)
- No hay un documento de formato: el formato de cada archivo se dedujo de los cinco archivos de `data/diccionarios/`.
  - `diccionario-lexico`: forma | id | tipo. Tipos de verbo (`infinitivo`, `conjugada`, `sinonimo`, `coloquial`, `regional`) piden un id de intención; `objeto`, `npc` y `escena` piden un id de esa clase (escena acepta también `ciudad_*`).
  - `ortografia-tipeo`: escrita | correcta | tipo. 13 tipos de error más `valida`; en `valida` las dos columnas son iguales.
  - `frases-patrones`: patrón | intención o categoría (`consulta`, `multi`, `ignorar`) | parámetros | ejemplo. Parámetros: `-` o `clave=id ; clave=id`, con claves `npc`, `objeto`, `destino`, `tema`, `primera`, `segunda`. `tema` acepta NPC, objeto, escena, ciudad, evento o conocimiento.
  - `contexto-palabras`: palabra | sentido | id o `-` | estado. Estado: `siempre`, un estado de escena o un id de escena.
  - `temas-conocimiento`: en el bloque `## Conocimientos`, id de conocimiento | temas separados por `;`. En los otros bloques, tema | NPCs separados por `;`, o `*` por todos.
- "Líneas válidas" de `entradas`: las líneas de datos del archivo (ni vacías ni títulos), incluidas las que después se descartan. Así una línea descartada da un solo error, no dos.
- `cargados` y `descartados` son listas (entradas con su número de línea; descartadas con texto y motivo), no cantidades. `errores` es una lista de textos.
- No se valida que los placeholders del patrón (`{npc}`) tengan su parámetro, ni que el título de la sección coincida con las entradas.
- La lectura por `fetch` en el navegador está sin verificar. El módulo no está conectado a `comprension.js` ni a `index.js`.

## Léxico y ortografía en la comprensión (`narrador/comprension.js`)
- Prioridad al buscar la intención, con los diccionarios cargados: a) forma del catálogo exacta; b) forma del léxico; c) la frase corregida por ortografía, y de nuevo a y b; d) la tolerancia a typos de siempre. Sin diccionarios, o si no sirven, solo corre d, igual que antes (los tests lo comparan frase por frase).
- Cuando hay una forma exacta del catálogo (a), el resultado es el de `coincidirIntencion` de siempre sobre esa frase: puede traer una segunda intención con typos ("comprá y descanza"). La frase no se corrige.
- Léxico: solo los tipos de verbo (`infinitivo`, `conjugada`, `sinonimo`, `coloquial`, `regional`) dan intención. Las formas se comparan sin tildes, sin las palabras vacías de la sección 1 ("con", "a", "de"...), **exactas** (sin tolerancia a typos) y **con las palabras juntas**. Una forma de verbo del léxico cuyo id de intención no existe en el contenido se ignora.
- Una forma del léxico con dos intenciones distintas queda empatada y se reformula con `intencion_ambigua`. El desempate normal sigue valiendo: si una de las formas trae más palabras de la frase ("rajar para" frente a "rajar"), gana esa. Con los diccionarios reales, "acechar" (observar o emboscar) se reformula; "dirigirme" e "irme" los resuelve antes el catálogo.
- Objeto, NPC y escena del léxico no dan intención: nombran parámetros. Una forma completa (palabras juntas, exactas) en la frase nombra al NPC, al objeto o al destino, igual que su nombre. Para un objeto, suma tantos puntos como palabras tiene la forma. Se agrega a las reglas de siempre, no las reemplaza.
- Ortografía: se compara normalizado (sin tildes, minúsculas), así que una entrada que difiere solo en la tilde (las de tipo `tilde` y varias de `voseo_mal`) no cambia nada y no cuenta como corrección. La frase corregida sale normalizada. Se prueba con la frase más larga primero (hay entradas de hasta 7 palabras).
- No se corrige: una palabra `valida` (gana aunque la misma escrita figure también como error: es el caso de "aya"); una escrita con dos correcciones distintas (es el caso de "tien": "tiene" o "tiren"); ni una palabra suelta que sea palabra de un verbo del catálogo o del léxico ("ayuda", "ayudar", "ayer"). Esto último, además de no corregir cuando la frase ya trae una forma exacta, es lo que impide que la ortografía cambie el sentido de un verbo ya reconocido.
- La frase corregida se usa para resolver los parámetros (NPC, objeto, destino) y las consultas de tema. La pregunta (`esPregunta`) se sigue mirando en la frase original, con sus signos y tildes.
- Si la intención sale del léxico, no se aplica la prueba "un verbo de viaje con a lo sumo una letra de diferencia" de viajar: esa prueba es contra la tolerancia a typos y una forma del léxico ya es exacta.
- Un diccionario que no cargó completo (archivo que falta, o con cualquier error, aunque sea una línea descartada o el conteo del front matter) no se usa entero, y ese diccionario solo: el léxico sigue sirviendo si falta la ortografía, y al revés. Es lo más simple y predecible; la alternativa (usar las líneas buenas) queda para después. `frases-patrones`, `contexto-palabras` y `temas-conocimiento` se cargan pero todavía no se usan en la comprensión.
- Conexión: `narrador/index.js` carga los diccionarios al importarse (como el contenido) y se los pasa a `ejecutarTurno` y de ahí a `decidir`. `narrar(..., { diccionarios: null })` los apaga (para tests). Los botones no usan diccionarios. En el navegador la lectura por `fetch` está sin verificar; si falla, el narrador sigue con el catálogo solo.
- El pedido decía 240 formas en el catálogo; en `contenido-v3.json` hay 239 (24 intenciones). El test las recorre todas.
- Los nombres del pedido (`forma_mal`, `forma_bien`, `tipo_error`) son `escrita`, `correcta` y `tipo` en el código y en `docs/formato-diccionarios.md`.

## Arreglos de la prueba v0.0.3 (`narrador/fixPruebaV003.test.js`)
- **Viajar por parecido.** Causa: la tolerancia a typos de la sección 2.1 compara "viejo" con "viajá" y da 2 letras de diferencia (la tolerancia de una palabra de 5 letras); `coincidirIntencion` devuelve `intencion_viajar` y "norte" es un destino válido. No fue el léxico ni la ortografía: con los diccionarios reales la frase no se corrige ni aparece en el léxico (el test lo comprueba con `{ exacto: true }`). Con el código de `main` la frase ya no viajaba (la prueba de "una letra" del arreglo anterior la frenaba); lo que cambia ahora es la regla, que quedó así en `decidir`:
  - Forma exacta del catálogo o del léxico: viaja como siempre.
  - Parecido de **una** letra (por ejemplo "viajr"): viaja solo si la frase nombra un destino válido. Sin destino, no se entiende (`no_entendido`, sin intención), en vez de pedir el destino.
  - Parecido de **dos o más** letras ("viejo"): nunca viaja, aunque haya destino. Es más estricta que lo pedido ("salvo que la frase tenga un destino válido"): con esa excepción tal cual, "contame lo del pozo viejo del norte" viajaría, porque "norte" es un destino válido y la frase no tiene signo de pregunta, y el test exige lo contrario.
  - Con signo de pregunta o palabra interrogativa: consulta, como antes.
  - Límite que sigue abierto: una palabra a una letra de un verbo de viaje y con destino ("vieja del norte", "viaje al norte") todavía viaja. Se puede cerrar con la lista de palabras `valida` de la ortografía, o pidiendo la forma exacta.
- **Saludos.** Las frases `ignorar` de `frases-patrones.md` (hola, buenas, buen día, buenas tardes, buenas noches y todo el bloque "Ruido": 63 frases) se leen en `prepararDiccionarios`. La frase tiene que ser **entera** igual a una de ellas (sin tildes, sin signos, sin mayúsculas) y no coincidir con ninguna intención. Entonces el turno es de tipo `saludo`: lo responde el primer NPC presente con la plantilla `saludo`, no gasta tiempo, no cambia el estado, limpia una reformulación pendiente y nunca pasa a la IA. Sin diccionarios, los saludos se tratan como antes (no entendidos).
  - Es "ignorar" en general, no solo saludos: "ok", "gracias" o "no sé" también reciben "te saluda con un gesto". Para distinguirlos hace falta una categoría `saludo` aparte en `frases-patrones.md`; no se tocó el archivo.
  - Las dos variantes de `saludo` abren con el nombre del NPC, así que se elige al azar (igual que `no_se`). El validador exige el bloque con al menos 2 variantes distintas y `{npc}`; no cuenta entre los 26 bloques de intención.
  - Sin NPC en la escena no hay a quién saludar y la plantilla pide `{npc}`: sale el texto de respaldo `no_entendido`, con tipo `narracion`, sin reformulación pendiente y sin IA.
  - El registro del turno guarda `intencion_detectada: null` (no hay una intención `intencion_ignorar` en el contenido y el registro solo acepta ids de intenciones), ruta `grupo_1` y origen `codigo`.
- **IA sin clave.** El test de dos envíos pasó sin cambiar `narrar()`: el primero da reformulación y el segundo narración con la plantilla y `ia: sin_ia: sin_clave` en `errores`. Esto repite el diagnóstico anterior (arriba): no había falla en el código.
- **Versión.** `narrador/version.js` exporta `VERSION = '0.0.3'` y `narrador/prueba/index.html` tiene `<div id="version">v0.0.3</div>` fijo abajo a la derecha, escrito a mano en el HTML (así se ve aunque el módulo falle). El test compara ese texto con `VERSION`, por eso hay que cambiar los dos a la vez. La regla de sumar 0.0.1 por commit está en `CLAUDE.md`; este commit fija 0.0.3 como se pidió.

## Saludos, reconocimientos y viajar exacto (v0.0.4)
- Esto **reemplaza** lo de saludos de "Arreglos de la prueba v0.0.3": los saludos ya no salen de las frases `ignorar` de `frases-patrones.md` (el archivo no se toca ni se lee para esto) sino de dos listas nuevas en la raíz de `contenido-v3.json`: `saludos` y `reconocimientos`. Por eso funcionan también sin diccionarios. Las plantillas son `plantillas.saludo` y `plantillas.reconocimiento`, dos variantes cada una; ninguna de las dos cuenta entre los 26 bloques de intención.
- Las listas se escribieron como en el pedido: sin tildes y en minúsculas ("buen dia", "que tal"). La frase del jugador se normaliza igual (sin tildes ni signos), así que "¿Qué tal?" y "BUEN DÍA" valen.
- "Solo un saludo": todas las palabras de la frase tienen que formar parte de frases de la lista, y las frases se pueden juntar ("hola, buenas tardes" son dos saludos). Un saludo junto a un reconocimiento ("hola, ok"), o con cualquier otra palabra ("hola serel", "gracias por nada"), no es saludo ni reconocimiento: sigue el camino de siempre. Un saludo con una acción ("hola, viajá al norte") hace la acción. Las palabras de las listas no coinciden con ninguna forma del catálogo ni del léxico, así que no se pisan.
- Registro: `intencion_detectada` es `saludo` o `reconocimiento` (en v0.0.3 era `null`), ruta `grupo_1`, origen `codigo`. Las reglas de Firestore ya aceptan cualquier id de hasta 100 caracteres. Quien valide con una lista de intenciones permitidas tiene que sumar `INTENCIONES_DE_REGISTRO`. Se documentó en `docs/vocabulario-v1.md`, sección 13a.
- Sin NPC en la escena, igual que antes: texto de respaldo `no_entendido`, tipo `narracion`, sin IA.
- Validador (errores que bloquean): `saludos` y `reconocimientos` existen, no están vacías, no tienen frases vacías ni no textuales, y ninguna frase se repite (se compara sin tildes ni mayúsculas) ni dentro de una lista ni entre las dos. Las plantillas `saludo` y `reconocimiento` tienen que existir con al menos dos variantes distintas y `{npc}`.
- **Viajar.** Un verbo de viaje cuenta solo si está escrito exacto en lo que escribió el jugador (sin tildes, en minúsculas): una forma de `intencion_viajar` del catálogo o una forma del léxico. No cuenta una palabra que se parece por la tolerancia a typos ("viajr", "viejo", "vieja"), ni una que la ortografía corrige ("biajar"), aunque haya destino válido y no haya pregunta. Esto reemplaza la regla de "una letra con destino" de v0.0.3. En esos casos la respuesta es `no_entendido`, sin intención.
- El destino de viajar también se compara exacto: "viajá al nrte" da la reformulación `falta_destino`. Es una lectura del pedido ("viajá al nrte no viaja (reformulación)"): los destinos con typo ya no se toleran al viajar. Los botones no cambian (reciben el id).

## Motor de caso: tags y acciones (v0.0.6 y v0.0.7)
- **Acciones sin intención en `contenido-v3.json` (11, sin forma de entrar hoy):** `regalar_objeto`, `mentir`, `robar`, `pedir_prestado`, `pagar_deuda`, `cobrar_favor`, `guardar_secreto`, `revelar_secreto`, `ponerse_de_lado`, `aliarse`, `escoltar_caravana`. Quedan en la tabla de `narrador/casos/acciones.js` con ese id y `intenciones: []`. No se agregó ninguna intención.
- **`preguntar_clave`** tampoco tiene intención, pero entra por consulta (pregunta a un NPC): en la tabla lleva `entrada: 'consulta'`.
- **Acciones con intención (8):** exactas `ayudar` = `intencion_ayudar`, `atacar` = `intencion_atacar`, `examinar` = `intencion_examinar`. Aproximadas (`aproximada: true`): `hablar_amable` ≈ `intencion_hablar_con`, `amenazar` ≈ `intencion_presionar`, `viajar_camino` ≈ `intencion_viajar`, `escuchar_oculto` ≈ `intencion_ocultarse` / `intencion_observar`, `comerciar_justo` ≈ `intencion_comprar` / `intencion_negociar`. Son las equivalencias de `docs/auditoria-motor-caso.md`; falta decidir cuándo una intención aproximada cuenta como la acción (p. ej. qué hace "amable" a un hablar).
- **20 acciones:** "robar visto" y "robar no visto" son una sola acción `robar` con la condición `visto`; "mentir detectado" es `mentir` con la condición `detectado` (sin detectar no escribe nada).
- **`reputacion_ciudad`** es el único tag con signo: va de −3 a +3 por pasos (`ajustarReputacion`) y en 0 se quita. No se escribe con `escribirTag`. Sale de la referencia (`docs/motor-caso-v1.md`, 5.3).
- **"Rencor nuevo baja gratitud 1"** se aplica en cada escritura de rencor sobre el mismo objetivo, también cuando el rencor ya existía. Gratitud en nivel 1 se quita.
- **Nivel nuevo menor:** se reinician `creadoHora` y `creadoHito`; `casoId` y `origen` quedan los del tag original.
- **Rangos (gratitud 1–2, pista 1–2, pacto 1–3, lealtad 1–2):** el nivel lo pasa quien aplica la acción (`contexto.nivel`); sin dato, el mínimo. Falta la regla que elige el nivel.
- **Estado social, "chisme +1":** el `chisme_activo` de la acción sale un nivel más alto (máximo 3). "En sigilo, robar no visto es más probable" no está: es de quien decide si lo ven.
- **Objetivos:** la tabla da la clase (`npc`, `escena`, `jugador`, `ciudad`, `conocimiento`, `bando`, `faccion`, `camino`); el id concreto lo pone el módulo que aplique la acción al estado, que todavía no existe. Tampoco se conectó nada al turno: `tags.js` y `acciones.js` no los usa nadie aún.

## Motor de caso: persistencia y decaimiento (v0.0.8)
- **`fake-indexeddb`** entró como dependencia de desarrollo (`package.json`, `package-lock.json`); antes de `npm test` hay que correr `npm install`. Se agregó `.gitignore` con `node_modules/`. IndexedDB de navegador real: sin verificar.
- **Persistencia** (`narrador/casos/persistencia.js`): base `avaloria`, esquema 1, los seis stores de la sección 2. Todo lo del turno se guarda con `turno(fn)` en una sola transacción; si `fn` falla no se guarda nada. Las operaciones sueltas abren su propia transacción. No está conectada a `narrar`.
- **`versionContenido`** se guarda en cada registro. Al leer con otra versión el registro vuelve con `compatible: false`; no hay migración.
- **Firma** es un texto que arma quien instancia; la persistencia solo la usa de clave. `historial_instancias` guarda `usos` y `ultimaHora` (para el empate "más vieja").
- **Decaimiento** (`narrador/casos/decaimiento.js`): el estado es `{ tags, hora, contadorHitos }`. `estado.hora` es la hora total del reloj ya avanzada y `contadorHitos` ya tiene sumado el hito disparado. Cada tag cuenta desde su `creadoHora` / `creadoHito`.
- **Celdas "—" de la tabla:** la regla de la columna Leve vale para los tres niveles (chisme_activo, alerta_camino, lealtad_caravana, favor_debido).
- **Por pasos** (fama_violenta, reputacion_ciudad, deuda_personal): un paso por plazo cumplido, y la cuenta sigue desde el fin de ese plazo. fama_violenta en 1 y reputacion_ciudad en ±1 se quitan al paso siguiente. deuda_personal sube hasta 3 y queda.
- **Reparación:** se quita el tag de mayor nivel entre rencor, desconfianza y miedo medio/grave del NPC (empate: en ese orden), o el que indique `tipo`. El rencor grave ni se quita ni se baja sin `reparaRencorGrave`. No suma los +15 de relación ni levanta `bloqueadoConocimientos`: eso le toca al módulo de hitos.
- **Cierre de caso:** `aplicarCierreDeCaso` solo quita los cinco tags de cierre. **Modo libre** (1 hito = 8 turnos): no está; lo decide quien llame a `aplicarDecaimientoPorHitos`.

## Motor de caso: instancias (v0.0.9)
- **`historialJugador`** es `{ jugadorId, instancias, tags }`: `instancias` sale de `persistencia.instanciasDeCaso` (`leerHistorialJugador` lo arma) y `tags` son los de la partida, para el rencor grave.
- **Parámetro extra `contexto`** en `candidatos`, `armarInstancia` e `instanciar`: `{ contenido }` o `{ duenos }` para saber el dueño de cada conocimiento, y `{ persistencia, fecha }` en `instanciar`. El dueño no se puede sacar del caso ni del historial.
- **El historial viaja en cada candidato:** `candidatos` le pone a cada firma `usos`, `ultimaHora`, `ordenes` y `ordenesValidos`; por eso `ordenar(firma, semilla)` no necesita más datos. `elegirFirma` acepta además el historial como segundo parámetro.
- **Firma como texto:** `p1=<conocimiento>|p2=<conocimiento>|p3=<conocimiento>`.
- **Rencor grave en p1:** si los dos conocimientos de p1 tienen dueño con rencor grave, la exclusión no se aplica (si no, el caso no se podría instanciar).
- **Orden válido:** p1 va primera si el primer hito la nombra en `condiciones` o en `escena_entrega`; si no, valen las 6 permutaciones. Es una lectura mínima de "permutación válida", hasta que exista el módulo de hitos. Un caso sin hitos se trata como si dependiera de p1.
- **Uso por orden:** `persistencia.sumarUsoInstancia` ahora recibe `orden` y lo cuenta en `ordenes` del registro; `instanciasDeCaso` lo devuelve.
- **"La más vieja"** usa `ultimaHora` del historial, que `instanciar` llena con `contexto.fecha` (por defecto `Date.now()`), no con la hora del reloj del mundo: el historial cruza partidas.
- **Empates:** entre no jugadas, y entre firmas u órdenes que siguen empatados, decide la semilla. `instanciar` no guarda la instancia en `estado_caso`: lo hace quien llama, en la misma transacción del turno. No está conectado a `narrar`.

## Motor de caso: hitos (v0.0.10)
- **Formas de los estados** (están en la cabecera de `narrador/casos/hitos.js`): `estadoCaso` lleva la instancia, los tags, los contadores y las listas de hitos; `estadoMundo` lleva la plantilla del caso (`caso.hitos`), `hora` total del reloj, `turno`, `escena` del jugador, `estadoEvento` y `npcs: { id: { escena, relacion, bloqueadoConocimientos } }`. Falta el adaptador desde el estado real del narrador: no está conectado a `narrar`.
- **Formato de `condiciones`** (no estaba definido como datos): `requiere_hitos` (lista = todos, o `{ todos, alguno }`), `tags: [{ tipo, objetivo, op, nivel }]` con `>=`, `<`, `==`, `ausente`, `escena` (id, lista o `{ en, no_en }`), `hora: { rango: [desde, hasta] }` (hora del día) o `{ desde_previo: n }` (horas de reloj desde `hitoPrevio.hora`), `contador: { desde_previo: n }` (contra `hitoPrevio.contador`), `estado_evento`, `pistas: { cantidad, nivel, habilitada }`. No hay condición por turnos ni "grupo de escenas".
- **Ranuras en objetivos y escenas:** `p1` es su conocimiento, `npc(p1)` su dueño, `escena(p1)` la escena donde está el dueño, `escena` la del jugador.
- **Efectos de hito:** `{ tipo, objetivo, nivel }` y `op` `subir`, `quitar` o `reputacion` (con `paso`). Un tag escrito sobre un NPC mueve su relación (+5, −8, −4, −3 por nivel).
- **`dispararHito` devuelve** `{ estadoCaso, estadoMundo, hito, reparado }`: el mundo vuelve porque la reparación cambia relación y `bloqueadoConocimientos`.
- **Reparación:** va sobre `hito.npc_reparacion` si lo trae; si no, sobre el primer NPC de ranura (en el orden de la instancia) con un tag medio/grave reparable. Solo NPCs de ranura. El hito de reparación vuelve a quedar listo mientras quede un NPC por reparar; cada NPC se repara una vez. Sin nada que reparar se dispara como un hito común y no tiene prioridad.
- **Listos:** se recalculan en cada llamada; un hito que deja de cumplir sale de la lista. `listosDesde` guarda la hora desde la que está listo.
- **Máximo 1 por turno:** `elegirDisparo` devuelve null si ya se disparó un hito en ese `turno`.
- **Gancho:** se devuelve el del hito listo de mayor prioridad que no se puede entregar en la escena del jugador. Se mueve a las 12 h de reloj salvo `escena_alternativa: false` (campo nuevo, por defecto admite). "Más cercano" usa `estadoMundo.distancia(a, b)`; sin ella, el NPC de ranura que está con el jugador o el primero en el orden. Si se mueve a la escena del jugador no hay gancho: se entrega ahí.
- **Anti-traba, 8 turnos:** baja el umbral del hito de menor id, disponible, con `requiere_hitos` cumplidos, que pida una pista en nivel 2 o más; una pista pedida en N vale en N−1 (mínimo 1). Un hito por vez, cada 8 turnos.
- **Anti-traba, rencor grave:** se lee como "un NPC de ranura tiene rencor grave" y habilita el hito con `repara_rencor_grave`; una reparación común no se habilita porque no puede quitarlo.
- **Anti-traba, 24 h:** "avance" es el último hito disparado, la instanciación o la última siembra. Escribe el tag directo; el "evento de escena" que lo narra no está.
- **Anti-traba, finales bloqueados:** marca `abandonoHabilitado`; elegir el desenlace es del módulo de desenlaces. Un hito `final` disparado deja `finalAlcanzado`.

## Motor de caso: esquema de condiciones (v0.0.11)
- **SUPUESTO — `escena_alternativa`. Pregunta para Tomás: ¿existe?** `narrador/casos/hitos.js` (`ganchoFueraDeEscena`) lee `hito.escena_alternativa`: con `false` la entrega no se mueve a las 12 h; sin el campo, se mueve. El campo no está en el diseño ni en el esquema de `docs/motor-caso-v1-operativo.md` (§2b); salió de "si el hito admite escena alternativa" de la referencia (4.3). El código queda como está y los casos no lo tienen que usar hasta que se decida.
- El esquema de condiciones y el formato del estado del caso quedaron en `docs/motor-caso-v1-operativo.md`, §2b, como fuente de verdad. `hitos.js` ya coincidía: no hubo que cambiar código. Un test lee el hito de ejemplo del documento y lo evalúa.
- En §5 del operativo se ajustaron dos líneas para que no contradigan el esquema: la condición relativa a hitoPrevio va en horas del reloj (decía turnos) y hitoPrevio es `(id, hora, escena, contador)` (decía `turno`). `docs/motor-caso-v1.md` (4.1) todavía tiene la fila `turnos`: sin sincronizar.
- `npc_reparacion` (NPC fijo de un hito de reparación) tampoco está en el esquema: es opcional y sale del mismo módulo. Misma duda que `escena_alternativa`.

## Escena alternativa y reparación con NPC dueño (decidido por Tomás)

- `escena_alternativa` y `npc_reparacion` existen; quedan definidos en `docs/motor-caso-v1-operativo.md` §2b. Las dos preguntas de arriba quedan cerradas.
- SUPUESTO: umbral de relación para la reparación explícita = 15. Con rencor grave (−24), dos hitos de reparación (+30) y gratitud media (+10) un NPC que partía de 0 queda en 16.
- SUPUESTO: a las 12 h el gancho pasa a nombrar `escena_alternativa`; ya no se mueve la entrega a la escena del NPC de ranura más cercano.
- SUPUESTO: el progreso de reparación (`progresoReparacion`) es por NPC y sigue entre casos.
- PENDIENTE (código sin tocar en esta tarea): `hitos.js` todavía trata `escena_alternativa` como booleano y mueve la entrega al NPC más cercano, repara una vez por NPC, y no aplica las tres condiciones ni el reinicio por traición; `decaimiento.js` no pide NPC dueño. El validador todavía no existe.
