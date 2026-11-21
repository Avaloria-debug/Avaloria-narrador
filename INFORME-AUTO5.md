# INFORME AUTO5 — IA local en el navegador
Rama: `claude/quirky-keller-fn77dr` (la sesión solo permite pushear esa; no se creó `claude/ia-local-fase5`).

## Pasos
- R1 hecho: capacidad (WebGPU, iOS, en-app, móvil) y marca anti-crash. R2 hecho: contexto local ≤300 tokens.
- R3 hecho: motor local con la forma de `pedirRespuestaIA`, cadena principal → móvil → respaldo → plantilla.
- R4 hecho: `narrar()` usa `opciones.iaLocal` solo sin clave de Groq; sin `iaLocal`, regresión idéntica.
- R5 hecho: botón «Activar IA local» en `narrador/prueba/` (apagado por defecto). R6 hecho: verificar-modelo, bench, doc de hosting.
- Compuertas: verificar-ialocal produccion, verificar-partes todo, verificar-produccion todo, npm test (1983/0).

## A APROBAR (`node tools/auto5/aprobar5.mjs <Rn>`)
- R1: umbrales PC ≥20 tok/s, móvil ≥6 tok/s.
- R2: texto de `MENSAJE_SISTEMA_LOCAL`.
- R3: CDN del motor (jsdelivr `@mlc-ai/web-llm@0.2.79`) y modelos: PC Qwen2.5-1.5B, móvil Qwen2.5-0.5B, respaldo Qwen3-0.6B y Llama-3.2-1B (q4f16).
- R4: distinguir IA local de Groq en el registro (requiere cambiar `firestore.rules`; hoy ambas quedan como origen `ia`).
- R5: textos del botón y del aviso.

## Sin verificar
- WebGPU y WebLLM reales (ids de modelo, `enable_thinking`, stream), descarga y caché del modelo, `tamanoMB`.
- iOS, memoria de pestaña, velocidad en celular, la página en un navegador real (la prueba con Playwright no tuvo permiso).

## Probar a mano
- `python -m http.server 8000` → `/narrador/prueba/` (apagar: `?ialocal=0`; forzar: `?ialocal=forzar`).
- Medir: `/narrador/prueba/bench-ia.html`, «Medir», copiar el JSON.
