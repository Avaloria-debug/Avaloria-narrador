// Página de prueba aislada del narrador. Se abre con un servidor local desde la raíz del repo
// (pasos en docs/PENDIENTES.md). No usa ui/ ni index.html de Avaloria, ni Firestore.
// La clave de Groq vive en localStorage de este navegador y solo viaja a la API de Groq (narrador/ia.js).
// Todo lo que se muestra se escribe con textContent: el texto del jugador nunca se interpreta.
import { crearPartida, cargarPartida, narrar, contenido, problemasDiccionarios } from '../index.js';
import { textoDeProblemasDeDiccionarios } from '../diccionarios.js';
import { crearColaDeRegistros } from '../registro.js';
import { ExportacionArchivo } from '../registro/exportacionArchivo.js';
import { crearAlmacenIndexedDB } from '../../persistencia/adaptadores/almacenIndexedDB.js';
import { cargarAmpliadoPagina } from './ampliado.js';
import { crearIaLocal } from '../iaLocal/motor.js';
import { botonesDeTurno, filaOculta, guardarFilaOculta, textoParaInput, TEXTOS_FILA } from './filaOpciones.js';
import { esNoEntendida, guardarNoEntendida, leerNoEntendidas, exportarNoEntendidas } from './noEntendidas.js';
import { infoDePagina, estadoDeBoton, textoDeAviso, textoDeProgreso, leerFlag, CLAVE_FLAG } from './iaLocalPagina.js';
import { opcionesDeEscena, entradaDeBoton, llamadaDeRespuesta, armarPanel, fijarRelacion, CLAVE_LOCALSTORAGE_GROQ, BD_PRUEBA, CLAVE_PARTIDA } from './panel.js';

// Contenido ampliado (Q3): se carga una vez; `?ampliado=0` o localStorage `ampliado=0` lo apaga.
const { ampliado, avisos: avisosAmpliado } = await cargarAmpliadoPagina({ v3: contenido });
if (avisosAmpliado.length > 0) console.warn('contenido ampliado no cargado', avisosAmpliado);

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
// Registros de turnos de esta sesión, solo en memoria; se bajan con "Exportar registros". No se envía nada por red.
const exportacion = new ExportacionArchivo();
const pintarContador = () => {
  $('exportar').textContent = `Exportar registros (${exportacion.cantidad})`;
};
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
  pintarFila();
  pintarContador();
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
    const iaLocalTurno = iaLocal?.listo() ? { listo: () => true, pedir: async (o) => { const t0 = performance.now(); const r = await iaLocal.pedir(o); medidaLocal = { latenciaMs: Math.round(performance.now() - t0), ...r.tokens, modelo: iaLocal.modelo() }; return r; } } : null;
    const antes = estado;
    salida = await narrar(estado, entrada, { groqKey: leerClave() || null, http, cola, registroTurnos: exportacion, ...(ampliado ? { ampliado } : {}), ...(iaLocalTurno ? { iaLocal: iaLocalTurno } : {}), densidad: $('densidad')?.value || 'normal' });
    estado = salida.estado;
    if (entrada?.tipo === 'texto' && esNoEntendida(salida)) { guardarNoEntendida(localStorage, entrada.texto, antes); pintarNoEntendidas(); }
  } catch (e) {
    // `narrar` no lanza; por si acaso, se muestra como error de la página.
    salida = { texto: '', tipo: 'error', registro: null, errores: [`pagina: ${e instanceof Error ? e.message : String(e)}`] };
  }
  pintarContador();
  ocupado = false;
  const panel = armarPanel(salida, { llamadas, pendientes: cola.pendientes().length });
  if (medidaLocal) { panel.tokens = { ...(panel.tokens ?? {}), local: medidaLocal }; medidaLocal = null; }
  pintarPanel(panel);
  pintarEscena();
}

$('exportar').addEventListener('click', () => {
  if (exportacion.cantidad === 0) return avisar('No hay registros para exportar.');
  exportacion.descargar('registros-turnos.jsonl');
});

$('crear').addEventListener('click', () => {
  try {
    estado = crearPartida();
    avisar('Partida creada.');
  } catch (e) {
    // Sin diccionarios el narrador no arranca: el error se ve en pantalla y en la consola.
    avisar(e instanceof Error ? e.message : String(e));
    console.error(e);
  }
  pintarEscena();
});

// Diccionarios obligatorios: si falta alguno, la página lo dice al abrirse y no deja crear ni cargar partidas.
if (problemasDiccionarios.length > 0) {
  const mensaje = textoDeProblemasDeDiccionarios(problemasDiccionarios);
  avisar(mensaje); // la consola ya la escribe index.js al cargar
  for (const id of ['crear', 'cargar']) if ($(id)) $(id).disabled = true;
}

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

