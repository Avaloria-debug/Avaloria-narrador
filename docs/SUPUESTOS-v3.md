# SUPUESTOS v3

## Barrido de comprensión por relación
- Ningún NPC del contenido tiene un conocimiento `_2` (todos tienen uno solo). Las secuencias de dos preguntas esperan `_2` en la segunda y por eso quedan pendientes; no se inventó contenido.
- "Esperado" de una frase de un solo paso: si trae una palabra clave del conocimiento del NPC presente, revela `_1` con relación >= umbral (Maren 40, Serel 30) y si no, "no te cuenta nada nuevo". Si no trae palabra clave del NPC (llave, cerradura, hornos y los temas del otro NPC), se espera reformulación.
- "ok" se espera como reconocimiento ("asiente").
- Los casos se corren con semilla 11, con el jugador en la escena inicial del NPC y la relación fijada en el estado.
