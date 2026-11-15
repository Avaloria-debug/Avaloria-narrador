import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarTransicion,
  npcInicial,
  disposicionEfectiva,
  palabraDeDisposicion,
  numeroDeDisposicion,
  PALABRAS_DISPOSICION,
} from './npcs.js';
import { leerContenido } from './cargarContenido.js';
import { eventoActivo } from './utilsPrueba.js';

let contenido;
let T;
before(async () => {
  contenido = await leerContenido();
  T = contenido.transiciones;
});

const npc = (extra = {}) => ({ relacion: 0, disposicion: 0, temor: 0, bloqueadoConocimientos: false, conocimientosRevelados: [], ...extra });
const def = (sensibilidad) => ({ id: 'x', sensibilidad });
const aplicar = (verbo, resultado, sens = 1, estado = npc(), opciones) =>
  aplicarTransicion(estado, def(sens), verbo, resultado, T, opciones).npc;

describe('npcs — relación: cada transición con sensibilidad 1, 1,5 y 0,5', () => {
  test('delta del resultado × sensibilidad', () => {
    const verbos = Object.keys(T);
    assert.deepEqual(verbos.sort(), [
      'atacar', 'ayudar', 'calmar_la_situacion', 'defender', 'distraer', 'emboscar', 'hablar_con', 'negociar', 'presionar',
    ]);
    for (const verbo of verbos) {
      for (const resultado of ['exito', 'fallo']) {
        for (const sens of [1, 1.5, 0.5]) {
          assert.equal(aplicar(verbo, resultado, sens).relacion, T[verbo][resultado] * sens, `${verbo} ${resultado} ${sens}`);
        }
      }
    }
  });

  test('valores concretos', () => {
    assert.equal(aplicar('hablar_con', 'exito', 1.5).relacion, 7.5);
    assert.equal(aplicar('hablar_con', 'fallo', 0.5).relacion, -2.5);
    assert.equal(aplicar('ayudar', 'exito', 1).relacion, 10);
    assert.equal(aplicar('presionar', 'fallo', 1.5).relacion, -22.5);
    assert.equal(aplicar('atacar', 'exito', 1.5).relacion, -60);
    assert.equal(aplicar('emboscar', 'fallo', 0.5).relacion, -20);
    assert.equal(aplicar('distraer', 'exito', 1.5).relacion, 0);
  });

  test('negociar con valor (ofreciendo un objeto) da 15 en vez de 10', () => {
    assert.equal(aplicar('negociar', 'exito', 1).relacion, 10);
    assert.equal(aplicar('negociar', 'exito', 1, npc(), { conValor: true }).relacion, 15);
    assert.equal(aplicar('negociar', 'exito', 1.5, npc(), { conValor: true }).relacion, 22.5);
    assert.equal(aplicar('negociar', 'fallo', 1, npc(), { conValor: true }).relacion, -10);
  });

  test('se acumula sobre la relación previa', () => {
    assert.equal(aplicar('ayudar', 'exito', 1.5, npc({ relacion: 20 })).relacion, 35);
  });

  test('recorte a -100 y 100', () => {
    assert.equal(aplicar('ayudar', 'exito', 1.5, npc({ relacion: 95 })).relacion, 100);
    assert.equal(aplicar('ayudar', 'exito', 1, npc({ relacion: 100 })).relacion, 100);
    assert.equal(aplicar('atacar', 'exito', 1.5, npc({ relacion: -70 })).relacion, -100);
    assert.equal(aplicar('atacar', 'fallo', 1, npc({ relacion: -100 })).relacion, -100);
    let n = npc();
    for (let i = 0; i < 30; i++) n = aplicar('negociar', 'exito', 1.5, n, { conValor: true });
    assert.equal(n.relacion, 100);
    for (let i = 0; i < 30; i++) n = aplicar('emboscar', 'exito', 1.5, n);
    assert.equal(n.relacion, -100);
  });

  test('neutro o verbo sin transición: sin cambios', () => {
    const base = npc({ relacion: 12, disposicion: 1 });
    assert.equal(aplicarTransicion(base, def(1.5), 'hablar_con', 'neutro', T).npc, base);
    assert.equal(aplicarTransicion(base, def(1.5), 'descansar', 'exito', T).npc, base);
    assert.deepEqual(aplicarTransicion(base, def(1.5), 'descansar', 'exito', T).cambios, {
      relacion: 0, disposicion: 0, temor: 0, bloqueoConocimientos: false,
    });
  });

  test('no modifica el estado recibido', () => {
    const base = Object.freeze(npc({ conocimientosRevelados: Object.freeze([]) }));
    const r = aplicarTransicion(base, def(1), 'atacar', 'exito', T);
    assert.notEqual(r.npc, base);
    assert.deepEqual(base, npc());
  });
});

