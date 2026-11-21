# AUTO8 — Prioridad de narración, interfaz de sistemas y economía (Claude Code, Opus 5.5, esfuerzo medio)

Orden: trabajá todo solo y decidí solo. No preguntes, no saludes. Sin mensajes intermedios: solo herramientas. Único texto al usuario: el cierre (X9, máx. 8 líneas).

## Rama
- `git fetch --all`; rama remota más reciente (esperado `claude/quirky-keller-fn77dr`). Si la sesión solo permite otra, usar esa y anotarlo. No tocar main, no mergear, sin push forzado.

## Economía de tokens
- Leer solo: CLAUDE.md, docs/pasos8/X0.md, PLAN.json y el Xn en curso. Código por grep o Read con rango; salidas `| tail -20`. JSON de contenido: solo `nota` y claves (`node -e`).
- Archivos nuevos completos; existentes por Edit. Documentación: solo LOG.md, SUPUESTOS-v3.md (1 línea) e INFORME-AUTO8.md.

## Bucle
1. Paso = primero `pendiente` con dependencias `hecho`. Ninguno → X9.
2. Implementar según X0 + Xn. Compuerta de X0. Falla → 3 vueltas leyendo solo el error → revertir y `bloqueado`; dependientes `omitido`.
3. Pasa → `hecho`, commit de 1 línea, 1 línea en tools/auto8/LOG.md.

## Autorrevisión (cada 2 pasos hechos y al cierre)
- Todas las compuertas + regresión + bots + barrido. Buscar: imports rotos, exports sin uso, TODO, console.log, dinero negativo, precios NaN, montos sin moneda, textos repetidos, favores huérfanos, sistemas que no cierran.
- Arreglar (máx. 3 vueltas, commit `fix: ...`) o revertir. 1 línea en LOG.

## Decisiones
- Ambigüedad → lo más simple, 1 línea en SUPUESTOS. Sin dependencias npm. Textos nuevos `prov`. Verde solo si corriste el comando.
- Principio de diseño (canon): el mundo es neutral; ni código ni azar ni IA favorecen al jugador. «Todo tiene un precio»: dinero, trabajo, favores, información, bienes.
