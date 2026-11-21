# INFORME AUTO8 — prioridad de narración, sistemas y economía
Rama `claude/quirky-keller-fn77dr`. Todos los pasos X1–X9 están hechos; ninguno quedó bloqueado. Compuertas en verde: `npm test` pasa 2118/0, comprensión 99,9 % (959 casos, economía 100 %, 0 falsos positivos), verificar partes, focos y producción con 0 errores, barrido sin hallazgos. Bots de juego 0 errores, bots de economía 12×300 con 0 errores y humo ok.
- **X1. Prioridad:** el orden es código → Groq → IA local → plantilla. Tras un 429, Groq queda en pausa el tiempo de retry-after (10 min si no lo trae) y responde la IA local, sin avisos al jugador. El motivo queda en `errores`. Tiene 9 tests: nivel por nivel, eco rechazado, pausa y vuelta a Groq.
- **X2. Sistemas:** `narrador/sistemas/index.js` guarda en `ext.sistema` un único sistema activo. Agrega los efectos nuevos `relacion`, `hecho`, `pago`, `cobro` y `reloj`. Un cambio de escena cierra el sistema.
- **X3. Monedas y precios:** los montos internos van en bronce y el estado sigue guardando plata + bronce (sin cambio de esquema). Se muestran en formato natural. Los precios aplican modificadores y los rangos salen fijos por día y vendedor.
- **X4. Regateo:** según el rasgo `dinero` y la relación, con 3 rondas, contraoferta, trueque (los hallazgos valen más para Ivor y Maren) y pagar de más (+relación).
- **X5. Trabajos:** 4 trabajos de t41. Cada uno tiene 2–3 pasos que avanzan el reloj, puede traer un contratiempo (×0,6) o un rumor, y hay uno por NPC por día. Abandonar no paga y baja la relación.
- **X6. Favores:** ayudar a un NPC hace que te deba un favor, y llevar algo fiado hace que el jugador le deba a él. Las deudas se cobran a los 2–6 días y terminan saldadas o incumplidas. Pagar con información vale una vez.
- **X7. Exhibir dinero:** `ext.atencion_ladrones` sube en escenas concurridas y decae 1 por día. La fase 9 se engancha con `atencionDecaida`. `sin_dinero` sale de t41.
- **X8. t41 y bots:** t41 está en el manifest y entra en la fusión como `amp.economia`. Se sumaron `tools/bots-economia.js` y 40 frases (categoría `economia`).

A APROBAR:
- t41 (`a_aprobar`) y `data/config/precios.json` (provisional).
- Textos `prov` en `narrador/economia/textos.js` (`TEXTOS_ECONOMIA`).
- Los supuestos de la fase 8 en `docs/SUPUESTOS-v3.md`.
- Esquema: sin cambios. Lo nuevo vive en `ext` y en `iaGroqPausaHasta` del estado; no hay campos nuevos en el registro.

Sin ampliado, la salida es idéntica a la de antes (regresión en verde).

Sin verificar: navegador real, Groq real (cabeceras 429/retry-after) e IA local real.