// ---- Fase 5: IA local (apagada por defecto; ?ialocal=0 la apaga). SIN VERIFICAR en navegador real. ----
let iaLocal = null;
let medidaLocal = null;
async function iniciarIaLocal() {
  const env = { navigator, sessionStorage, localStorage, location, window };
  const info = infoDePagina(env);
  const boton = $('activarIaLocal');
  let manifest = null;
  try { manifest = await (await fetch(new URL('../iaLocal/modelo-manifest.json', import.meta.url))).json(); } catch { /* sin manifest */ }
  const pintar = (estadoIa) => {
    const b = estadoDeBoton(info, estadoIa);
    $('seccionIaLocal').hidden = !b.visible || !manifest;
    boton.textContent = b.texto;
    boton.disabled = !b.habilitado;
  };
  $('avisoIaLocal').textContent = textoDeAviso(info, manifest);
  pintar('apagada');
  const activar = async () => {
    iaLocal = crearIaLocal({ manifest, nivel: info.nivel, env, alProgreso: (p) => { $('progresoIaLocal').textContent = textoDeProgreso(p); } });
    pintar('cargando');
    const ok = await iaLocal.cargar();
    pintar(ok ? 'lista' : 'fallida');
    if (ok) { try { localStorage.setItem(CLAVE_FLAG, '1'); } catch { /* sin almacenamiento */ } } else iaLocal = null;
  };
  boton.addEventListener('click', activar);
  if (manifest && info.nivel !== 'ninguna' && leerFlag(location, localStorage)) activar();
}
iniciarIaLocal();

// ---- Fase 6 (V8): frases no entendidas (solo en este navegador). Copiar al portapapeles: sin verificar. ----
function pintarNoEntendidas() {
  const b = $('exportarNoEntendidas');
  if (b) b.textContent = `Exportar no entendidas (${leerNoEntendidas(localStorage).length})`;
}
$('exportarNoEntendidas')?.addEventListener('click', async () => {
  const json = exportarNoEntendidas(localStorage);
  try { await navigator.clipboard.writeText(json); avisar('Copiado al portapapeles.'); } catch {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'no-entendidas.json'; a.click(); URL.revokeObjectURL(a.href);
  }
});
pintarNoEntendidas();

// ---- Fase 7 (W5): fila de opciones sobre la barra. Toque largo o ✎: escribe sin ejecutar. SIN VERIFICAR en móvil. ----
var filaEscribir = false;
function botonFila(texto, alTocar, alLargo) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = texto;
  let t = null; let largo = false;
  b.addEventListener('pointerdown', () => { largo = false; t = setTimeout(() => { largo = true; alLargo?.(); }, 500); });
  const cortar = () => clearTimeout(t);
  b.addEventListener('pointerup', cortar); b.addEventListener('pointerleave', cortar);
  b.addEventListener('click', () => { if (!largo) alTocar(); });
  return b;
}
function escribirEnInput(frase) {
  const i = $('entrada'); i.value = textoParaInput(frase); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
}
function pintarFila() {
  const fila = $('filaOpciones'); const verbos = $('filaVerbos'); const ocultar = $('ocultarFila');
  if (!fila) return;
  const oculta = filaOculta(localStorage);
  ocultar.textContent = oculta ? TEXTOS_FILA.mostrar : TEXTOS_FILA.ocultar;
  fila.replaceChildren(); verbos.replaceChildren(); verbos.hidden = true;
  fila.hidden = oculta || !estado || !ampliado;
  if (fila.hidden) return;
  const lapiz = botonFila(TEXTOS_FILA.escribir, () => { filaEscribir = !filaEscribir; lapiz.classList.toggle('activo', filaEscribir); });
  lapiz.classList.toggle('activo', filaEscribir);
  fila.append(lapiz);
  for (const o of botonesDeTurno(estado, { amp: ampliado, contenido })) {
    fila.append(botonFila(o.rotulo, () => {
      verbos.replaceChildren(botonFila(TEXTOS_FILA.volver, () => { verbos.hidden = true; }));
      for (const v of o.verbos) {
        verbos.append(botonFila(v.rotulo, () => { if (filaEscribir) escribirEnInput(v.frase); else if (!ocupado) turno({ tipo: 'texto', texto: v.frase }); }, () => escribirEnInput(v.frase)));
      }
      verbos.hidden = false;
    }));
  }
}
$('ocultarFila')?.addEventListener('click', () => { guardarFilaOculta(localStorage, !filaOculta(localStorage)); pintarFila(); });
pintarFila();
