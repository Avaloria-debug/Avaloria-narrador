# SUPUESTOS v3

## Barrido de comprensión por relación
- Maren y Serel tienen dos conocimientos cada uno (`_1` y `_2`, con su umbral: Maren 40 y 30, Serel 30 y 25). Las secuencias de dos preguntas piden `_1` con la primera y `_2` con la segunda, con relación 50.
- "Esperado" de una frase de un solo paso: si trae una palabra clave de un conocimiento del NPC presente, revela ese conocimiento con relación >= su umbral y si no, "no te cuenta nada nuevo". Si no trae palabra clave del NPC (por ejemplo los temas del otro NPC), se espera reformulación.
- "ok" se espera como reconocimiento ("asiente").
- Los casos se corren con semilla 11, con el jugador en la escena inicial del NPC y la relación fijada en el estado.

## Aperturas variadas en las respuestas de IA (0.0.38)
- El mensaje de sistema no se tocó: mide 348 de los 350 tokens estimados de su máximo, y subir el máximo rompe el tope de 800 por llamada. La instrucción de variar la apertura va en el contexto (mensaje del usuario), solo cuando hay aperturas recientes: `Variá cómo empezás: no arranques con "…"`. Si el contexto no entra en 250 tokens, esa línea es lo primero que se saca.
- Apertura de una respuesta de IA = sus dos primeras palabras, en minúsculas, sin tildes ni signos (`aperturaIa`). Se guarda en `ventanaAperturasIa` (estado), con el mismo mecanismo y la misma ventana de 5 que `ventanaAperturas` de las plantillas. Va en una lista aparte porque cada turno de IA viene después de una reformulación, y en una ventana compartida las aperturas de plantilla desplazan a las de la IA.
- Si la respuesta repite una apertura de la ventana, se pide una vez más a la IA. La segunda se usa solo si es válida y no repite; si no, queda la primera (no hay alternativa). Como mucho hay un pedido extra por turno.
- Cambio (ajuste de la PR #7): ya no hay pedido extra. Reemplaza al punto anterior que pedía una vez más cuando la respuesta repetía una apertura. Las aperturas a evitar van en el mismo y único pedido; si la respuesta igual repite, se acepta y se anota en `diagnosticoAperturasIa` del estado (`aperturasRepetidas`, `ultimaRepetida` con las dos palabras, sin la frase del jugador). Si la línea de aperturas se saca por el tope del contexto, se cuenta en `aperturasRecortadas`. Los dos tests que esperaban el pedido extra se reescribieron a esta regla. Los reintentos que ya tenía `pedirRespuestaIA` por 429 o por error de red no cambian.

## Humo solo con incendio activo (v0.0.39)
- SUPUESTO: la instrucción "Solo menciones humo, fuego o incendio si aparece en los eventos activos de la escena." va en el contexto, no en el mensaje de sistema (que está en 348 de 350 tokens). Si el contexto pasa de 250 tokens, se saca después de la línea de aperturas; el recorte queda en `fuegoRecortado`. La garantía es la validación de salida, que se aplica siempre.
- SUPUESTO: las palabras de fuego (humo, fuego, incendio, llamas, quemar) se buscan como palabra entera, sin distinguir mayúsculas y sin quitar tildes: "llamás" (voseo de llamar) no cuenta; plurales y conjugaciones ("quemó", "llama") tampoco.
- SUPUESTO: el único evento de fuego es `evento_incendio_puesto` y cuenta solo si está activo en la escena del jugador. Un texto rechazado por fuego sale como `salida_invalida: fuego_sin_evento` y el turno usa la plantilla de respaldo; `validarSalida` no cambia.

## Pista de camino a p1 (v0.0.40)
- SUPUESTO: nueva regla de anti-traba (`antiTrabaCaminoP1`, `narrador/casos/hitos.js`). Si pasan 8 turnos de caso sin avance antes del primer hito, se escribe `pista_conocida` nivel 1 de la ranura p1 (origen `anti_traba:camino_p1`) y se narra un texto que nombra a su dueño y la escena donde está. Es el mismo tag que la regla de 24 horas, que no cambia.
- SUPUESTO: "turnos sin avance" se cuenta con `contadorTurnos`, que solo avanza en turnos de acción y en consultas que revelan; las reformulaciones y las negativas no cuentan. Empieza en el primer turno de caso; se guarda en `caminoP1Desde`.
- SUPUESTO: no aplica si ya hay hitos alcanzados o listos, si p1 ya está en nivel 1, si el dueño de p1 no está en ninguna escena o si el jugador está en su escena. Se da una sola vez por caso.
- SUPUESTO: el texto sale de `textos_pista_camino` del caso (`data/contenido/casos.json`, campo nuevo y opcional) con los marcadores `{npc:pN}` y `{escena:pN}` (nuevo: nombre de la escena donde está el dueño). El validador rechaza `{conocimiento:pN}` en esos textos. Sin textos, la pista queda solo como tag. El texto se agrega solo si en ese turno no hay texto de hito.
- SUPUESTO: los dos textos propuestos son iguales en los 4 casos y esperan aprobación de Tomás. No se cambió `version` de `casos.json` (casos-v0.4).

## Umbral reducido en el primer contacto por pista (0.0.41, pendiente de aprobación de Tomás)
- La marca de primer contacto es nueva: `estadoCaso.primerContactoPista = { npcId, usado }`. La escribe la regla de camino a p1 (`antiTrabaCaminoP1`) al dar la pista. No se usa el tag `pista_conocida` con `origen: anti_traba:camino_p1` porque los efectos del h1 lo pueden sobrescribir al llegar.
- "Llegó siguiendo la pista": la regla solo da la pista si el jugador no está en la escena del dueño de p1, y la consulta exige al NPC presente. Por eso la primera consulta con la marca sin usar ocurre después de haber ido hasta él.
- Valor propuesto: `UMBRAL_PRIMER_CONTACTO_PISTA = 0` (`narrador/conocimientos.js`). Rige solo para el `_1` del dueño de p1 y solo en la primera consulta con tema a ese NPC, revele o no. Después vuelve el umbral del contenido. El `_2` no cambia. Bloqueo por ataque, evento y marca siguen valiendo.
- Si la consulta revela, el motor de caso reemplaza `caso` y puede no conservar `usado: true`. No importa: el `_1` ya quedó revelado y la marca solo rige para él.
- Solo afecta a la consulta de tema (`ejecutarConsulta`). La revelación por conversación (`conocimientoARevelar`) no cambia.
- No hubo que reescribir ningún test existente de umbral.

## Auto narrador ampliado (nov 2026) — paso | decisión | alternativa
- Arranque | rama única `claude/quirky-keller-fn77dr` (orden del usuario) | `auto/narrador-ampliado-v2-nov2026`
- Arranque | t16: 36 ids de conocimiento renombrados `conocimiento_<npc>_ampN` (sed del usuario) | dejar duplicados
- P1 | simulador usa botones al azar con rng propio `sim:<semilla>`; `ahora` fijo en 0 | texto libre
- P1.5 | producción no carga ampliado: solo si se pasa `opciones.ampliado` a crearPartida/narrar | cargarlo al importar index.js
- P1.5 | `a_aprobar` solo con cargarPendientes; `a_aprobar_canon` además con incluirCanon | canon con cargarPendientes solo
- P1.5 | `u_niebla_voces` nunca se carga hasta aprobar | cargarlo con incluirCanon
P4 | clima en ext.clima (ambiente.js), no en reloj.js | campo en reloj
P4 | sentido dominante de t00 no se usa: las líneas no traen sentido | etiquetar líneas
P3 | avisos de gramática en estado.ext.avisos (no en estado.avisos) | estado.avisos
P5 | despedida de voces no se usa (no hay turno de despedida en v3) | inventar disparador
P5 | hablar_con con NPC: 50% charla, si no plantillas v3+ampliado por especificidad | siempre charla
P7 | afinidad por valores se guarda en ext.afinidad y solo ajusta r de las condiciones (no toca npcs.relacion) | sumarla a la relación real
P8 | los eventos v3 no tienen texto: se narra el inicio (t09/t19) del evento nuevo en la escena del jugador y cierre.<categoria> al expirar; la saliencia elige entre variantes, no cambia qué evento se dispara | cambiar el disparo
P9 | rumor se cuenta al saludar/hablar con un NPC que lo oyó (si no hubo línea de memoria); remate de ciudad 50% | contarlo siempre
P10 | conocimientos t16 solo en consultas que v3 contestó no_se; revelados en ext.reveladosAmp (no en npcs.conocimientosRevelados) | fusionarlos en contenido v3
P10 | únicos: tienen prioridad sobre el ambiente, sin sorteo, nunca dos turnos seguidos de ambiente | sortear con 0.25
- P11 | pasadas de respaldo (raíz, trigramas) excluyen verbos de riesgo y viajar, exigen ganador único y cubrir ≥50% de la frase | aplicarlas a todo
- P11 | trigramas: además de coseno ≥0.6, misma inicial y largo ±2 (evita "blablabla"→hablar) | solo coseno
- P11 | la pasada queda en turno.pasada; el registro Firestore tiene esquema cerrado: campo `pasada_comprension` A APROBAR | agregarlo al esquema
- P11 | t11 claves nuevas: npc_ausente→nombre_desconocido, sin_objetos→objeto_desconocido, falta_destino→destino_invalido, sin_salidas→cerrado; verbo_desconocido sin disparador (no hay motivo) | inventar motivo
P12 | propiedades corren 200×30 en v3 puro y con ampliado (pendientes+canon); frases del jugador sintéticas de sílabas | frases reales
P14 | sin lista de insultos en data (no se inventa): la palabra de eco tiene que existir en el vocabulario del contenido, lo que excluye insultos y datos personales | lista en data A APROBAR
P14 | eco solo si la frase tiene ≥2 palabras y en acciones simples de intenciones con líneas en t20 | todas
P15 | la tabla de efectos es t21 (canon, solo con incluirCanon); aparición una vez por activación al estar en la escena; expiración solo si el jugador la vio y está ahí | narrar siempre
P16 | objetivos desde t22 (no objetivos.json aparte); charla del paso 30% en hablar_con; rumor de objetivo ajeno 20% | archivo nuevo
P17 | comando: el texto exacto "diario" muestra el diario (sin cambiar comprension ni ui) | intención nueva
P11 | (corrección en P17) la reformulación t11 no había quedado conectada en ampliado.js; se conectó en P17 con test
P18 | saludo con apodo (t24 usos) con prob 0.3 si hay apodo; {apodo} = base si la relación es mala | siempre
P19 | silencio solo en acciones simples con NPC; ritmo corto usa t25 siempre que haya líneas para la intención | mezclar con las demás
P20 | voz del NPC (t26) solo para no_entendido e intencion_ambigua; sin NPC cae a t11/v3 (no se agrega símbolo de ambiente) | símbolo de ambiente
P20 | 3er no entendido seguido (reformulación o IA sin respuesta) sugiere NPCs presentes (falta_npc) o salidas (destino_ambiguo) con plantillas v3 | texto nuevo
P21 | año de 360 días, 90 por estación; día 1 = primavera | otro largo
P21 | festividades sin fecha en t27: solo se activan con data/contenido/ampliado/calendario.json (no existe; A APROBAR) | inventar fechas
Q1 | calendario.json (lista con dia) se convierte en código a {id:{diaDelAnio}}; el archivo no se toca | convertir el archivo
Q1 | valores.json y calendario.json respetan su estado (a_aprobar_canon → solo con incluirCanon) | cargarlos siempre
Q2 | navegador: producción carga a_aprobar y aprobado (cargarPendientes=true por defecto en cargarAmpliadoFetch); los avisos se devuelven y los anota quien llama | anotarlos acá
Q3 | no hay ui/ ni index.html en la raíz: el punto de entrada real es narrador/prueba/app.js (diff mínimo) | crear ui/
Q3 | la página guarda el estado en IndexedDB (con ext); firestore.rules /partidas usa keys().hasOnly([...]) sin 'ext': si el estado del narrador se sube ahí, hay que agregar 'ext' (A APROBAR) | cambiar rules
Q4 | firestore.rules no se tocó: camposDeRegistro() con hasOnly rechazaría pasada_comprension; A APROBAR agregar 'pasada_comprension' a esa lista | editar rules
- F3-S1: "examinar/tocar X" con X sin objeto, fijo, foco, NPC ni lugar en la escena → reformulación `sin_objetos` (clave t11 `objeto_desconocido`); "examinar" solo sigue examinando la escena.
- F3-S1: la línea de inicio/cierre de evento va al final, separada por línea en blanco (`\n\n`).
- F3-S1: `{eco}` solo si la palabra coincide con el nombre del objeto, NPC o lugar resueltos.
- F3: el estado de focos vive en `estado.ext` (focos, siguiendo, marcasFoco, interrupciones, ultimaCharla); `fin: hallazgo` marca `ext.marcasFoco` (las marcas base se filtran contra contenido-v3).
- F3-S3: "preguntar por X" sobre un foco responde con clases.<clase>.preguntar (no hay líneas por NPC para focos en t30).
- F3-S4: actuar sobre un foco renueva su `visto` (así repetir tras `fin` responde ignorar y no no_visto).
- F3-S5: el castigo de la 3.ª interrupción va a `ext.afinidad` (utilidad P7), no a la relación base; con `valores.orden` ≥ 1 es −2.
- F4 U1: id de foco repetido entre tandas lanza al fusionar (antes Object.assign lo pisaba).
- F4 U1: test S2 de generado usa «golpes» porque t32 define «carros» (carreta_camino) y ahora gana el foco propio.
- F4 U2: la voz del NPC (t31) tiene prioridad sobre ramas.preguntar propias del foco; sin NPC se usa la rama y luego la clase.
- F4 U2: sin «a <npc>» en el texto se usa el primer NPC presente; fijos usan la clase objeto de t31.
- F4 U3: stopwords del reporte «sin foco» viven en tools/bots-focos.js (STOP), no en contenido.
R0 | rama: se trabaja en claude/quirky-keller-fn77dr (la sesión solo permite pushear esa rama) | crear claude/ia-local-fase5
R1 | umbrales PC ≥20 tok/s y móvil ≥6 tok/s provisionales (UMBRALES_TOK_S.prov) | otros valores
R2 | además de acciones 3→0 se quitan descripción, salidas y aperturas antes de ErrorDeContexto | error con 0 acciones
R3 | modelo: PC Qwen2.5-1.5B-Instruct q4f16 (mejor español en ~1 GB, Apache 2.0); móvil Qwen2.5-0.5B q4f16; respaldo Qwen3-0.6B (piensa: enable_thinking:false) y Llama-3.2-1B; ids de prebuiltAppConfig sin verificar en red | Qwen3 como móvil
R3 | CDN del motor jsdelivr @mlc-ai/web-llm@0.2.79 (+esm), provisional y A APROBAR | esm.run
R3 | velocidad: generación corta de 16 tokens al cargar; bajo el umbral → siguiente candidato | medir en el primer turno
R4 | registro sin campo nuevo: la respuesta local queda como origen ia (distinguirla requiere firestore.rules, A APROBAR) | campo origen_ia
R5 | la página no carga el modelo sola salvo flag guardado tras una activación exitosa; panel muestra tokens.local con latencia | autoarranque
R6 | sin espejo propio: solo origen oficial de Hugging Face | espejo en Pages
- F6 V0: las etapas viven en narrador/lectura.js, que usa comprension.js (normalizar, distanciaEdicion, resolverDestino); comprension.js no la importa para evitar ciclo.
- F6 V1: corpus generado a 655 casos; a 5 casos semilla con pronombre se les agregó `ctx` (el referente que asumían); presentes por defecto = Serel.
- F6 V1: línea base = todas las etapas apagadas (solo infinitivo y 1.ª persona de los verbos base, alias exactos).
- F6 V2: verbos de ≤3 letras (ir, ver, dar, oír) solo con formas irregulares; sin etapa de negación, una frase que empieza con «no» queda no_entendido; dos cosas distintas nombradas → aclaración.
- F6 V3: palabras de escenas y pronombres no se corrigen por tipeo; en viajar, el destino gana a una cosa hallada solo por tipeo.
- F6 V4: memoria de referencia con vida de 5 turnos (VIDA_REFERENCIA); «la/lo» son pronombre solo si no los sigue un sustantivo.
- F6 V5: en el juego la lectura solo actúa con ampliado y sobre focos vigentes; reescribe a la forma canónica cuando verboFoco no reconoce el verbo, o pregunta si hay empate real (mismo alias, misma recencia). La aclaración vive 2 turnos en ext.aclaracion.
- F6 V6: «agarrar» es tocar en focos.js y tomar en la lectura; en el juego manda focos.js (no hay verbo tomar sobre focos). Sinónimos de cosas = alias de focos + nombre/alias/oficio de NPC (sin léxico aparte).
- F6 V7: con ampliado, una frase con varias acciones se juega como turnos seguidos de narrar() (un registro por parte); corta si una parte termina en reformulación.
- F6 V7: el modo (sigilo/prisa) solo viaja como dato en turno.foco.modo; el motor no tiene efecto para él (ignorado).
- F6 V7: corpus +25 frases de control (falsos_positivos) halladas en la autorrevisión; 4 casos semilla de «ignorar al perro» pasan a aclarar (hay dos perros), como «seguir al perro».
- F6 V7: tipeo con 4 letras solo para intercambio de letras o letra faltante («hora» no se corrige a «hoja», «tiro» no es «miro»).
- F6 V8: «no entendida» = reformulación, error de IA (sin_ia) o aclaración pendiente; exportación con accion '?' para completar a mano.
- F7 W1: transportable = clase objeto con algún paso `fin: hallazgo`, o id en inventario; tomarlo ejecuta su rama «seguir» (la que lleva al hallazgo). «agarrar» sale de FORMAS.tocar de focos.js: decide solo tomarOTocar (lectura.js). La carta no es transportable (sin hallazgo) → tocar; 28 casos del corpus pasan a tocar.
- F7 W1: rótulo = escena donde se vio cada candidato (si difieren) o el resto de un alias propio («el de granja»).
- F7 W1: manifest regenerado ya en W1 porque t39 llegó en el paquete (el test de manifest lo exige).
- F7 W2: no había historial global (solo ventanaAmbiente de 8 y aperturas); se agregó narrador/historial.js (ext.lineas, 30 párrafos) consultado por seleccion.elegir, elegirPlantilla, gramática y los picks de focos/ampliado; fragmentos <20 caracteres no cuentan. Repeticiones en 200 turnos: 29 → 22 (las que quedan son listas agotadas, p. ej. descansar con 2 variantes).
- F7 W3: la sugerencia se suma a cada no_entendido (reformulación con motivo no_entendido o IA sin respuesta); el 3.º seguido conserva la sugerencia P20 existente. Test de reformulación: la voz del NPC ahora es prefijo.
- F7 W4: con t39 cargado, su ambiente (2–3 turnos, reiniciado por eventos) reemplaza al ambiente por probabilidad de P?; el pool suma ambiente t39 + t02 de la escena + actividad de NPC presentes. El cierre de t39 queda en amp.narracion.cierre (no se mezcla con el cierre de eventos). Llegada también en el turno 1 (escena inicial). Normal = 1 primera + actividad; rica = 2 primera + actividad; breve = 1 línea, sin ambiente ni actividad.
- F7 W4: «fin de charla» para el cierre = interrupción de charla por un foco (turno.foco.interrupcion).
- F7 W5: ✎ alterna «escribir sin ejecutar» para los verbos; el toque largo (500 ms) hace lo mismo en un verbo. Fila solo con ampliado. Navegador y móvil sin verificar.
- F7 W6: ampliado = 451 KB en disco (375 KB minificado, 137 KB gzip), carga en Node 31 ms. Supera los 300 KB, pero solo 75 KB (20 %) está indexado por escena (t13, t02, t39, fijos de t30): partir en paquetes ahorraría ~69 KB (~25 KB gzip) a cambio de archivos generados y otro formato de manifest. Se hizo solo lo barato: fetch en paralelo + caché en memoria. A decidir por el autor.
- F7 W7: la sugerencia «Podrías …» va al final del turno (antes, el ambiente quedaba pegado detrás). Ambiente detectado por estado (ext.ultimoAmbiente = turno), no por texto (las líneas con símbolos cambian).
- F7 W7: «0 repeticiones en la ventana» no es alcanzable con listas de 2 variantes usadas más de 2 veces en 30 líneas; el bot informa repeticiones en ventana (220 en 6000 turnos) y seguidas (3, de foco agotado → «ignorar», regla de fase 3), y falla solo con párrafos repetidos dentro del mismo turno.

## Fase 7 — ajustes
- «tomar/agarrar»: transportable = objeto con fin hallazgo + inventario + `data/config/llevables.json`. El corpus pasa «agarro/tomo la carta» (y el sello) de tocar a tomar (24 casos).
- Foco agotado: responde con la línea siguiente de su verbo si queda; si no, una de `TEXTOS_AGOTADO` (prov, 5 variantes). El test S4 de fase 3 («repetir = ignorar») ahora espera esa línea de cierre.
- `tools/bots-juego.js` escribe `tools/auto7/repetidas.json` (40 listas que más repiten, con su ruta y variantes). «(sin lista)» = plantillas con huecos rellenados.
- W6 cerrado sin paquetes por escena.
