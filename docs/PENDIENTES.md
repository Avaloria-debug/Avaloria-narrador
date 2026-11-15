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

## Aperturas repetidas dentro de una misma clave
La regla "la apertura (primera palabra) no se repite entre las plantillas de una clave" no está en el validador: con las frases aprobadas, 16 claves la incumplen y el contenido dejaría de validar. Hoy el validador exige 3 plantillas distintas en exito y en fallo. Para activar la regla hay que cambiar una frase en cada una de estas claves:
- intencion_hablar_con.exito y .fallo: dos empiezan con {npc}.
- intencion_presionar.exito y .fallo: dos empiezan con {npc}.
- intencion_ayudar.fallo: dos empiezan con {npc}.
- intencion_observar.fallo: "Mirás" dos veces.
- intencion_comprar.exito: "Pagás" dos veces.
- intencion_retirarse.fallo, intencion_abortar.fallo, intencion_rendirse.fallo: "Querés" dos veces.
- intencion_huir.fallo, intencion_defender.fallo: "Intentás" dos veces.
- intencion_emboscar.fallo: "La" dos veces.
- intencion_ocultarse.exito: "Te" tres veces.
- intencion_avanzar_cautela.fallo: "Avanzás" dos veces.
- intencion_abortar.exito: "Das" dos veces.
