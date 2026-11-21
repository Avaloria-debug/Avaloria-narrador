#!/usr/bin/env node
// Fase 5 (R6): lista los archivos de una carpeta de modelo con tamaño y sha256, escribe <carpeta>/manifest.json
// y falla si alguno supera el máximo (por defecto 95 MB, límite de archivos de GitHub Pages con margen).
// Uso: node tools/verificar-modelo.mjs <carpeta> [--max-mb 95]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function verificarModelo(carpeta, { maxMB = 95, escribir = true } = {}) {
  if (!fs.existsSync(carpeta) || !fs.statSync(carpeta).isDirectory()) return { ok: false, archivos: [], errores: [`no existe la carpeta ${carpeta}`] };
  const archivos = [];
  const recorrer = (d) => {
    for (const n of fs.readdirSync(d).sort()) {
      const f = path.join(d, n);
      const rel = path.relative(carpeta, f).split(path.sep).join('/');
      if (rel === 'manifest.json') continue;
      if (fs.statSync(f).isDirectory()) { recorrer(f); continue; }
      const bytes = fs.statSync(f).size;
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
      archivos.push({ archivo: rel, bytes, sha256 });
    }
  };
  recorrer(carpeta);
  const max = maxMB * 1024 * 1024;
  const errores = archivos.filter((a) => a.bytes > max).map((a) => `${a.archivo}: ${(a.bytes / 1048576).toFixed(1)} MB > ${maxMB} MB`);
  const totalMB = Math.round((archivos.reduce((s, a) => s + a.bytes, 0) / 1048576) * 10) / 10;
  if (escribir) fs.writeFileSync(path.join(carpeta, 'manifest.json'), JSON.stringify({ totalMB, maxMB, archivos }, null, 1) + '\n');
  return { ok: errores.length === 0, totalMB, archivos, errores };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2);
  const i = a.indexOf('--max-mb');
  const maxMB = i >= 0 ? Number(a[i + 1]) : 95;
  const carpeta = a.find((x, k) => !x.startsWith('--') && !(i >= 0 && k === i + 1));
  if (!carpeta) { console.error('uso: node tools/verificar-modelo.mjs <carpeta> [--max-mb 95]'); process.exit(2); }
  const r = verificarModelo(carpeta, { maxMB });
  console.log(`modelo: ${r.archivos.length} archivos, ${r.totalMB ?? 0} MB, ${r.errores.length} errores`);
  r.errores.forEach((e) => console.log('ERROR ' + e));
  process.exit(r.ok ? 0 : 1);
}
