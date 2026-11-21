#!/usr/bin/env node
// Escribe data/contenido/ampliado/manifest.json = { archivos: [{ f, estado, tanda }] }, ordenado por nombre.
// El navegador no puede listar carpetas: lee este manifest y después cada archivo (narrador/contenidoAmpliado.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/contenido/ampliado');

export function armarManifest(dir = DIR) {
  const archivos = fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'manifest.json').sort()
    .map((f) => { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return { f, estado: d.estado ?? null, tanda: d.tanda ?? null }; });
  return { archivos };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(armarManifest(), null, 1) + '\n');
  console.log('manifest.json escrito');
}
