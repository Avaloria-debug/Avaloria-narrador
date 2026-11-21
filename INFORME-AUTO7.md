# INFORME AUTO7 — Pulido de juego y narración
Rama: `claude/quirky-keller-fn77dr`. W1–W8 hechos (W6 con alcance reducido, ver abajo).

- **W1**: las aclaraciones distinguen candidatos («¿El perro de la plaza o el del cruce?» / «¿El perro o el de granja?»). «agarrar/tomar/levantar» → tomar si es transportable (objeto con hallazgo o del inventario), si no → tocar; se decide en un solo lugar (`tomarOTocar`).
- **W2**: historial de 30 líneas (`ext.lineas`) consultado por todos los selectores. En 200 turnos en la misma escena, las repeticiones bajan de 29 a 22; las que quedan son de listas agotadas.
- **W3**: cada «no entendí» suma «Podrías …» con 2–3 acciones reales (foco activo, NPC, salida), al final del turno.
- **W4**: t39 cargado: primera visita / regreso, transición antes de cada llegada, ambiente cada 2–3 turnos (los eventos reinician la cuenta), cierre. Densidad breve/normal/rica con selector en la página.
- **W5**: fila de 4–8 botones sobre la barra → verbos → ejecuta la frase (pasa por la lectura). ✎ o toque largo la escribe sin ejecutar. Se puede ocultar.
- **W6 (reducido)**: el ampliado pesa 451 KB (137 KB gzip, 31 ms en Node); solo el 20 % depende de la escena. Se hizo fetch en paralelo + caché, sin paquetes por escena (ahorrarían ~25 KB gzip). A decidir.
- **W7**: bots 12 escenas × 500 turnos: 0 errores, 294 cambios de escena, 878 sugerencias válidas. Se informan 220 repeticiones dentro de la ventana y 3 seguidas (listas de 2 variantes; foco agotado → «ignorar», regla de fase 3). Top 10 por escena en `tools/reporte/juego.json`.
- **Compuertas**: comprensión 99,9 % (689 frases, 0 falsos positivos), verificar-partes/focos/producción/ialocal, regresión sin ampliado idéntica, humo, bots de focos 100 %, `npm test` 2065/0.
- **Textos `prov` a aprobar**: `TEXTOS_SUGERENCIA` y `ROTULOS_VERBO` (narrador/sugerencias.js), `TEXTOS_FILA` (narrador/prueba/filaOpciones.js), t39 completo (`a_aprobar`).
- **Sin verificar**: la página en navegador real y en móvil (fila deslizable, toque largo, botones ≥44 px, selector de densidad).
