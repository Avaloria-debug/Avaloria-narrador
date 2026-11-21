# INFORME-AUTO — narrador ampliado (rama `claude/quirky-keller-fn77dr`)

## Pasos
- hecho (23): P1 P1.5 P2 P3 P4 P5 P6 P7 P8 P9 P10 P11 P12 P13 P14 P15 P16 P17 P18 P19 P20 P21 P22. bloqueado: 0. omitido: 0.
- Cierre: `verificar-partes todo` 0 errores · `npm test` 1861/1861 · `validarContenido` válido · regresión sin ampliado = base P1 (no se volvió a fijar).

## Decisiones (detalle en docs/SUPUESTOS-v3.md)
- Rama única `claude/quirky-keller-fn77dr`; t16: 36 ids renombrados a `_ampN` (orden del usuario).
- Producción no carga ampliado: solo si se pasa `opciones.ampliado` a `narrar` (estado en `estado.ext`).
- Todo lo nuevo pasa por `narrador/ampliado.js` con rng derivados; sin ampliado, `narrar` es idéntico.
- Eventos v3 no tienen texto: se narra el inicio/cierre (t09/t19); la saliencia elige variante, no cambia el disparo.
- Comprensión: pasadas raíz/trigramas solo si nada coincide, ganador único, cubren ≥50% de la frase, sin verbos de riesgo ni viajar.
- Eco: sin lista de insultos; la palabra tiene que existir en el vocabulario del contenido.
- Calendario: 360 días (90 por estación). Diario: comando = texto exacto "diario".

## A APROBAR
- Canon: t16 (conocimientos), t21 (consecuencias), t22 (objetivos), t27 (festividades); solo cargan con `incluirCanon`.
- `u_niebla_voces` (t12): bloqueado en código hasta aprobar.
- Faltan datos: `calendario.json` (fechas de festividades), `valores.json` (valores de los 12 NPCs).
- Registro Firestore: campo `pasada_comprension` (esquema cerrado; hoy queda en `turno.pasada`).
- t11 `verbo_desconocido`: sin disparador (no existe ese motivo en comprensión).
- Revisión: `node tools/revisar.js` → tools/reporte/revision.html.

## Sin verificar
- CI `.github/workflows/narrador.yml` (no corrido en GitHub). Carga del ampliado en navegador (no hay fetch de carpeta).
- Stemmer: verificado contra vocabulario oficial Snowball (28 378/28 378).

## Números (simulador 200×50, semilla 1): sin ampliado → con ampliado (pendientes + canon)
| métrica | antes | después |
|---|---|---|
| textos distintos | 544 | 5154 |
| palabras distintas | 441 | 2254 |
| aperturas distintas | 248 | 661 |
| escenas sin ambiente | 12 | 0 |
| excepciones | 0 | 0 |
- Plantillas v3 nunca usadas: 61 → 78 (el ampliado las diluye). Apertura más repetida igual ("hay más de", reformulación de destino del simulador).
