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
- Formas que comparten palabras de la frase compiten entre sí, con este orden: más palabras; después, la forma completa (con sus palabras vacías) presente en la frase; después, la que aparece primero; después, menos typos. El segundo criterio separa "irme" (retirarse) de "irme a" (viajar), que sin palabras vacías son iguales.
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
