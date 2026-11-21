# Bugs de prueba real + barrido (fase 7)
Arreglados (causa): A1 focos solo por texto del narrador (alias de la frase del jugador no abren foco; `alias-bloqueados.json`; verificar-focos falla con stopwords — encontró además «alguien»). A2 `escenas.json` interior; la narración de escena ignoraba las condiciones `c` de ambiente (causa de la lluvia en el Archivo). A3 IA (Groq y local): eco >0.6, narración sin habla, fuera de personaje → plantilla. A4 charla directa (saludo con nombre, identidad/actividad/origen, «qué dice X»).
Barrido (`tools/barrido.mjs`, 12 escenas × 200 turnos, semillas 1–4: 0 hallazgos; test con 4 escenas):
- Coherencia: filtro por condición en `historial.sinRepetir` (`narrador/coherencia.js`: clima del turno o de evento, interior/llegada, franja; lo dicho entre «» no cuenta). Focos de clima no se activan en interiores; un foco de otra escena nombrado al viajar no se muda (la carreta aparecía en la Biblioteca). Actividad t39/t03 de un NPC solo en su escena inicial. Foco de clima que ya no corresponde no se sugiere.
- Conocimiento: NPC sin nombre oído → por oficio («hablar con el panadero»); foco con el alias que mostró el texto; foco generado sin nombre en el texto no se ofrece.
- Vacío: mayúscula al inicio de oración en piezas juntadas (gramática y salida final); «la piedras» → «las piedras».
- NPC: «qué hacés acá» fuera de su lugar → `no_se` (antes, línea de rutina de otro sitio o «no entendí»).
- Comprensión: +202 frases reales (saludos, preguntas, cortesías, insultos, a medias, sin tildes, errores): 99.5 %, 0 falsos positivos. Arreglos: singular de alias plural («papel»), letras estiradas, k/ke/kien, muletillas, «no le doy bola», «me aburro» ≠ burro.
Cierre:
1. Cerrado: «dejar» = ignorar solo con animal/persona («dejo la carta» no ignora); 5 casos al corpus.
2. Cerrado: `data/config/focos-escenas.json` cargado; fuera de esas escenas el alias no abre el foco (test + barrido).
3. Excepción: «Un postigo golpea con el viento» (ventana_abierta, Archivo): el viento entra por la ventana.
4. Cerrado: falta_npc (y la 3.ª reformulación) nombra por oficio a los presentes no oídos.
5. Abierto: la validación «sin habla» de la IA es heurística; sin verificar con Groq ni modelo local reales.
