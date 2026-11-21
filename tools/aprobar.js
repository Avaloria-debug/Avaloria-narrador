#!/usr/bin/env node
// Aprobación de una tanda (Q7). Cambia SOLO el campo "estado" (el resto del archivo queda byte a byte) y regenera
// el manifest. Lo corre el autor a mano. Uso: node tools/aprobar.js <tanda> [--revertir] [--pendiente]
//   <tanda>: nombre del archivo sin .json (t16-conocimientos, calendario, valores…).
//   --revertir: vuelve a "a_aprobar_canon" (o a "a_aprobar" con --pendiente).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { armarManifest, DIR } from './generar-manifest.js';

const PATRON = /("estado"\s*:\s*)"[^"]*"/;

/** Cambia el estado de un archivo. @returns {{ antes: string, despues: string }} */
export function cambiarEstado(ruta, nuevo) {
  const texto = fs.readFileSync(ruta, 'utf8');
  if (!PATRON.test(texto)) throw new Error(`${path.basename(ruta)}: no tiene campo "estado"`);
  const antes = JSON.parse(texto).estado;
  const salida = texto.replace(PATRON, `$1${JSON.stringify(nuevo)}`);
  if (JSON.parse(salida).estado !== nuevo) throw new Error('el primer "estado" no es el de la tanda');
  fs.writeFileSync(ruta, salida);
  return { antes, despues: nuevo };
}

export function aprobar(tanda, { dir = DIR, revertir = false, pendiente = false } = {}) {
  const ruta = path.join(dir, `${tanda.replace(/\.json$/, '')}.json`);
  if (!fs.existsSync(ruta)) throw new Error(`no existe ${ruta}`);
  const r = cambiarEstado(ruta, revertir ? (pendiente ? 'a_aprobar' : 'a_aprobar_canon') : 'aprobado');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(armarManifest(dir), null, 1) + '\n');
  return r;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2);
  const tanda = a.find((x) => !x.startsWith('--'));
  if (!tanda) { console.error('uso: node tools/aprobar.js <tanda> [--revertir] [--pendiente]'); process.exit(1); }
  const r = aprobar(tanda, { revertir: a.includes('--revertir'), pendiente: a.includes('--pendiente') });
  console.log(`${tanda}: ${r.antes} → ${r.despues}`);
}
