import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palabraDeEco, puedeEco } from './eco.js';
import { crearPartida, narrar, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });

test('eco: filtro (vacías, números, nombres propios, fuera del vocabulario)', () => {
  assert.equal(palabraDeEco('explorar', { contenido, amp }), null);
  assert.equal(palabraDeEco('explorar 12345 zzzzqqq', { contenido, amp }), null);
  assert.equal(palabraDeEco('hablar con serel', { contenido, amp }), null);
  const p = palabraDeEco('explorar buscando el silencio', { contenido, amp });
  assert.ok(p === null || (p.length >= 4 && p.length <= 12));
  assert.equal(palabraDeEco('explorar idiotaxx', { contenido, amp }), null);
});

test('eco: límite de frecuencia', () => {
  assert.equal(puedeEco({ turno: 5, ultimoEco: 3 }), false);
  assert.equal(puedeEco({ turno: 7, ultimoEco: 3 }), true);
  assert.equal(puedeEco({ turno: 1 }), true);
});

test('eco: sin eco válido → plantilla normal; la frase del jugador nunca aparece', async () => {
  let e = crearPartida({ semilla: 5 });
  let ecos = 0;
  const frases = ['explorar la ciudad entera con calma', 'observar la gente del mercado', 'examinar la puerta vieja', 'explorar sin rumbo fijo'];
  for (let i = 0; i < 24; i++) {
    const texto = frases[i % frases.length];
    const r = await narrar(e, { tipo: 'texto', texto }, { ampliado: amp, ahora: () => 0 });
    assert.ok(!r.texto.includes(texto));
    if (r.texto.includes('«') && Number.isInteger(r.estado.ext.ultimoEco) && r.estado.ext.ultimoEco === r.estado.ext.turno) ecos++;
    e = r.estado;
  }
  assert.ok(ecos <= 6, String(ecos));
});
