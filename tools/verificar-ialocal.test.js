// Prueba negativa del verificador de la fase 5: inyecta errores y comprueba que los detecta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const base = JSON.parse(readFileSync('tools/auto5/PLAN.json', 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'ver5-'));
const clon = () => JSON.parse(JSON.stringify(base));
const correr = (plan) => {
  const f = join(dir, 'plan.json');
  writeFileSync(f, JSON.stringify(plan));
  return spawnSync('node', ['tools/verificar-ialocal.mjs', 'contenido', '--plan', f], { encoding: 'utf8' });
};

test('el plan válido pasa', () => {
  const r = spawnSync('node', ['tools/verificar-ialocal.mjs', 'contenido'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

const casos = {
  'id duplicado': (p) => { p.pasos[1].id = 'R1'; },
  'ciclo': (p) => { p.pasos[0].depende = ['R7']; p.pasos[6].depende = ['R1']; },
  'depende inexistente': (p) => { p.pasos[2].depende = ['R99']; },
  'estado inválido': (p) => { p.pasos[0].estado = 'listo'; },
  'cambiaConducta no boolean': (p) => { p.pasos[3].cambiaConducta = 'si'; },
  'hecho sin archivos': (p) => { p.pasos[0].estado = 'hecho'; p.pasos[0].archivos = ['no/existe.js']; },
  'aprobacion inválida': (p) => { p.pasos[4].aprobacion = 'ok'; },
};
for (const [nombre, mutar] of Object.entries(casos)) {
  test(`detecta: ${nombre}`, () => {
    const p = clon();
    mutar(p);
    assert.notEqual(correr(p).status, 0);
  });
}

test('modo inválido falla', () => {
  assert.notEqual(spawnSync('node', ['tools/verificar-ialocal.mjs', 'nada'], { encoding: 'utf8' }).status, 0);
});
