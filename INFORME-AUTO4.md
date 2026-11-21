# INFORME AUTO4 — fase 4 (t31 + t32)
- U1 hecho: t32 fusionado con t30 (61 focos; id repetido entre tandas = error de carga), t31 cargado en `focos.preguntar`, `{foco}` admitido como placeholder, manifest regenerado.
- U2 hecho: `preguntar por X [a NPC]` con NPC presente y foco visto → línea de t31 del NPC para la clase del foco; sin NPC → rama/clase de t30; no visto → no_visto.
- U3 hecho: bots con preguntar + NPC; stopwords del reporte en tools/bots-focos.js.
- Compuerta: verificar-focos 0, verificar-preguntar 0, verificar-partes todo 0, verificar-produccion 0, npm test 1914/0, humo ok.
- Bots 200×60: menciones con respuesta 26.47 % sin motor → 100 % (169 119 pruebas); preguntar con NPC 22 874, en voz de t31 97.93 %.
- Top 20 sin foco: mañana, calor, cuerpo, oído, vista, cara, multitud, noche, capilla, paso, oscuridad, olla, capa, esquina, señor, rutina, lacayo, séquito, noble, aire.
- Sin verificar: navegador real, GitHub Actions. t31 y t32 siguen en `a_aprobar` (se cargan solo con pendientes).
