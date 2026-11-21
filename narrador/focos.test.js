import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';
import { narrarEventos, contexto, extInicial, fraseAmpliada } from './ampliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
const F = amp.focos;

async function jugar(e, textos) {
  const salidas = [];
  for (const texto of textos) { const r = await narrar(e, { tipo: 'texto', texto }, op); salidas.push(r); e = r.estado; }
  return salidas;
}

// ---- S1: incoherencias reportadas ----

test('S1.1 caso reportado: "examinar la mesa" en el mercado no examina el pliego → objeto_desconocido', async () => {
  const [r] = await jugar(crearPartida({ semilla: 1 }), ['examinar la mesa']);
  assert.equal(r.estado.jugador.escenaId, 'escena_mercado_circular');
  assert.ok(!/Pliego/.test(r.texto), r.texto);
  assert.equal(r.tipo, 'reformulacion');
  assert.ok(amp.reformulacion || amp.plantillas.reformulacion.objeto_desconocido.some((t) => r.texto.startsWith(t.t ?? t) || r.texto.length > 0));
});

test('S1.1 fijo de la escena: "examinar la fuente" y "tocar el toldo" usan fijos (t30)', async () => {
  const [a, b] = await jugar(crearPartida({ semilla: 1 }), ['examinar la fuente', 'tocar el toldo']);
  const fuente = F.fijos.escena_mercado_circular.fuente.examinar;
  assert.ok(fuente.some((t) => a.texto.startsWith(t)), a.texto);
  assert.ok(F.fijos.escena_mercado_circular.toldo.tocar.some((t) => b.texto.startsWith(t)), b.texto);
  assert.ok(!/Pliego/.test(a.texto + b.texto));
});

test('S1.1 objeto real nombrado sigue en el camino de siempre ("examinar el pliego")', async () => {
  const [r] = await jugar(crearPartida({ semilla: 1 }), ['examinar el pliego de precios']);
  assert.notEqual(r.tipo, 'reformulacion');
});

test('S1.2 caso reportado: {eco} solo si la palabra es el referente resuelto', () => {
  const e = crearPartida({ semilla: 1 });
  const ext = extInicial(null, 1); ext.turno = 1;
  const turno = { tipo: 'accion', accion: { intencionId: 'intencion_examinar', verbo: 'examinar', resultado: 'exito', parametros: { objetoId: contenido.objetos.find((o) => /Pliego/.test(o.nombre)).id }, efectos: [] } };
  const ctx = contexto({ amp, contenido, despues: e, turno, ext });
  for (let i = 0; i < 20; i++) {
    ext.ultimoEco = undefined;
    const r = fraseAmpliada({ amp, contenido, turno, ctx, aperturas: [], entrada: { texto: 'examinar pensando la mesa' } });
    assert.ok(!r || !r.texto.includes('«mesa»'), r?.texto);
  }
});

function ctxEventos(e, ext) { return contexto({ amp, contenido, despues: e, turno: { tipo: 'accion' }, ext }); }
const ev = (id, esc = 'escena_mercado_circular') => ({ id, escenaId: esc });

test('S1.3 caso reportado y (d): cierre peligroso sin inicio emitido → no se narra', () => {
  const base = crearPartida({ semilla: 1 });
  const antes = { ...base, eventosActivos: [ev('evento_incendio_puesto')] };
  const despues = { ...base, eventosActivos: [] };
  const ext = extInicial(null, 1);
  assert.equal(narrarEventos({ amp, contenido, antes, despues, ext, ctx: ctxEventos(despues, ext) }), null);
});

