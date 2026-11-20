import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fusionarAmpliado, validarAmpliado, leerArchivosAmpliado, seCarga, cargarAmpliadoNode } from './contenidoAmpliado.js';
import { leerContenido } from './cargarContenido.js';

const v3 = await leerContenido();
const npc = v3.npcs[0].id;
const esc = v3.escenas[0].id;

test('ampliado: sin carpeta o vacía → null (v3 puro)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'amp-'));
  assert.deepEqual(await leerArchivosAmpliado(join(dir, 'no-existe')), []);
  assert.equal(await cargarAmpliadoNode({ dir, cargarPendientes: true }), null);
  assert.equal(fusionarAmpliado([], v3, { cargarPendientes: true }), null);
});

test('ampliado: estados (borrador nunca, pendientes solo con opción, canon aparte)', () => {
  assert.equal(seCarga('borrador', { cargarPendientes: true, incluirCanon: true }), false);
  assert.equal(seCarga('a_aprobar', {}), false);
  assert.equal(seCarga('a_aprobar', { cargarPendientes: true }), true);
  assert.equal(seCarga('a_aprobar_canon', { cargarPendientes: true }), false);
  assert.equal(seCarga('a_aprobar_canon', { cargarPendientes: true, incluirCanon: true }), true);
  assert.equal(seCarga('aprobado', {}), true);
});

test('ampliado: la fusión suma variantes', () => {
  const a = ['t02.json', { tanda: 't02', estado: 'a_aprobar', ambiente: { [esc]: { l: [{ t: 'uno' }] } } }];
  const b = ['t13.json', { tanda: 't13', estado: 'a_aprobar', ambiente: { [esc]: { l: [{ t: 'dos' }] } }, plantillas: { intencion_examinar: { exito: ['x'] } } }];
  const f = fusionarAmpliado([a, b], v3, { cargarPendientes: true });
  assert.deepEqual(f.ambiente[esc].map((x) => x.t), ['uno', 'dos']);
  assert.deepEqual(f.plantillas.intencion_examinar.exito, ['x']);
});

test('ampliado: id de conocimiento duplicado falla', () => {
  const dup = v3.npcs[0].conocimientos[0].id;
  const k = { id: dup, contenido: 'x', umbralRelacion: 0, palabrasClave: ['a'], revelar: ['a'], pista: ['b'] };
  const arch = [['t16.json', { tanda: 't16', estado: 'a_aprobar', conocimientos: { [npc]: [k] } }]];
  assert.throws(() => fusionarAmpliado(arch, v3, { cargarPendientes: true }), /repetido/);
  assert.ok(validarAmpliado(arch, v3).some((e) => /repetido/.test(e)));
});

test('ampliado: símbolo inexistente y condición desconocida fallan', () => {
  const arch = [['t02.json', { tanda: 't02', estado: 'a_aprobar', ambiente: { [esc]: { l: [{ c: { zz: 1 }, t: 'hay #nada.aca#' }] } } }]];
  const e = validarAmpliado(arch, v3);
  assert.ok(e.some((x) => /#nada.aca#/.test(x)));
  assert.ok(e.some((x) => /"zz"/.test(x)));
});

test('ampliado: el contenido real valida sin errores y carga todas las tandas con canon', async () => {
  const arch = await leerArchivosAmpliado();
  assert.deepEqual(validarAmpliado(arch, v3), []);
  const f = fusionarAmpliado(arch, v3, { cargarPendientes: true, incluirCanon: true });
  assert.ok(f.tandas.length >= 20);
  assert.ok(!f.unicos.some((u) => u.id === 'u_niebla_voces'));
  assert.equal(fusionarAmpliado(arch, v3, {}), null);
});
