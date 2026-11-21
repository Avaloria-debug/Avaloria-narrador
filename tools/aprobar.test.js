import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { aprobar } from './aprobar.js';

test('aprobar: cambia solo el estado (byte a byte) y regenera el manifest; revertir (copia temporal)', () => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'apr-'));
  const original = '{\n "tanda": "t99",\n "estado": "a_aprobar_canon",\n "x": { "estado": "otro" },\n "t": "«hola»  raro"\n}\n';
  fs.writeFileSync(path.join(dir, 't99-x.json'), original);
  aprobar('t99-x', { dir });
  assert.equal(fs.readFileSync(path.join(dir, 't99-x.json'), 'utf8'), original.replace('"a_aprobar_canon"', '"aprobado"'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).archivos, [{ f: 't99-x.json', estado: 'aprobado', tanda: 't99' }]);
  aprobar('t99-x', { dir, revertir: true });
  assert.equal(fs.readFileSync(path.join(dir, 't99-x.json'), 'utf8'), original);
});
