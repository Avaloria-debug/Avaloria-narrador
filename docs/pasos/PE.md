# PE — Rescate
El último paso dejó tests rojos o conducta incorrecta.
1. git log -3 y git diff HEAD~1 --stat. Identificar paso.
2. npm test; listar solo nombres fallidos.
3. Por cada uno, bucle de P0.
4. Causa de diseño → git revert, anotar en docs/SUPUESTOS-v3.md, proponer en 3 líneas cómo rehacer.
Informe: causa, arreglo o reversión, tests en verde sí/no.
