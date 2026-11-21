import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { verificarModelo } from './verificar-modelo.mjs';

function carpeta() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-'));
  fs.writeFileSync(path.join(d, 'a.bin'), Buffer.alloc(2048, 1));
  fs.mkdirSync(path.join(d, 'sub'));
  fs.writeFileSync(path.join(d, 'sub', 'b.json'), '{"x":1}');
  return d;
}

test('lista archivos con tamaño y sha256 y escribe manifest.json', () => {
  const d = carpeta();
  const r = verificarModelo(d, { maxMB: 1 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.archivos.map((a) => a.archivo), ['a.bin', 'sub/b.json']);
  assert.equal(r.archivos[0].sha256, crypto.createHash('sha256').update(Buffer.alloc(2048, 1)).digest('hex'));
  const m = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8'));
  assert.equal(m.archivos.length, 2);
  assert.equal(verificarModelo(d, { maxMB: 1 }).archivos.length, 2); // ignora su propio manifest
});
test('falla si un archivo supera --max-mb', () => {
  const d = carpeta();
  const r = verificarModelo(d, { maxMB: 0.001 });
  assert.equal(r.ok, false);
  assert.match(r.errores[0], /a\.bin/);
});
test('CLI: código de salida', () => {
  const d = carpeta();
  const cli = path.join(path.dirname(new URL(import.meta.url).pathname), 'verificar-modelo.mjs');
  assert.equal(spawnSync('node', [cli, d, '--max-mb', '1']).status, 0);
  assert.equal(spawnSync('node', [cli, d, '--max-mb', '0.001']).status, 1);
  assert.equal(spawnSync('node', [cli, path.join(d, 'no')]).status, 1);
});