describe('npcs — disposición', () => {
  test('disposicionExito y disposicionFallo', () => {
    assert.equal(aplicar('hablar_con', 'exito').disposicion, 1);
    assert.equal(aplicar('hablar_con', 'fallo').disposicion, -1);
    assert.equal(aplicar('ayudar', 'exito').disposicion, 1);
    assert.equal(aplicar('negociar', 'fallo').disposicion, -1);
    assert.equal(aplicar('defender', 'exito').disposicion, 1);
    assert.equal(aplicar('defender', 'fallo').disposicion, 0);
    assert.equal(aplicar('distraer', 'exito').disposicion, 0);
    assert.equal(aplicar('distraer', 'fallo').disposicion, -1);
  });

  test('presionar: éxito +5 de relación y -1 de disposición; fallo -15 y disposición fijada en -2', () => {
    const ok = aplicar('presionar', 'exito', 1, npc({ disposicion: 2 }));
    assert.equal(ok.relacion, 5);
    assert.equal(ok.disposicion, 1);
    for (const previa of [2, 1, 0, -1, -2]) {
      const mal = aplicar('presionar', 'fallo', 1, npc({ disposicion: previa }));
      assert.equal(mal.relacion, -15);
      assert.equal(mal.disposicion, -2);
    }
  });

  test('atacar y emboscar: -40 y disposición fijada en -2, con éxito o con fallo', () => {
    for (const verbo of ['atacar', 'emboscar']) {
      for (const resultado of ['exito', 'fallo']) {
        const n = aplicar(verbo, resultado, 1, npc({ disposicion: 2, relacion: 50 }));
        assert.equal(n.relacion, 10);
        assert.equal(n.disposicion, -2);
      }
    }
  });

  test('se mantiene entre -2 y 2', () => {
    assert.equal(aplicar('hablar_con', 'exito', 1, npc({ disposicion: 2 })).disposicion, 2);
    assert.equal(aplicar('hablar_con', 'fallo', 1, npc({ disposicion: -2 })).disposicion, -2);
    assert.equal(aplicar('presionar', 'exito', 1, npc({ disposicion: -2 })).disposicion, -2);
  });

  test('calmar con éxito: con temor baja el temor; sin temor sube la disposición', () => {
    const conTemor = aplicar('calmar_la_situacion', 'exito', 1, npc({ temor: 2, disposicion: -1 }));
    assert.equal(conTemor.temor, 1);
    assert.equal(conTemor.disposicion, -1);
    assert.equal(conTemor.relacion, 10);
    const otra = aplicar('calmar_la_situacion', 'exito', 1, conTemor);
    assert.equal(otra.temor, 0);
    assert.equal(otra.disposicion, -1);
    const sinTemor = aplicar('calmar_la_situacion', 'exito', 1, otra);
    assert.equal(sinTemor.temor, 0);
    assert.equal(sinTemor.disposicion, 0);
  });

  test('calmar con fallo: nada cambia', () => {
    const n = aplicar('calmar_la_situacion', 'fallo', 1.5, npc({ temor: 1, disposicion: 1, relacion: 7 }));
    assert.deepEqual(n, npc({ temor: 1, disposicion: 1, relacion: 7 }));
  });

  test('palabras de disposición', () => {
    assert.deepEqual([-2, -1, 0, 1, 2].map(palabraDeDisposicion), ['hostil', 'desconfiado', 'neutral', 'amable', 'cercano']);
    assert.equal(palabraDeDisposicion(5), 'cercano');
    assert.equal(palabraDeDisposicion(-9), 'hostil');
    assert.equal(numeroDeDisposicion('neutral'), 0);
    assert.equal(numeroDeDisposicion('hostil'), -2);
    assert.equal(PALABRAS_DISPOSICION.length, 5);
  });

  test('estado inicial de cada NPC del contenido', () => {
    for (const n of contenido.npcs) {
      assert.deepEqual(npcInicial(n), npc({ relacion: n.relacionInicial }));
    }
  });
});

describe('npcs — bloqueo de conocimientos', () => {
  test('atacar y emboscar bloquean para siempre, con éxito o con fallo', () => {
    for (const verbo of ['atacar', 'emboscar']) {
      for (const resultado of ['exito', 'fallo']) {
        const r = aplicarTransicion(npc(), def(1), verbo, resultado, T);
        assert.equal(r.npc.bloqueadoConocimientos, true);
        assert.equal(r.cambios.bloqueoConocimientos, true);
      }
    }
  });

  test('ninguna acción posterior lo desbloquea', () => {
    let n = aplicar('atacar', 'exito');
    for (const verbo of Object.keys(T)) {
      for (const resultado of ['exito', 'fallo']) {
        n = aplicar(verbo, resultado, 1.5, n, { conValor: true });
        assert.equal(n.bloqueadoConocimientos, true, verbo);
      }
    }
  });

  test('los demás verbos no bloquean', () => {
    for (const verbo of Object.keys(T).filter((v) => v !== 'atacar' && v !== 'emboscar')) {
      assert.equal(aplicar(verbo, 'fallo').bloqueadoConocimientos, false, verbo);
    }
  });
});

describe('npcs — disposición efectiva con eventos', () => {
  test('suma el efecto mientras el evento está activo y se quita al cerrarlo', () => {
    const ivor = npc();
    const activos = [eventoActivo('evento_festividad_plaza', 'escena_plaza_cambistas')];
    assert.equal(disposicionEfectiva('ivor_cambista', ivor, activos, contenido), 1);
    assert.equal(disposicionEfectiva('ivor_cambista', ivor, [], contenido), 0);
    assert.equal(ivor.disposicion, 0);
  });

  test('se recorta entre -2 y 2', () => {
    const activos = [eventoActivo('evento_asalto_archivo', 'escena_archivo_real')]; // -2
    assert.equal(disposicionEfectiva('maren_archivista', npc({ disposicion: -1 }), activos, contenido), -2);
    assert.equal(disposicionEfectiva('maren_archivista', npc({ disposicion: 2 }), activos, contenido), 0);
  });
});
