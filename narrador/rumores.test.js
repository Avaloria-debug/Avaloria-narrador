import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propagar, bloquesCruzados, rumorPendiente, fuerzaDe } from './rumores.js';
import { posicionesDeNpcs } from './movimientoNpcs.js';
import { contenido } from './index.js';

const reloj = { dia: 1, hora: '12:00' };
const pos = posicionesDeNpcs(reloj, contenido);
const en = (esc) => Object.keys(pos).filter((k) => pos[k] === esc);
const hecho = (peso, escena = 'escena_mercado_circular', npc = 'serel_panadero') => ({ id: `h${peso}`, tipo: 'ayudar', npc, escena, tick: 0, peso });

test('rumores: bloques de 6 h', () => {
  assert.equal(bloquesCruzados({ dia: 1, hora: '05:00' }, { dia: 1, hora: '06:00' }), 1);
  assert.equal(bloquesCruzados({ dia: 1, hora: '06:00' }, { dia: 1, hora: '11:59' }), 0);
});

test('rumores: se propaga a escenas conectadas con fuerza peso-1', () => {
  const r = propagar({}, [hecho(3)], { contenido, reloj });
  const vecinos = [...en('escena_archivo_real'), ...en('escena_camino_norte')];
  assert.ok(vecinos.length > 0);
  for (const n of vecinos) assert.equal(r[n]?.[0]?.fuerza, 2, n);
  assert.equal(r.serel_panadero, undefined);
});

test('rumores: decae y fuerza 0 no propaga', () => {
  const r = propagar({}, [hecho(1)], { contenido, reloj });
  assert.deepEqual(r, {});
  let x = propagar({}, [hecho(2)], { contenido, reloj });
  for (let i = 0; i < 5; i++) x = propagar(x, [hecho(2)], { contenido, reloj });
  assert.ok(Object.values(x).flat().every((y) => y.fuerza >= 1));
});

test('rumores: sin duplicados por NPC', () => {
  let r = propagar({}, [hecho(3)], { contenido, reloj });
  for (let i = 0; i < 4; i++) r = propagar(r, [hecho(3)], { contenido, reloj });
  for (const l of Object.values(r)) assert.equal(new Set(l.map((x) => x.hecho)).size, l.length);
});

test('rumores: los mensajeros propagan con fuerza completa', () => {
  const sarin = pos.sarin_mensajera;
  const r = propagar({ sarin_mensajera: [{ hecho: 'hx', tipo: 'atacar', npc: 'x', escena: sarin, fuerza: 2, contado: false }] }, [], { contenido, reloj });
  const vecinos = Object.entries(r).filter(([k]) => k !== 'sarin_mensajera');
  assert.ok(vecinos.length > 0);
  for (const [, l] of vecinos) assert.equal(l[0].fuerza, 2);
  assert.equal(fuerzaDe(2), 'fuerte');
  assert.equal(fuerzaDe(1), 'difuso');
  assert.equal(rumorPendiente(r, 'sarin_mensajera').hecho, 'hx');
});
