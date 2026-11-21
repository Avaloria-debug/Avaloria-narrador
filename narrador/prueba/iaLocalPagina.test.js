import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeBoton, textoDeAviso, leerFlag, infoDePagina, textoDeProgreso, TEXTOS_IA_LOCAL, CLAVE_FLAG } from './iaLocalPagina.js';

const almacen = (o = {}) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; }, removeItem: (k) => { delete o[k]; } });
const env = (ua, search = '', gpu = true) => ({ navigator: { userAgent: ua, gpu: gpu ? {} : undefined }, location: { search }, sessionStorage: almacen(), localStorage: almacen() });
const PC = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130';
const manifest = { principal: { tamanoMB: 900 }, movil: { tamanoMB: 300 } };

test('apagada por defecto', () => assert.equal(leerFlag({ search: '' }, almacen()), false));
test('flag guardado la activa', () => assert.equal(leerFlag({ search: '' }, almacen({ [CLAVE_FLAG]: '1' })), true));
test('?ialocal=0 la apaga aunque esté guardada', () => assert.equal(leerFlag({ search: '?ialocal=0' }, almacen({ [CLAVE_FLAG]: '1' })), false));
test('PC con WebGPU: botón visible y habilitado', () => {
  const b = estadoDeBoton(infoDePagina(env(PC)), 'apagada');
  assert.deepEqual(b, { visible: true, habilitado: true, texto: TEXTOS_IA_LOCAL.activar });
});
test('iOS: botón oculto; con forzar, visible', () => {
  assert.equal(estadoDeBoton(infoDePagina(env('iPhone OS 18'))).visible, false);
  assert.equal(estadoDeBoton(infoDePagina(env('iPhone OS 18', '?ialocal=forzar'))).visible, true);
});
test('en-app oculto', () => assert.equal(estadoDeBoton(infoDePagina(env('Android Mobile Instagram'))).visible, false));
test('cargando y lista: deshabilitado', () => {
  const i = infoDePagina(env(PC));
  assert.equal(estadoDeBoton(i, 'cargando').habilitado, false);
  assert.equal(estadoDeBoton(i, 'lista').texto, TEXTOS_IA_LOCAL.lista);
  assert.equal(estadoDeBoton(i, 'fallida').habilitado, true);
});
test('aviso usa tamanoMB del manifest según el nivel', () => {
  assert.match(textoDeAviso(infoDePagina(env(PC)), manifest), /900 MB/);
  assert.match(textoDeAviso(infoDePagina(env('Android 14 Mobile')), manifest), /300 MB/);
  assert.ok(!/\{mb\}|undefined/.test(textoDeAviso(infoDePagina(env(PC)), {})));
});
test('sin WebGPU: aviso de no soportado', () => assert.equal(textoDeAviso(infoDePagina(env(PC, '', false)), manifest), TEXTOS_IA_LOCAL.noSoportado));
test('progreso en porcentaje', () => { assert.equal(textoDeProgreso({ progress: 0.456 }), '46 %'); assert.equal(textoDeProgreso({}), ''); });
test('textos provisionales', () => assert.equal(TEXTOS_IA_LOCAL.prov, true));