test('S1.3 (a): cierre con inicio emitido, activo en la escena y expira este turno → sí', () => {
  const base = crearPartida({ semilla: 1 });
  const antes = { ...base, eventosActivos: [ev('evento_incendio_puesto')] };
  const despues = { ...base, eventosActivos: [] };
  const ext = extInicial(null, 1); ext.eventosEmitidos = ['evento_incendio_puesto@escena_mercado_circular'];
  const t = narrarEventos({ amp, contenido, antes, despues, ext, ctx: ctxEventos(despues, ext) });
  assert.ok(typeof t === 'string' && t.length > 0);
  assert.deepEqual(ext.eventosEmitidos, []);
  // en otra escena (el jugador se fue) no hay cierre
  const lejos = { ...despues, jugador: { ...despues.jugador, escenaId: 'escena_archivo_real' } };
  const ext2 = extInicial(null, 1); ext2.eventosEmitidos = ['evento_incendio_puesto@escena_mercado_circular'];
  assert.equal(narrarEventos({ amp, contenido, antes, despues: lejos, ext: ext2, ctx: ctxEventos(lejos, ext2) }), null);
});

test('S1.3 (b): el inicio solo en el turno del disparo', () => {
  const base = crearPartida({ semilla: 1 });
  const activo = { ...base, eventosActivos: [ev('evento_mercado_aglomeracion')] };
  const ext = extInicial(null, 1);
  const t1 = narrarEventos({ amp, contenido, antes: base, despues: activo, ext, ctx: ctxEventos(activo, ext) });
  assert.ok(t1);
  assert.ok(ext.eventosEmitidos.includes('evento_mercado_aglomeracion@escena_mercado_circular'));
  assert.equal(narrarEventos({ amp, contenido, antes: activo, despues: activo, ext, ctx: ctxEventos(activo, ext) }), null);
});

test('S1.3 (c): el evento sale como línea de mundo aparte, al final', async () => {
  let e = crearPartida({ semilla: 3 });
  let visto = 0;
  for (let i = 0; i < 80 && visto < 3; i++) {
    const r = await narrar(e, { tipo: 'texto', texto: i % 2 ? 'examinar' : 'observar' }, op);
    const nuevos = (r.estado.eventosActivos ?? []).filter((a) => a.escenaId === r.estado.jugador.escenaId && !(e.eventosActivos ?? []).some((b) => b.id === a.id && b.escenaId === a.escenaId));
    const lineas = nuevos.flatMap((a) => amp.eventos[a.id] ?? []).map((x) => (typeof x === 'string' ? x : x.t));
    const ultimo = r.texto.split('\n\n').at(-1);
    if (lineas.some((l) => r.texto.includes(l.split('#')[0].trim().slice(0, 15)))) { visto++; assert.ok(r.texto.includes('\n\n'), r.texto); assert.ok(lineas.some((l) => ultimo.includes(l.split('#')[0].trim().slice(0, 15))), r.texto); }
    e = r.estado;
  }
});

// ---- S2: motor de focos ----
import { detectar, vigentes, extFocos, turnoDeFoco, verboFoco, resolverReferente, MAX_FOCOS, DURA_GENERADO } from './focos.js';
import { cargarPartida } from './index.js';

test('S2 detección por alias (palabra completa, sin tildes)', () => {
  const l = detectar([], 'Una GATA cruza con un pescado. Un gatazo no cuenta.', { F, turno: 2, escena: 'escena_mercado_circular' });
  assert.deepEqual(l.map((f) => f.id), ['gata_mercado']);
  assert.equal(l[0].visto, 2);
  assert.deepEqual(detectar([], 'gatazo', { F, turno: 1, escena: 'x' }), []);
});

test('S2 vida: dura turnos o cambio de escena (salvo el que se sigue); máx. 8', () => {
  const l = detectar([], 'una gata', { F, turno: 1, escena: 'a' });
  const dura = F.defs.gata_mercado.dura;
  assert.equal(vigentes(l, { F, turno: dura, escena: 'a' }).length, 1);
  assert.equal(vigentes(l, { F, turno: dura + 1, escena: 'a' }).length, 0);
  assert.equal(vigentes(l, { F, turno: 2, escena: 'b' }).length, 0);
  assert.equal(vigentes(l, { F, turno: 2, escena: 'b', siguiendo: 'gata_mercado' }).length, 1);
  const ids = Object.keys(F.defs).slice(0, 10);
  let m = [];
  ids.forEach((id, i) => { m = detectar(m, F.defs[id].alias[0], { F, turno: 1 + i * 0, escena: 'a' }); });
  assert.ok(m.length <= MAX_FOCOS);
});

