// Cada módulo de narrador/ se importa como módulo ES: un import con nombre que el otro módulo no exporta
// (p. ej. `MOTIVO_SIN_SALIDAS`) falla al enlazar, igual que en el navegador. No cubre app.js (necesita DOM).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

const DIR = new URL('./', import.meta.url);
const modulos = readdirSync(DIR).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));

describe('módulos ES de narrador/ se enlazan', () => {
  test('hay módulos que revisar', () => assert.ok(modulos.length > 10));
  for (const archivo of modulos) {
    test(archivo, async () => {
      const m = await import(new URL(archivo, DIR).href);
      assert.equal(typeof m, 'object');
    });
  }
  test('comprension.js exporta lo que importa de motivos.js', async () => {
    const { MOTIVOS } = await import('./motivos.js');
    const c = await import('./comprension.js');
    assert.equal(c.MOTIVOS, MOTIVOS);
    assert.equal(MOTIVOS.SIN_SALIDAS, 'sin_salidas');
  });
});
