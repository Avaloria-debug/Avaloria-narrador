#!/usr/bin/env node
// Chequeo estático del workflow de CI (Q6), sin dependencias (sin parser YAML: por líneas).
// Uso: node tools/verificar-yml.mjs [ruta]. Sale con 1 si hay errores.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function verificarYml(texto, raiz = RAIZ) {
  const errores = [];
  const lineas = texto.split('\n');
  const tiene = (re) => lineas.some((l) => re.test(l));
  for (const [re, k] of [[/^on:/, 'on'], [/^jobs:/, 'jobs'], [/^\s+steps:/, 'steps']]) if (!tiene(re)) errores.push(`falta ${k}`);
  for (const l of lineas) {
    const m = /uses:\s*([^\s#]+)/.exec(l);
    if (m && !/@v?\d[\w.-]*$/.test(m[1])) errores.push(`action sin versión fijada: ${m[1]}`);
  }
  if (tiene(/deploy-pages|upload-pages-artifact|gh-pages|pages:\s*write/)) errores.push('el workflow despliega a Pages');
  if (!tiene(/actions\/upload-artifact@/)) errores.push('falta upload-artifact');
  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  for (const l of lineas) {
    const m = /^\s*-?\s*run:\s*(.+)$/.exec(l);
    if (!m) continue;
    const cmd = m[1].trim();
    const npm = /^npm (?:run )?(\w+)/.exec(cmd);
    if (npm && !['install', 'ci'].includes(npm[1]) && !pkg.scripts?.[npm[1]]) errores.push(`script npm inexistente: ${npm[1]}`);
    const node = /^node ([\w./-]+\.m?js)/.exec(cmd);
    if (node && !fs.existsSync(path.join(raiz, node[1]))) errores.push(`archivo inexistente: ${node[1]}`);
  }
  return errores;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const ruta = process.argv[2] ?? path.join(RAIZ, '.github/workflows/narrador.yml');
  const e = verificarYml(fs.readFileSync(ruta, 'utf8'));
  console.log(`yml: ${e.length} errores`);
  e.forEach((x) => console.log('ERROR ' + x));
  process.exit(e.length ? 1 : 0);
}
