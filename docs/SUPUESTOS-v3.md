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
