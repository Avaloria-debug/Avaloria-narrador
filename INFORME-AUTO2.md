# INFORME-AUTO2 — fase 2 (rama `claude/quirky-keller-fn77dr`)

## Pasos
- hecho: Q1 (calendario.json y valores.json), Q2 (manifest + carga por fetch), Q3 (página de prueba), Q4 (pasada_comprension), Q5 (humo HTTP), Q6 (CI).
- bloqueado: Q7. `tools/aprobar.js` está hecho y probado en una copia temporal, pero aplicar la aprobación del canon quedó denegado por los permisos de la sesión. No cambió el `estado` de ningún JSON.
- Q8: cierre con `verificar-partes todo` 0 errores, `verificar-produccion todo` 0 errores, `npm test` verde y humo ok.

## Decisiones (docs/SUPUESTOS-v3.md)
- calendario.json (lista con `dia`) se convierte en el código; los archivos no se tocan.
- valores.json y calendario.json siguen su `estado` (canon: solo con incluirCanon).
- No hay `ui/` ni `index.html` en la raíz: se activó en `narrador/prueba/app.js`. `?ampliado=0` o localStorage `ampliado=0` lo apagan.
- La carga en el navegador lee `manifest.json`; un error deja v3 puro con aviso en consola.

## Pendiente del autor
- Aprobar el canon (a mano):
  `for t in t16-conocimientos t21-consecuencias t22-objetivos t27-calendario calendario valores; do node tools/aprobar.js $t; done`
  y después generar docs/APROBACION.md. Revertir: `node tools/aprobar.js <tanda> --revertir`.
- `u_niebla_voces`: sigue bloqueado en el código (`UNICOS_BLOQUEADOS`) hasta confirmar la aprobación.
- firestore.rules (no tocado): agregar `'pasada_comprension'` a `camposDeRegistro()`. Si el estado del narrador se sube a `/partidas`, agregar `'ext'` al `hasOnly`.

## Sin verificar
- Navegador real (fetch, localStorage, DOM, CSS) y GitHub Actions (solo chequeo estático con `tools/verificar-yml.mjs`).
