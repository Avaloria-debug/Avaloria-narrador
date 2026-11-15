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
