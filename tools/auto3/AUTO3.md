# AUTO3 — fase 3: focos (Claude Code, Opus 5.5, esfuerzo medio)

Objetivo del autor: todo lo que el juego menciona se puede seguir/mirar/llamar/tocar/preguntar; cada cosa tiene un camino (a veces solo pérdida de tiempo); si el jugador abandona una charla por un foco, el NPC lo nota y lo recuerda.
Orden: trabajá todo solo y decidí solo. No preguntes, no saludes, no expliques. Sin mensajes intermedios: solo herramientas. Único texto al usuario: el cierre (S8).

## Economía de tokens
- Leer solo: CLAUDE.md, docs/pasos3/S0.md, tools/auto3/PLAN.json y docs/pasos3/<ID>.md en curso. No leer docs/prompts*, investigación, ni data/contenido/ampliado/*.json (t30-focos.json lo valida tools/verificar-focos.mjs; grep de una línea si algo lo señala).
- Código: grep o Read con rango; nunca archivos enteros salvo para editarlos. Salidas con `| tail -20`.
- Archivos nuevos completos de una vez; existentes por Edit. Sin releer lo escrito. Documentación: solo LOG.md, SUPUESTOS-v3.md (1 línea por decisión) e INFORME-AUTO3.md.

## Bucle
1. Rama actual de la sesión (no crear otras, no tocar main). Arranque: `node tools/verificar-focos.mjs todo` y `node tools/verificar-partes.mjs contenido` deben dar 0 errores.
2. Paso = primero `pendiente` con dependencias `hecho`. Ninguno → S8.
3. Implementar según S0 + el Sn del paso. 4. Compuerta de S0. Falla → bucle de 3 vueltas → si no, revertir y `bloqueado` (dependientes `omitido`).
5. Pasa → `hecho`, commit de 1 línea, LOG. Cada 3 pasos: `node tools/verificar-partes.mjs todo`.

## Decisiones
- Ambigüedad → lo más simple, 1 línea en SUPUESTOS-v3.md. API desconocida: grep, no inventar nombres.
- No reescribir texto de ampliado. Texto faltante → A APROBAR. Sin dependencias npm. Verde solo si corriste el comando; lo no probado → "sin verificar".
- Prioridad de interpretación del input: foco activo > comportamiento anterior.
