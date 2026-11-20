# Cómo usarlo

1. Descomprimir el zip en la raíz del repo `avaloria-narrador` (respeta rutas).
2. Abrir Claude Code en el repo (Opus 5.5) y pegar UNA vez:

```
Leé tools/auto/AUTO.md y ejecutalo completo, solo. Sin mensajes intermedios.
```

3. Al terminar: revisar `INFORME-AUTO.md` y la rama única `auto/narrador-ampliado-v2-nov2026` (todo el trabajo nuevo va ahí; `main` no se toca).

Verificación manual en cualquier momento:
- `node tools/verificar-partes.mjs contenido` (contenido vs v3 y entre tandas)
- `node tools/verificar-partes.mjs todo`
- `node tools/verificar-partes.mjs paso P4`
