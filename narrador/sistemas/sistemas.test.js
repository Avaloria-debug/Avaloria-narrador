import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrarSistema, abrirSistema, turnoSistema, cerrarSistema, sistemaActivo, esSalir } from './index.js';
import { crearPartida } from '../index.js';

const falso = registrarSistema({
  id: 'falso_test',
  iniciar: (_e, ctx) => ({ pasos: 0, npc: ctx.npc ?? 'serel_panadero' }),
  turno: (sub, entrada, _rng, ctx) => {
    if (ctx.salir) return { texto: 'cerrás', sub: { ...sub, salio: true }, terminado: true };
    const pasos = sub.pasos + 1;
    return { texto: `paso ${pasos}`, sub: { ...sub, pasos }, terminado: pasos >= 3 };
  },
  resultado: (sub) => (sub.forzado || sub.salio ? [] : [{ tipo: 'dinero', moneda: 'bronce', delta: 7 }, { tipo: 'relacion', npc: sub.npc, delta: 1 }]),
  cerrable: (sub) => sub.pasos < 2,
});
const p0 = () => crearPartida({ semilla: 3 });

test('ciclo completo con módulo falso: efectos al cerrar', () => {
  let e = abrirSistema(p0(), falso.id);
  const bronce = e.jugador.bronce; const rel = e.npcs.serel_panadero.relacion;
  for (let i = 0; i < 2; i++) { const r = turnoSistema(e, { tipo: 'texto', texto: 'sigo' }, () => 0.5); assert.equal(r.terminado, false); e = r.estado; }
  const r = turnoSistema(e, { tipo: 'texto', texto: 'sigo' }, () => 0.5);
  assert.equal(r.terminado, true); assert.equal(sistemaActivo(r.estado), null);
  assert.equal(r.estado.jugador.bronce, bronce + 7);
  assert.equal(r.estado.npcs.serel_panadero.relacion, Math.min(2, rel + 1));
});
test('persistencia: el sub queda en ext.sistema como JSON plano', () => {
  const e = turnoSistema(abrirSistema(p0(), falso.id), { tipo: 'texto', texto: 'x' }, () => 0).estado;
  const copia = JSON.parse(JSON.stringify(e));
  assert.deepEqual(sistemaActivo(copia), { id: 'falso_test', sub: { pasos: 1, npc: 'serel_panadero' } });
});
test('salir cierra si el módulo lo permite; si no, sigue', () => {
  const r = turnoSistema(abrirSistema(p0(), falso.id), { tipo: 'texto', texto: 'me voy' }, () => 0);
  assert.equal(r.terminado, true);
  let e = abrirSistema(p0(), falso.id);
  e = turnoSistema(e, { tipo: 'texto', texto: 'a' }, () => 0).estado; e = turnoSistema(e, { tipo: 'texto', texto: 'b' }, () => 0).estado;
  const r2 = turnoSistema(e, { tipo: 'texto', texto: 'salir' }, () => 0);
  assert.equal(r2.texto, 'paso 3');
  assert.ok(esSalir('quiero dejar esto')); assert.ok(!esSalir('compro pan'));
});
test('cierre forzado: sin efectos y sin sistema', () => {
  const e = abrirSistema(p0(), falso.id);
  const c = cerrarSistema(e, { forzado: true });
  assert.deepEqual(c.efectos, []); assert.equal(sistemaActivo(c.estado), null);
  assert.equal(turnoSistema(c.estado, { tipo: 'texto', texto: 'x' }, () => 0), null);
});
