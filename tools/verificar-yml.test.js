import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verificarYml } from './verificar-yml.mjs';

test('yml: el workflow real pasa el chequeo estático', () => {
  assert.deepEqual(verificarYml(fs.readFileSync(new URL('../.github/workflows/narrador.yml', import.meta.url), 'utf8')), []);
});

test('yml: detecta versión sin fijar, Pages y comandos inexistentes', () => {
  const malo = 'on:\njobs:\n  a:\n    steps:\n      - uses: actions/checkout\n      - uses: actions/deploy-pages@v4\n      - run: node tools/no-existe.js\n      - run: npm run nada\n';
  const e = verificarYml(malo).join('\n');
  for (const x of ['sin versión', 'Pages', 'no-existe', 'nada', 'upload-artifact']) assert.ok(e.includes(x), x);
});
