# SUPUESTOS v3

## Barrido de comprensión por relación
- Maren y Serel tienen dos conocimientos cada uno (`_1` y `_2`, con su umbral: Maren 40 y 30, Serel 30 y 25). Las secuencias de dos preguntas piden `_1` con la primera y `_2` con la segunda, con relación 50.
- "Esperado" de una frase de un solo paso: si trae una palabra clave de un conocimiento del NPC presente, revela ese conocimiento con relación >= su umbral y si no, "no te cuenta nada nuevo". Si no trae palabra clave del NPC (por ejemplo los temas del otro NPC), se espera reformulación.
- "ok" se espera como reconocimiento ("asiente").
- Los casos se corren con semilla 11, con el jugador en la escena inicial del NPC y la relación fijada en el estado.