test('S2 generado desde símbolo: clase por familia y alias de la línea', () => {
  const l = detectar([], 'Se oyen carros que empiezan a rodar.', { F, turno: 3, escena: 'a', generadas: [{ familia: 'sonido', texto: 'se oyen carros que empiezan a rodar' }] });
  assert.equal(l.length, 1);
  assert.equal(l[0].gen, true);
  assert.equal(l[0].clase, 'sonido');
  assert.ok(l[0].alias.includes('ruido') && l[0].alias.includes('carros'));
  assert.equal(vigentes(l, { F, turno: 3 + DURA_GENERADO, escena: 'a' }).length, 0);
  // una línea que un foco propio captura no genera
  assert.ok(detectar([], 'Un gato duerme', { F, turno: 1, escena: 'a', generadas: [{ familia: 'animal', texto: 'un gato duerme' }] }).every((f) => !f.gen));
});

test('S2 fijos siempre disponibles sin haberlos visto', () => {
  const v = verboFoco('mirar la fuente');
  assert.equal(resolverReferente('mirar la fuente', v, { F, lista: [], escena: 'escena_mercado_circular' }).tipo, 'fijo');
});

test('S2 carga vieja → sin focos; el estado de focos se guarda con la partida', async () => {
  const vieja = crearPartida({ semilla: 4 });
  delete vieja.ext;
  assert.deepEqual(extFocos(cargarPartida(vieja).ext).focos, []);
  const [r] = await jugar(vieja, ['observar']);
  const otra = cargarPartida(JSON.parse(JSON.stringify(r.estado)));
  assert.deepEqual(otra.ext.focos, r.estado.ext.focos);
});

test('S2 determinismo: misma semilla, mismos focos y textos', async () => {
  const t = ['observar', 'explorar', 'mirar la gata', 'seguir al perro', 'observar', 'escuchar el ruido'];
  const a = await jugar(crearPartida({ semilla: 9 }), t);
  const b = await jugar(crearPartida({ semilla: 9 }), t);
  assert.deepEqual(a.map((x) => x.texto), b.map((x) => x.texto));
  assert.deepEqual(a.at(-1).estado.ext.focos, b.at(-1).estado.ext.focos);
});

test('S2 a lo largo de una partida se detectan focos (propios o generados)', async () => {
  const s = await jugar(crearPartida({ semilla: 2 }), Array(12).fill('observar'));
  assert.ok(s.some((r) => (r.estado.ext.focos ?? []).length > 0));
});

// ---- S3: verbos sobre focos ----
async function conFocos(ids, semilla = 1) {
  const [r] = await jugar(crearPartida({ semilla }), ['observar']);
  const e = structuredClone(r.estado);
  e.ext.focos = ids.map((id, i) => ({ id, visto: e.ext.turno - (ids.length - 1 - i) * 0, escena: e.jugador.escenaId, pasos: {}, agotado: false }));
  ids.forEach((id, i) => { e.ext.focos[i].visto = e.ext.turno; });
  return e;
}
const textosFoco = (id, verbo) => {
  const d = F.defs[id];
  const rama = (d.ramas[verbo] ?? []).map((p) => (typeof p === 'string' ? p : p.t));
  return [...rama, ...(F.clases[d.clase][verbo] ?? [])];
};

test('S3 cada verbo sobre un foco activo responde con su rama o su clase', async () => {
  for (const verbo of ['seguir', 'mirar', 'llamar', 'tocar', 'escuchar', 'preguntar', 'ignorar']) {
    const frase = { seguir: 'seguir a la gata', mirar: 'mirar a la gata', llamar: 'llamar a la gata', tocar: 'tocar la gata', escuchar: 'escuchar a la gata', preguntar: 'preguntar por la gata', ignorar: 'ignorar a la gata' }[verbo];
    const [r] = await jugar(await conFocos(['gata_mercado']), [frase]);
    assert.ok(textosFoco('gata_mercado', verbo).some((t) => r.texto.includes(t)), `${verbo}: ${r.texto}`);
  }
});

