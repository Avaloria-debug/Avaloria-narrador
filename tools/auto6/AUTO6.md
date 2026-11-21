# AUTO6 — Comprensión del jugador (Claude Code, Opus 5.5, esfuerzo medio)

Orden: trabajá todo solo y decidí solo. No preguntes, no saludes. Sin mensajes intermedios: solo herramientas. Único texto al usuario: el cierre (V9, máx. 8 líneas).

## Rama
- `git fetch --all`; usar la rama remota más reciente (`git for-each-ref --sort=-committerdate refs/remotes --count=3`), esperado `claude/quirky-keller-fn77dr`. Trabajar ahí; si la sesión solo permite otra, usar esa y anotarlo. No tocar main, no mergear, sin push forzado.
- Si tools/auto4/PLAN.json tiene pasos `pendiente`, ejecutar antes tools/auto4/AUTO4.md.

## Economía de tokens
- Leer solo: CLAUDE.md, docs/pasos6/V0.md, PLAN.json y el Vn en curso. Código por grep o Read con rango; salidas `| tail -20`. No leer data/contenido/ampliado/*.json salvo alias de focos por grep.
- Archivos nuevos completos; existentes por Edit. Documentación: solo LOG.md, SUPUESTOS-v3.md (1 línea) e INFORME-AUTO6.md.

## Bucle
1. Paso = primero `pendiente` con dependencias `hecho`. Ninguno → V9.
2. Implementar según V0 + Vn. Compuerta de V0. Falla → 3 vueltas leyendo solo el error → revertir y `bloqueado`; dependientes `omitido`.
3. Pasa → `hecho`, commit de 1 línea, 1 línea en tools/auto6/LOG.md con el % de comprensión.

## Autorrevisión (cada 2 pasos hechos y al cierre)
- Todas las compuertas + regresión. Buscar: imports rotos, exports sin uso, TODO, console.log, falsos positivos nuevos (frases que antes no se entendían y ahora se entienden MAL).
- Arreglar (máx. 3 vueltas, commit `fix: ...`) o revertir. 1 línea en LOG.

## Decisiones
- Ambigüedad → lo más simple, 1 línea en SUPUESTOS. Sin dependencias npm. Sin texto narrativo nuevo en código salvo preguntas de aclaración (marcadas `prov`). Verde solo si corriste el comando.
