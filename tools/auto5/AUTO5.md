# AUTO5 — IA local en el navegador (Claude Code, Opus 5.5, esfuerzo bajo)

Orden: trabajá todo solo y decidí solo. No preguntes, no saludes, no expliques. Sin mensajes intermedios: solo herramientas. Único texto al usuario: el cierre (R7, máx. 8 líneas).

## Economía de tokens
- Leer solo: CLAUDE.md, docs/pasos5/R0.md, tools/auto5/PLAN.json y docs/pasos5/<ID>.md en curso. Una vez y con rango: exports de narrador/ia.js, `pedirRespuestaIA` y el bloque `TIPOS_TURNO.IA` de narrador/index.js (grep). No leer docs/prompts*, investigación ni data/contenido/*.
- Código: grep o Read con rango; salidas con `| tail -20`. Archivos nuevos completos de una vez; existentes por Edit. Sin releer lo escrito. Sin documentación extra: solo LOG.md, SUPUESTOS (1 línea) e INFORME-AUTO5.md.

## Bucle
1. Rama: `git checkout claude/quirky-keller-fn77dr && git pull` y `git checkout -b claude/ia-local-fase5`; todo el trabajo va ahí. No tocar main ni quirky-keller. Sin push forzado; no mergear. Si la sesión no permite crear o pushear esa rama: trabajar en la rama asignada a la sesión, anotarlo en SUPUESTOS e informarlo en el cierre. Si tools/auto4/PLAN.json tiene pasos `pendiente`, ejecutar antes tools/auto4/AUTO4.md en quirky-keller. Arranque: verificar que `ia.js` exporta `estimarTokens, datosDeContexto, armarContexto, validarSalida, ErrorDeContexto, SIN_IA, MOTIVOS_IA` y localizar `fuegoSinEvento` con grep (si vive en otro módulo, importarlo de ahí; si no existe, anotarlo en SUPUESTOS y reutilizar el chequeo equivalente existente, sin copiar lógica); `node tools/verificar-ialocal.mjs contenido` y `npm test 2>&1 | tail -20` en verde.
2. Paso = primero `pendiente` de PLAN.json con dependencias `hecho`. Ninguno → R7.
3. Implementar según R0 + el Rn.
4. Compuerta: `node tools/verificar-ialocal.mjs paso Rn` + `node tools/verificar-partes.mjs todo` + `npm test 2>&1 | tail -20`. Si tocó narrador/ o la página: `node tools/verificar-ialocal.mjs version`.
5. Falla → 3 vueltas por error (leer solo el error). Si no: revertir (`git checkout -- . && git clean -fd`), `bloqueado`; dependientes `omitido`.
6. Pasa → `hecho` en PLAN.json, commit de 1 línea, 1 línea en tools/auto5/LOG.md.

## Decisiones
- Ambigüedad → lo más simple y 1 línea en docs/SUPUESTOS-v3.md (`R<n> | decisión | alternativa`).
- A APROBAR: valor provisional (`"prov":true`) y `aprobacion` en `a_aprobar`. Nunca correr tools/auto5/aprobar5.mjs.
- API desconocida (WebLLM, WebGPU, Hugging Face): no inventar nombres; marcar "sin verificar". Verde solo si corriste el comando.
- `cambiaConducta: true` = toca código existente: la compuerta suma regresión (salida del simulador sin cambios).
- Sin dependencias npm. Si cambiás un formato que lee un verificador, actualizalo con diff mínimo en el mismo commit.

## Modelo (lo elige Code, no es A APROBAR)
- Verificar los ids en la lista oficial de modelos precompilados del motor (WebLLM: `prebuiltAppConfig`); no inventar ids.
- Criterio: español, tamaño de descarga, VRAM, licencia abierta. Candidatos: PC → Qwen2.5-1.5B-Instruct q4; móvil → Qwen2.5-0.5B-Instruct o Qwen3-0.6B q4; respaldo → Llama-3.2-1B-Instruct q4.
- `modelo-manifest.json`: `{"principal":{...},"movil":{...},"respaldo":[...]}`. Si el principal falla al cargar o queda bajo el umbral de velocidad → siguiente; si fallan todos → plantilla. Tests con motor falso para toda la cadena.
- Elección + razón en 1 línea de SUPUESTOS.

## Autorrevisión (cada 2 pasos hechos y al cierre)
- Correr todas las compuertas + `node tools/verificar-focos.mjs todo` + regresión. Buscar: imports rotos, exports sin uso, `TODO`, `console.log`, textos sin `prov`, presupuesto de tokens, `<think>` sin limpiar.
- Si algo falla: arreglarlo (máx. 3 vueltas, commit `fix: ...`) o, si no se puede, revertir y marcar bloqueado. 1 línea en LOG por revisión.
