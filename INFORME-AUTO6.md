# INFORME AUTO6 — Comprensión del jugador
Rama: `claude/quirky-keller-fn77dr`. Pasos V1–V9 hechos (ninguno bloqueado).

- **Comprensión** (corpus de 680 frases, `node tools/medir-comprension.mjs`): 31 % → 99,9 %. Base = 655 casos con todas las etapas apagadas; 25 frases de control se sumaron en la autorrevisión.
- **Por categoría (base → final)**: verbos 91,8→100 · conjugación 0→100 · enclíticos 0→100 · tipeos 16,7→96,7 · referencias 0→100 · defaults 50→100 · aclaración 0→100 · ambiguas 66,7→100 · sinónimos 17,9→100 · NPC 48,1→100 · escenas 36,4→100 · varias 30,8→100 · negación 16,7→100 · modo 0→100 · sin sentido 100→100 · control 100.
- **Falsos positivos**: 0 en el corpus. La autorrevisión halló 6 (dale, seguro, doy una vuelta, qué hora es, tiro la moneda, sigo a ella); se corrigieron y quedaron como frases de control.
- **Única falla**: «seguir al buro» (empata con «búho»: no se corrige, por regla).
- **Ojo**: el corpus lo escribí yo, así que el 99,9 % mide sobre frases conocidas. La medida real saldrá de las no entendidas que exportes jugando.
- **Juego** (solo con ampliado): la lectura reescribe a la forma canónica cuando el verbo no se reconoce, pregunta si hay empate real, resuelve respuestas cortas, juega varias acciones en orden y trata «no sigo a X» como ignorar. Sin ampliado, la regresión es idéntica.
- **Compuertas**: verificar-partes todo/regresión, verificar-focos, verificar-producción, verificar-ialocal producción, humo y `npm test` (2031/0). Bots de focos 200×60: 100 % de menciones con respuesta.
- **Textos `prov` (a aprobar)**: `TEXTOS_ACLARACION` en `narrador/lectura.js` («¿{a} o {b}?», «¿Qué querés {verbo}?», «¿Con quién?»).
- **Sin verificar**: el botón «Exportar no entendidas» en un navegador real (portapapeles) y la página en general.
- **Pendiente de diseño**: `modo` (sigilo/prisa) llega como dato pero el motor no tiene efecto para él. «agarrar» es tocar en los focos y tomar en la lectura.
