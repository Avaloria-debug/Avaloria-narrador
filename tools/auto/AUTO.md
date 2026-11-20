# AUTO — ejecución autónoma (Claude Code, Opus 5.5, esfuerzo medio)

Orden: trabajá todo solo y decidí solo. No preguntes. No saludes ni expliques. Sin mensajes de progreso ni resúmenes entre pasos: solo llamadas a herramientas. Único texto al usuario: el cierre (§5).

## Economía de tokens (obligatorio)
- Leer solo: CLAUDE.md, docs/pasos/P0.md, tools/auto/PLAN.json, y docs/pasos/<ID>.md del paso en curso. NO leer docs/prompts-narrador-v2.md, docs/investigacion-narrador-v1.md ni data/contenido/ampliado/*.json (el verificador los revisa; leer una línea solo si el verificador la señala, con grep).
- Código existente: grep/Read con rango; nunca archivos enteros salvo que se vayan a editar.
- Salidas largas: `| tail -20`. Tests: `npm test 2>&1 | tail -20`; solo ampliar si falla.
- Archivos nuevos completos de una vez; existentes por Edit. No releer lo recién escrito.
- No repetir código en texto. Commits de 1 línea. Un archivo LOG por pasos (tools/auto/LOG.md).
- No crear documentación extra. Solo: SUPUESTOS-v3.md (1 línea por decisión), LOG.md, INFORME-AUTO.md (cierre).

## 1. Rama única
Crear `auto/narrador-ampliado-v2-nov2026` desde la rama por defecto (si existe: `-2`, `-3`…). TODO lo nuevo va ahí y solo ahí. No otras ramas ni worktrees, no tocar `main` ni ramas existentes, no mergear. Al final `git push -u origin <rama>` solo si hay remoto y credenciales; si no, local. Un commit por paso.

## 2. Arranque
`git checkout -b auto/narrador-ampliado-v2-nov2026` → `node tools/verificar-partes.mjs contenido` (0 errores; si no, corregir solo la línea/clave rota) → `npm test 2>&1 | tail -20` (si base roja: anotar en LOG y seguir).

## 3. Bucle
1. Paso = primero `pendiente` de PLAN.json con dependencias `hecho`. Ninguno → §5.
2. Implementar según docs/pasos/<ID>.md + docs/pasos/P0.md.
3. Compuerta: `node tools/verificar-partes.mjs paso <ID>` (archivos, tests, npm test, contenido, código↔contenido, regresión sin ampliado idéntica y determinista).
4. Falla → bucle de P0 (máx. 3 vueltas, leer solo el error). Pasa → `estado:"hecho"`; si `cambiaConducta` y la regresión cambió por diseño: `node tools/verificar-partes.mjs regresion --fijar-base`; VERSION +0.0.1; commit.
5. 3 vueltas sin éxito → revertir lo del paso (`git checkout -- . && git clean -fd`), `bloqueado` + causa en LOG, dependientes `omitido`, seguir con independientes.
6. Cada 3 pasos hechos: `node tools/verificar-partes.mjs todo`.

## 3b. Contrato del simulador (P1)
`node tools/simular.js --semilla 1 --partidas 20 --turnos 30 --salida stdout [--sin-ampliado] [--incluir-canon]` imprime SOLO JSON `{metricas:{...},textos:[...]}`, determinista. `--sin-ampliado` = v3 puro. Tras P1: `node tools/verificar-partes.mjs regresion --fijar-base` y commitear `tools/auto/baseline.sha`.

## 4. Reglas de decisión
- Ambigüedad → lo más simple; 1 línea en docs/SUPUESTOS-v3.md (paso | decisión | alternativa).
- Test viejo que falla: si el cambio de conducta es el objetivo del paso, actualizarlo; si no, el código nuevo está mal.
- API del repo: leerla con grep, no inventar nombres. Adaptar el módulo nuevo antes que cambiar uno existente.
- NUNCA cambiar `estado` de los JSON de ampliado. Producción carga `a_aprobar`; `a_aprobar_canon` no. Con `--incluir-canon` (simulador, tests) se cargan ambos.
- No reescribir ni mejorar texto. Corregir una línea solo si la compuerta la marca rota. Clave de texto nueva necesaria → "A APROBAR" en el cierre, sin escribirla.
- Sin dependencias npm nuevas. Sin red: lo no probado → "sin verificar". Verde solo si corriste el comando.
- Clave `c` o placeholder nuevo en código → agregarlo a DOM/PH de tools/verificar-partes.mjs en el mismo commit. Falso positivo claro del verificador → corregir con diff mínimo.
- Nada destructivo fuera de la rama.

## 5. Cierre
`node tools/verificar-partes.mjs todo`; `npm test 2>&1 | tail -20`; P13. Escribir INFORME-AUTO.md (máx. 40 líneas, sin prosa): pasos hecho/bloqueado/omitido con causa; decisiones (de SUPUESTOS); A APROBAR (canon t16, t21, t22, t27; `u_niebla_voces`; textos faltantes); sin verificar; 5 números antes/después. Mensaje final al usuario: ≤8 líneas.
