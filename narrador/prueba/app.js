// Página de prueba aislada del narrador. Se abre con un servidor local desde la raíz del repo
// (pasos en docs/PENDIENTES.md). No usa ui/ ni index.html de Avaloria, ni Firestore.
// La clave de Groq vive en localStorage de este navegador y solo viaja a la API de Groq (narrador/ia.js).
// Todo lo que se muestra se escribe con textContent: el texto del jugador nunca se interpreta.
import { crearPartida, cargarPartida, narrar, contenido } from '../index.js';
import { crearColaDeRegistros } from '../registro.js';
import { crearAlmacenIndexedDB } from '../../persistencia/adaptadores/almacenIndexedDB.js';
import { opcionesDeEscena, entradaDeBoton, llamadaDeRespuesta, armarPanel, fijarRelacion, CLAVE_LOCALSTORAGE_GROQ, BD_PRUEBA, CLAVE_PARTIDA } from './panel.js';

const $ = (id) => document.getElementById(id);
const SIN_DATO = '—';

let estado = null;
let ocupado = false;
// Cola en memoria: acumula y no envía (no hay Firestore en esta página).
const cola = crearColaDeRegistros({
  enviar: async () => {
    throw new Error('la página de prueba no envía registros');
  },
  validarAlAgregar: false,
});
let almacen = null;
const abrirAlmacen = () => (almacen ??= crearAlmacenIndexedDB({ nombreBD: BD_PRUEBA }));

function leerClave() {
  try {
    return localStorage.getItem(CLAVE_LOCALSTORAGE_GROQ) ?? '';
  } catch {
    return '';
  }
}

const avisar = (texto) => {
  $('aviso').textContent = texto;
};

function llenarSelect(select, opciones) {
  const elegido = select.value;
  select.replaceChildren(new Option(SIN_DATO, ''), ...opciones.map((o) => new Option(o.nombre, o.id)));
  if (opciones.some((o) => o.id === elegido)) select.value = elegido;
}

function pintarEscena() {
  pintarRelaciones();
  const hay = estado !== null;
  for (const id of ['guardar', 'entrada', 'enviar']) $(id).disabled = !hay || ocupado;
  if (!hay) return;
  const o = opcionesDeEscena(estado, contenido);
  $('resumen').textContent = `${o.escena?.nombre ?? SIN_DATO} · día ${estado.reloj.dia}, ${estado.reloj.hora} · bronce ${estado.jugador.bronce}, plata ${estado.jugador.plata}`;
  llenarSelect($('npc'), o.npcs);
  llenarSelect($('objeto'), o.objetos);
  llenarSelect($('destino'), o.destinos);
  $('intenciones').replaceChildren(
    ...o.intenciones.map((i) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = i.etiqueta;
      boton.title = i.id;
      boton.disabled = ocupado;
      boton.addEventListener('click', () =>
        turno(entradaDeBoton(i.id, { npcId: $('npc').value, objetoId: $('objeto').value, destino: $('destino').value })),
      );
      return boton;
    }),
  );
}

// Atajo de prueba, no es parte del juego: un campo numérico por NPC que fija su relación en la partida actual.
function pintarRelaciones() {
  const campos = contenido.npcs.map((npc) => {
    const entrada = document.createElement('input');
    entrada.type = 'number';
    entrada.min = '-100';
    entrada.max = '100';
    entrada.step = '1';
    entrada.id = `relacion_${npc.id}`;
    entrada.disabled = estado === null;
    entrada.value = estado ? String(estado.npcs[npc.id]?.relacion ?? 0) : '';
    entrada.addEventListener('change', () => {
      if (!estado) return;
      estado = fijarRelacion(estado, npc.id, entrada.value);
      entrada.value = String(estado.npcs[npc.id].relacion);
    });
    const etiqueta = document.createElement('label');
    etiqueta.append(`${npc.nombre} `, entrada);
    return etiqueta;
  });
  $('relaciones').replaceChildren(...campos);
}

function pintarPanel(panel) {
  $('texto').textContent = panel.texto;
  $('tipo').textContent = panel.tipo || SIN_DATO;
  $('errores').textContent = panel.errores.length > 0 ? panel.errores.join('\n') : SIN_DATO;
  $('tokens').textContent = panel.tokens ? JSON.stringify(panel.tokens, null, 2) : SIN_DATO;
  $('registro').textContent = panel.registroJson || SIN_DATO;
  $('cola').textContent = `${panel.pendientes} registros`;
}

async function turno(entrada) {
  if (!estado || ocupado) return;
  ocupado = true;
  pintarEscena();
  const llamadas = [];
  // Mismo fetch del navegador, anotando solo el estado y el uso de tokens de la respuesta.
  const http = async (url, opciones) => {
    const respuesta = await fetch(url, opciones);
    let cuerpo = null;
    try {
      cuerpo = await respuesta.clone().json();
    } catch {
      // respuesta sin JSON: se anota solo el estado
    }
    llamadas.push(llamadaDeRespuesta(respuesta.status, cuerpo));
    return respuesta;
  };
  let salida;
  try {
    salida = await narrar(estado, entrada, { groqKey: leerClave() || null, http, cola });
    estado = salida.estado;
  } catch (e) {
    // `narrar` no lanza; por si acaso, se muestra como error de la página.
    salida = { texto: '', tipo: 'error', registro: null, errores: [`pagina: ${e instanceof Error ? e.message : String(e)}`] };
  }
  ocupado = false;
  pintarPanel(armarPanel(salida, { llamadas, pendientes: cola.pendientes().length }));
  pintarEscena();
}

$('crear').addEventListener('click', () => {
  estado = crearPartida();
  avisar('Partida creada.');
  pintarEscena();
});

$('guardar').addEventListener('click', async () => {
  if (!estado) return;
  try {
    await abrirAlmacen().set(CLAVE_PARTIDA, JSON.stringify(estado));
    avisar('Partida guardada en IndexedDB.');
  } catch (e) {
    avisar(`No se pudo guardar: ${e instanceof Error ? e.message : String(e)}`);
  }
});

$('cargar').addEventListener('click', async () => {
  try {
    const guardado = await abrirAlmacen().get(CLAVE_PARTIDA);
    if (guardado == null) {
      avisar('No hay partida guardada.');
      return;
    }
    estado = cargarPartida(guardado);
    avisar('Partida cargada de IndexedDB.');
    pintarEscena();
  } catch (e) {
    avisar(`No se pudo cargar: ${e instanceof Error ? e.message : String(e)}`);
  }
});

$('guardarClave').addEventListener('click', () => {
  try {
    const clave = $('clave').value.trim();
    if (clave === '') return;
    localStorage.setItem(CLAVE_LOCALSTORAGE_GROQ, clave);
    avisar('Clave guardada en este navegador.');
  } catch (e) {
    avisar(`No se pudo guardar la clave: ${e instanceof Error ? e.message : String(e)}`);
  }
});

$('borrarClave').addEventListener('click', () => {
  try {
    localStorage.removeItem(CLAVE_LOCALSTORAGE_GROQ);
  } catch {
    // sin localStorage no hay nada que borrar
  }
  $('clave').value = '';
  avisar('Clave borrada.');
});

$('formTexto').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = $('entrada').value;
  if (texto.trim() === '') return;
  $('entrada').value = '';
  turno({ tipo: 'texto', texto });
});

$('clave').value = leerClave();
pintarPanel(armarPanel(null));
pintarEscena();
