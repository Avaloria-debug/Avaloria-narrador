# Fase 5 — IA local en el navegador (cómo usarlo)
1. Descomprimir en la raíz del repo (solo agrega archivos nuevos; no pisa nada).
2. Claude Code (Opus 5.5, bajo), (la rama `claude/ia-local-fase5` la crea solo, desde `claude/quirky-keller-fn77dr`). Pegar una vez:

```
Leé tools/auto4/AUTO4.md y ejecutalo completo; después tools/auto5/AUTO5.md completo. Solo, sin mensajes intermedios.
```

3. Al terminar: `INFORME-AUTO5.md`. Decisiones A APROBAR: `node tools/auto5/aprobar5.mjs <Rn>` (lo corrés vos).
4. Probar a mano: `python -m http.server 8000` y abrir `/narrador/prueba/`. Para volver atrás: `?ialocal=0`.
5. Merge (vos, después de probar): `git checkout claude/quirky-keller-fn77dr && git merge claude/ia-local-fase5`; luego ambas a main.
6. Recomendado: correr después de la fase 4.
