# AUTO4 — fase 4: t31 (preguntar en voz del NPC) y t32 (más focos) — Claude Code, Opus 5.5, esfuerzo medio

Orden: trabajá todo solo y decidí solo. No preguntes, no saludes, no expliques. Sin mensajes intermedios: solo herramientas. Único texto al usuario: el cierre (U3).

## Economía de tokens
- Leer solo: CLAUDE.md, docs/pasos4/U0.md, tools/auto4/PLAN.json y docs/pasos4/<ID>.md en curso. No leer docs/prompts*, investigación ni data/contenido/ampliado/*.json (los validan los verificadores; grep de una línea si algo lo señala).
- Código: grep o Read con rango; nunca archivos enteros salvo para editarlos. Salidas con `| tail -20`. Archivos nuevos completos; existentes por Edit. Sin releer lo escrito. Documentación: solo LOG.md, SUPUESTOS-v3.md (1 línea por decisión) e INFORME-AUTO4.md.

## Bucle
1. Rama actual (no crear otras, no tocar main). Arranque: `node tools/verificar-focos.mjs todo`, `node tools/verificar-preguntar.mjs` y `node tools/verificar-partes.mjs contenido` → 0 errores (si verificar-partes falla solo por `{foco}`, arreglarlo según U1).
2. Paso = primero `pendiente` con dependencias `hecho`; ninguno → cierre U3.
3. Implementar según U0 + el Un del paso. Compuerta de U0. Falla → 3 vueltas → revertir y `bloqueado`.
4. Pasa → `hecho`, commit de 1 línea, LOG.

## Decisiones
- Ambigüedad → lo más simple, 1 línea en SUPUESTOS-v3.md. API desconocida: grep, no inventar nombres. No reescribir texto de ampliado. Verde solo si corriste el comando; lo no probado → "sin verificar".
