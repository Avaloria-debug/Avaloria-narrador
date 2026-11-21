import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargarAmpliadoNode, fusionarAmpliado } from './contenidoAmpliado.js';
import { contenido } from './index.js';
import { tieneAlias } from './focos.js';
import { normalizar } from './comprension.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const F = amp.focos;

test('U1: t32 cargado: carta_suelta e isla_lago existen y se detectan por alias', () => {
  for (const id of ['carta_suelta', 'isla_lago']) {
    assert.ok(F.defs[id], id);
    const a = F.defs[id].alias[0];
    assert.ok(tieneAlias(normalizar(`Ves ${a} a lo lejos.`), normalizar(a)), id);
  }
  assert.ok(Object.keys(F.defs).length >= 61);
});

test('U1: id de foco repetido entre tandas falla la carga', () => {
  const t = { tanda: 'tx', estado: 'a_aprobar', focos: { carta_suelta: { alias: ['x'], clase: 'objeto' } } };
  assert.throws(() => fusionarAmpliado([['t30.json', t], ['t32.json', t]], contenido, { cargarPendientes: true }), /foco repetido/);
});

test('U1: el manifest incluye t31 y t32', () => {
  const m = fs.readFileSync(new URL('../data/contenido/ampliado/manifest.json', import.meta.url), 'utf8');
  assert.match(m, /t31-preguntar\.json/);
  assert.match(m, /t32-focos2\.json/);
});

test('U1: t31 cargado en focos.preguntar', () => {
  assert.ok(F.preguntar.serel_panadero?.animal?.length >= 2);
});

// ---- U2: preguntar en la voz del NPC (t31) ----
import { detectar, ejecutarVerbo, turnoDeFoco } from './focos.js';
import { derivar } from './azar.js';
import { crearPartida } from './index.js';

const CLASES = ['animal', 'persona', 'sonido', 'objeto', 'lugar', 'fenomeno'];
const defDeClase = (c) => Object.entries(F.defs).find(([, d]) => d.clase === c)?.[0];
function preguntar(id, npc, sem = 'x') {
  const fx = { focos: detectar([], F.defs[id].alias[0], { F, turno: 1, escena: 'a' }), marcasFoco: [], interrupciones: {} };
  const f = fx.focos.find((x) => x.id === id);
  return ejecutarVerbo({ F, fx, ref: { tipo: 'foco', f }, verbo: 'preguntar', rng: derivar(sem, 'focos'), turno: 2, escena: 'a', npc });
}

test('U2: cada clase con un NPC responde con su línea de t31 y sustituye {foco}', () => {
  for (const npc of Object.keys(F.preguntar)) for (const c of CLASES) {
    const id = defDeClase(c);
    assert.ok(id, c);
    const r = preguntar(id, npc);
    const alias = F.defs[id].alias[0];
    const posibles = F.preguntar[npc][c].map((t) => t.replaceAll('{foco}', alias));
    assert.ok(posibles.includes(r.texto), `${npc}.${c}: ${r.texto}`);
    assert.ok(!r.texto.includes('{'), r.texto);
    assert.equal(r.voz, true);
  }
});

test('U2: sin NPC presente → línea de la clase de t30', () => {
  const id = defDeClase('animal');
  const r = preguntar(id, null);
  assert.ok(!r.voz);
  const rama = (F.defs[id].ramas?.preguntar ?? []).map((p) => p.t ?? p);
  assert.ok([...(F.clases.animal.preguntar ?? []), ...rama].includes(r.texto), r.texto);
});

test('U2: foco no visto → no_visto', () => {
  const p = crearPartida({ semilla: 3 });
  const r = turnoDeFoco({ amp, contenido, partida: p, texto: `preguntar por la ${F.defs.carta_suelta.alias[0]}` });
  assert.ok(r?.foco?.noVisto, JSON.stringify(r?.foco));
  assert.ok(F.no_visto.includes(r.texto));
});

test('U2: determinismo con semilla', () => {
  const id = defDeClase('objeto');
  assert.equal(preguntar(id, 'serel_panadero', 's1').texto, preguntar(id, 'serel_panadero', 's1').texto);
});
