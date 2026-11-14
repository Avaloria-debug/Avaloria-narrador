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
- Sin corregir, para revisar: `disparo.objetivo` usa nombres y no ids en dos eventos (`"Naela"` y `"Darío"`, en lugar de `naela_tabernera` y `dario_guardia`). El validador no revisa `objetivo`.
- La clave `resultado_<verbo>_<resultado>` se resuelve por id de verbo, con la tabla de `vocabulario-v1.md` sección 5. Por eso `resultado_calmar_la_situacion_exito` va a `plantillas.intencion_calmar.exito`.
- `cargarContenido.js` usa `node:fs`. La carga en el navegador (por `fetch`) queda para la integración con el HTML: sin verificar.
