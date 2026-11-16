import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerContenido } from '../cargarContenido.js';
import { validarCasos } from './validador.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const RUTA_CASOS = fileURLToPath(new URL('../../data/contenido/casos.json', import.meta.url));

test('los casos de data/contenido/casos.json pasan el validador', async () => {
  const contenido = await leerContenido();
  const { casos } = JSON.parse(await readFile(RUTA_CASOS, 'utf8'));
  assert.deepEqual(validarCasos(casos, contenido), []);
});
