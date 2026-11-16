// Genera el diagnóstico de comprensión: node narrador/diagnosticoComprension.js
// Escribe docs/diagnostico-comprension.md (todos los casos) y imprime las filas de los que no coinciden con el diseño.
import { writeFileSync } from 'node:fs';
import { armarCasos, correrCaso } from './barridoComprension.js';
import { contenido } from './index.js';

const NOMBRE = { maren_archivista: 'Maren', serel_panadero: 'Serel' };
const celda = (t) => String(t).replaceAll('|', '/').replaceAll('\n', ' ');
const idDe = (npc, etiqueta) => {
  const m = /^rev(\d)$/.exec(etiqueta);
  if (!m) return etiqueta === 'fallo' ? 'ninguno ("no te cuenta nada nuevo")' : etiqueta;
  return contenido.npcs.find((n) => n.id === npc).conocimientos[m[1] - 1].id;
};
const filas = [];
for (const c of armarCasos()) {
  const r = await correrCaso(c);
  const ok = JSON.stringify(r.obtenido) === JSON.stringify(c.esperado);
  const diseno = c.esperado.map((e) => idDe(c.npc, e)).join(' → ') + (c.revisarConDiseno ? ' (revisar con diseño)' : '');
  filas.push({ ok, fila: `| ${NOMBRE[c.npc]} | ${celda(c.frases.join(' → '))} | ${c.relacion} | ${diseno} | ${celda(r.obtenido.join(' → '))}: ${celda(r.textos.join(' // '))} |` });
}
const CABECERA = '| NPC | Frase | Relación | Diseño dice | Resultado real |\n|---|---|---|---|---|\n';
const fallan = filas.filter((f) => !f.ok);
writeFileSync(
  new URL('../docs/diagnostico-comprension.md', import.meta.url),
  `# Diagnóstico de comprensión: todos los casos\n\nGenerado con \`node narrador/diagnosticoComprension.js\`. Casos: ${filas.length}. No coinciden con el diseño: ${fallan.length}.\n\n${CABECERA}${filas.map((f) => `${f.ok ? '' : '**NO** '}${f.fila}`).join('\n').replace(/^\*\*NO\*\* \|/gm, '| **NO COINCIDE** ')}\n`,
);
console.log(`${filas.length} casos, ${fallan.length} no coinciden`);
console.log(CABECERA + fallan.map((f) => f.fila).join('\n'));