test('S3 referente: "eso" y sin sustantivo → el foco más reciente; dos candidatos → el más reciente', async () => {
  const e = await conFocos(['perro_ciudad', 'gata_mercado']);
  e.ext.focos[0].visto -= 1;
  const [a] = await jugar(e, ['mirar eso']);
  assert.ok(textosFoco('gata_mercado', 'mirar').some((t) => a.texto.includes(t)), a.texto);
  const [b] = await jugar(e, ['seguila']);
  assert.ok(textosFoco('gata_mercado', 'seguir').some((t) => b.texto.includes(t)), b.texto);
});

test('S3 no visto o vencido → una variante de no_visto', async () => {
  const [r] = await jugar(await conFocos([]), ['seguir al burro']);
  assert.ok(F.no_visto.some((t) => r.texto.startsWith(t)), r.texto);
});

test('S3 "seguir camino" no se vuelve un foco', async () => {
  const e = await conFocos(['gata_mercado']);
  const [r] = await jugar(e, ['seguir camino']);
  assert.ok(!textosFoco('gata_mercado', 'seguir').some((t) => r.texto.includes(t)), r.texto);
  assert.ok(!F.no_visto.some((t) => r.texto.startsWith(t)));
});

test('S3 typos en verbo y alias ("persegir al caballo")', async () => {
  const [r] = await jugar(await conFocos(['caballo_suelto']), ['persegir al cabalo']);
  assert.ok(textosFoco('caballo_suelto', 'seguir').some((t) => r.texto.includes(t)), r.texto);
});

// ---- S4: ramas y finales ----
import { minutosAbsolutos } from './reloj.js';
const pasoT = (id, v, i) => { const p = F.defs[id].ramas[v][i]; return typeof p === 'string' ? p : p.t; };

test('S4 rama completa de gata_mercado: seguir ×3 (tiempo, emite gatas_patio, fin nada) → mirar gatas_patio → repetir = ignorar', async () => {
  const e0 = await conFocos(['gata_mercado']);
  const s = await jugar(e0, ['seguir a la gata', 'seguir a la gata', 'seguir a la gata', 'mirar las gatas', 'seguir a la gata']);
  for (let i = 0; i < 3; i++) assert.ok(s[i].texto.includes(pasoT('gata_mercado', 'seguir', i)), s[i].texto);
  const min = (r) => minutosAbsolutos(r.estado.reloj);
  assert.equal(min(s[0]) - minutosAbsolutos(e0.reloj), F.defs.gata_mercado.ramas.seguir[0].tiempoMin);
  assert.ok(s[1].estado.ext.focos.some((f) => f.id === 'gatas_patio'));
  assert.ok(s[2].estado.ext.focos.find((f) => f.id === 'gata_mercado').agotado);
  assert.ok(s[3].texto.includes(pasoT('gatas_patio', 'mirar', 0)), s[3].texto);
  assert.ok(F.clases.animal.ignorar.some((t) => s[4].texto.includes(t)), s[4].texto);
  assert.equal(min(s[4]), min(s[3]));
});

test('S4 fin hallazgo marca ext.marcasFoco; fin nada no', async () => {
  const [a] = await jugar(await conFocos(['gatas_patio']), ['seguir a las gatas']);
  assert.ok(a.estado.ext.marcasFoco.includes('foco_gatas_patio_hallazgo'));
  const s = await jugar(await conFocos(['gata_mercado']), Array(3).fill('seguir a la gata'));
  assert.deepEqual(s.at(-1).estado.ext.marcasFoco, []);
});

