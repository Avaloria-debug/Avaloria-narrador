# AUTO7 — Pulido de juego y narración (Claude Code, Opus 5.5, esfuerzo medio)

Orden: trabajá todo solo y decidí solo. No preguntes, no saludes. Sin mensajes intermedios: solo herramientas. Único texto al usuario: el cierre (W8, máx. 8 líneas).

## Rama
- `git fetch --all`; usar la rama remota más reciente (esperado `claude/quirky-keller-fn77dr`). Si la sesión solo permite otra, usar esa y anotarlo. No tocar main, no mergear, sin push forzado.

## Economía de tokens
- Leer solo: CLAUDE.md, docs/pasos7/W0.md, PLAN.json y el Wn en curso. Código por grep o Read con rango; salidas `| tail -20`. No leer data/contenido/ampliado/*.json enteros (grep o `node -e` para claves).
- Archivos nuevos completos; existentes por Edit. Documentación: solo LOG.md, SUPUESTOS-v3.md (1 línea) e INFORME-AUTO7.md.

## Bucle
1. Paso = primero `pendiente` con dependencias `hecho`. Ninguno → W8.
2. Implementar según W0 + Wn. Compuerta de W0. Falla → 3 vueltas leyendo solo el error → revertir y `bloqueado`; dependientes `omitido`.
3. Pasa → `hecho`, commit de 1 línea, 1 línea en tools/auto7/LOG.md.

## Autorrevisión (cada 2 pasos hechos y al cierre)
- Todas las compuertas + regresión + bots. Buscar: imports rotos, exports sin uso, TODO, console.log, textos repetidos seguidos, botones sin acción, `undefined` en salida.
- Arreglar (máx. 3 vueltas, commit `fix: ...`) o revertir. 1 línea en LOG.

## Decisiones
- Ambigüedad → lo más simple, 1 línea en SUPUESTOS. Sin dependencias npm. Textos nuevos de interfaz `prov`. Verde solo si corriste el comando; navegador = "sin verificar" si no lo abriste.
