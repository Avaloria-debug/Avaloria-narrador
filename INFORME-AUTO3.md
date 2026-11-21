# INFORME-AUTO3 — fase 3: focos
## Pasos
- S1–S7: hecho (cf6ed85 … 951eb01). S8: hecho. Bloqueados/omitidos: ninguno.
- Compuertas: verificar-focos 0 errores · verificar-partes todo 0 · verificar-produccion todo 0 · npm test 1906/0 · humo ok (60 turnos, acciones sobre focos).
## Antes / después (bots 200×60, semilla 1)
| métrica | antes (sin motor) | después |
|---|---|---|
| % menciones accionables | 26,47 | 100 |
| focos propios / generados | 0 / 0 | 5166 / 85 |
| interrupciones | 0 | 12 |
| textos distintos | 4720 | 4750 |
| palabras distintas | 1620 | 1732 |
## Top 30 sustantivos sin foco (próxima tanda)
rato, lluvia, mañana, vista, calor, primera, cuerpo, niebla, puerta, moneda, lámpara, copista, cara, multitud, poco, turno, capilla, noche, mira, paso, misma, último, error, tiene, oscuridad, charla, buen, lugar, bolsa, lacayo
(heurística: palabra tras artículo; incluye ruido como «poco», «tiene», «misma»).
## Sin verificar
- Navegador real (focos por fetch con `cargarPendientes` por defecto) y GitHub Actions.
- `preguntar por X a NPC`: responde con la clase, no con la voz del NPC (t30 no trae líneas por NPC).
- Ningún foco trae `npc` dueño: la excepción «el foco es del NPC» no se ejerce.
## Probar a mano
1. Mercado: «hablar con serel», luego «seguir a la gata» ×3 (entra la voz de Serel; patio con gatas).
2. «mirar las gatas», después «hablar con serel» (línea de regreso, una vez).
3. «examinar la mesa» (no está en el mercado) y «examinar la fuente» (fijo).
