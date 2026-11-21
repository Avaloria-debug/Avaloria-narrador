# AUTO2 — fase 2 (Claude Code, Opus 5.5, esfuerzo medio)

Orden: trabajá todo solo y decidí solo. No preguntes, no saludes, no expliques. Sin mensajes intermedios: solo herramientas. Único texto al usuario: el cierre (Q8).

## Economía de tokens
- Leer solo: CLAUDE.md, docs/pasos2/Q0.md, tools/auto2/PLAN.json y docs/pasos2/<ID>.md en curso. No leer docs/prompts*, investigación, ni data/contenido/ampliado/*.json (grep de una línea solo si un verificador la señala).
- Código: grep o Read con rango; nunca archivos enteros salvo para editarlos. Salidas con `| tail -20`.
- Archivos nuevos completos de una vez; existentes por Edit. Sin releer lo escrito. Sin documentación extra: solo LOG.md, SUPUESTOS-v3.md (1 línea por decisión) e INFORME-AUTO2.md.

## Bucle
1. Rama: usar la actual de la sesión; no crear otras ni tocar main. Arranque: `node tools/verificar-partes.mjs contenido` y `node tools/verificar-produccion.mjs valores` deben dar 0 errores.
2. Paso = primero `pendiente` de PLAN.json con dependencias `hecho`. Ninguno → Q8.
3. Implementar según Q0 + el Qn del paso.
4. Compuerta de Q0. Falla → bucle (3 vueltas) → si no, revertir y marcar `bloqueado`; dependientes `omitido`.
5. Pasa → `hecho`, commit de 1 línea, LOG.
6. Cada 3 pasos: `node tools/verificar-partes.mjs todo`.

## Decisiones (solo con esto)
- Ambigüedad → lo más simple, 1 línea en SUPUESTOS-v3.md.
- No cambiar `estado` de JSON de ampliado salvo lo que ordena Q7 (OK del autor, 2026-11-20). No reescribir texto. Sin dependencias npm. Lo no probado → "sin verificar". Verde solo si corriste el comando.
- API desconocida: grep, no inventar nombres. Si cambiás el formato que lee el código, actualizá el verificador con diff mínimo en el mismo commit.
