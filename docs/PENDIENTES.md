## Bloque 3b: cerrado
- npcs.js, conocimientos.js, efectosEventos.js y movimientoNpcs.js fueron revisados sin errores (commit 9b0bb5b).
- Costo en reloj de cada acción: resuelto en el contenido (`reglas.costoHorasPorVerbo`) y anotado en docs/SUPUESTOS.md.
- Correcciones hechas fuera de resolver/turno en este bloque: "ayudar" vs "saludar" (coincidencia exacta gana), lugares de camino como destino de viajar, evento por hora con duración en turnos que venció durante un viaje.

## Bloque 4: narración por plantillas (hecho)
- Leer prompt v3, sección 5.5, y plantillas de data/contenido/contenido-v3.json.
- Implementar narrador/narracion.js: placeholders {npc}, {objeto}, {lugar}, {conocimiento}, {nombres}.
- Ventana de 5 aperturas sin repetir.
- Si falta un valor de placeholder, elegir una plantilla que no lo necesite.
- Reformulaciones: usar plantillas.reformulacion (ya existen).
- Tests: placeholders, variación de aperturas, falta de valor, reformulaciones.

## Bloque 5
- 5a (hecho): cliente de la IA (narrador/ia.js) y registro con cola local (narrador/registro.js).
- 5b (hecho): contrato público en narrador/index.js (crearPartida, cargarPartida, narrar).
- 5c (pendiente): Firestore. Falta conectar la cola de registros con lo que devuelve narrar.
- A verificar con una clave real antes de cerrar: parámetros y cabeceras de Groq, conteo real de tokens y si el razonamiento consume los 120 tokens de salida.