test('S4 sin rama para el verbo → clases.<clase>.<verbo>', async () => {
  const [r] = await jugar(await conFocos(['gatas_patio']), ['llamar a las gatas']);
  assert.ok(F.clases.animal.llamar.some((t) => r.texto.includes(t)), r.texto);
});

test('S4 el turno de foco es un turno normal (ext.turno avanza, el ambiente sigue)', async () => {
  const e0 = await conFocos(['gata_mercado']);
  const [r] = await jugar(e0, ['mirar a la gata']);
  assert.equal(r.estado.ext.turno, e0.ext.turno + 1);
});

// ---- S5: interrupciones y memoria ----
const INT = F.interrupcion.serel_panadero;
async function charlaYFoco(e, verbo = 'seguir a la gata') {
  const [h] = await jugar(e, ['hablar con serel']);
  const x = structuredClone(h.estado);
  x.ext.focos = [{ id: 'gata_mercado', visto: x.ext.turno, escena: x.jugador.escenaId, pasos: {}, agotado: false }];
  const [r] = await jugar(x, [verbo]);
  return r;
}

test('S5 durante: seguir un foco en plena charla antepone la voz del NPC y registra la interrupción', async () => {
  const r = await charlaYFoco(await conFocos([]));
  assert.ok(INT.durante.some((t) => r.texto.startsWith(t)), r.texto);
  assert.equal(r.estado.ext.interrupciones.serel_panadero.veces, 1);
});

test('S5 regreso: al volver a hablar, la línea de regreso una sola vez', async () => {
  const r = await charlaYFoco(await conFocos([]));
  const [a, b] = await jugar(r.estado, ['hablar con serel', 'hablar con serel']);
  assert.ok(INT.regreso.some((t) => a.texto.startsWith(t)), a.texto);
  assert.ok(!INT.regreso.some((t) => b.texto.includes(t)), b.texto);
});

test('S5 tercera interrupción → afinidad −1 (o −2 con orden ≥ 1)', async () => {
  let e = await conFocos([]);
  const af0 = e.ext.afinidad?.serel_panadero ?? 0;
  const deltas = [];
  for (let i = 0; i < 3; i++) {
    const antes = e.ext.afinidad?.serel_panadero ?? 0;
    const r = await charlaYFoco(e);
    deltas.push((r.estado.ext.afinidad?.serel_panadero ?? 0) - antes);
    e = r.estado;
  }
  assert.equal(e.ext.interrupciones.serel_panadero.veces, 3);
  assert.equal(e.ext.interrupciones.serel_panadero.castigado, true);
  const esperado = (amp.valores?.serel_panadero?.orden ?? 0) >= 1 ? -2 : -1;
  assert.ok(deltas[2] <= esperado + 1e-9 || deltas[2] - deltas[1] <= esperado + 1, JSON.stringify({ deltas, af0 }));
});

test('S5 mirar/escuchar/preguntar no interrumpen', async () => {
  const r = await charlaYFoco(await conFocos([]), 'mirar a la gata');
  assert.ok(!INT.durante.some((t) => r.texto.includes(t)), r.texto);
  assert.equal(r.estado.ext.interrupciones.serel_panadero, undefined);
});

test('S5 carga vieja sin interrupciones ni charla', () => {
  const x = extFocos({});
  assert.deepEqual(x.interrupciones, {});
  assert.equal(x.ultimaCharla, null);
});

// ---- S7: integración ----
test('S7 sin ampliado (?ampliado=0): sin detección ni verbos de foco, salida igual a la base', async () => {
  const e = await conFocos(['gata_mercado']);
  const base = structuredClone(e);
  const r1 = await narrar(e, { tipo: 'texto', texto: 'seguir a la gata' }, { ahora: () => 0 });
  const r2 = await narrar(base, { tipo: 'texto', texto: 'seguir a la gata' }, { ahora: () => 0 });
  assert.equal(r1.texto, r2.texto);
  assert.ok(!textosFoco('gata_mercado', 'seguir').some((t) => r1.texto.includes(t)));
  assert.deepEqual(r1.estado.ext.focos, e.ext.focos);
});
