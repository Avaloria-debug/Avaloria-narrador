# Prompts v2: narrador sin IA (corregido)

Uso: P0 una vez por sesión + un prompt de paso. Uno por sesión. Modelo: Opus 5.5. Esfuerzo entre paréntesis.
Repo: `Avaloria-debug/avaloria-narrador`. Texto nuevo ya escrito: `data/contenido/ampliado/t00–t19` (estado `a_aprobar`).
Orden: P1 → P1.5 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10 → P11 → P12 → P13 → extensiones P14–P22 (al final del documento).

Cambios vs v1: P1.5 (merge de `ampliado/`), RNG derivado por subsistema, motor de eventos fijado, formato de condiciones = el de t00 (`c`), sin fast-check, reporte como artifact, pasos que consumen cada tanda, esfuerzo por paso.

---

## P0 — Contexto fijo

```
Repo avaloria-narrador. Leé CLAUDE.md y respetalo. No leas docs que la tarea no pida.
Reglas:
- Código nuevo en /narrador/ (scripts en /tools/). ES modules, sin build, node --test. Sin dependencias nuevas.
- No tocar ui/, index.html, docs/ existentes, data/contenido/contenido-v3.json.
- Sin texto narrativo en código. Texto nuevo → data/contenido/ampliado/ (formato en t00-guia.json). Lo no escrito → "A APROBAR" en el informe.
- Retrocompatible: sin ampliado/, la salida es idéntica a antes con la misma semilla.
- RNG: azar.js inyectado. Cada subsistema usa rng derivado: derivar(rng, "nombre") = mulberry32(hash(semillaBase+nombre)); estado guardable por subsistema. Prohibido consumir el rng principal desde un módulo nuevo (si no, cambia la salida existente).
- Motor de eventos: SOLO narrador/eventos.js. No tocar core/eventos/.
- Archivos nuevos completos; existentes por diff.
- No preguntes. Ambigüedad → opción más simple, anotar en docs/SUPUESTOS-v3.md.

Bucle de errores (máx. 3 vueltas por error):
1. node --test <archivo del módulo>.
2. Si falla: leer SOLO el test que falla y el código que toca. Clasificar: (a) bug mío, (b) test viejo que asume conducta anterior, (c) dato de contenido.
3. (a) corregir. (b) solo si cambiar esa conducta es el objetivo del paso; si no, mi código está mal. (c) no editar contenido: adaptar código o anotar.
4. Re-correr. 3 vueltas sin éxito → revertir el cambio parcial, anotar causa, seguir con lo demás.
Cierre: npm test completo + node narrador/validarContenido.js (debe validar también ampliado/). Verde → VERSION +0.0.1 y narrador/prueba/index.html → 1 commit.
Si npm test no corre en el entorno: decirlo en "sin verificar"; no declarar verde.

Informe (máx. 15 líneas): archivos, tests nuevos, errores resueltos (1 línea c/u), supuestos, A APROBAR, sin verificar.
```

---

## P1 — Medición base (esfuerzo bajo)

```
Tarea: tools/simular.js. Medir ANTES de cambiar nada.
- CLI: --partidas N (200) --turnos M (50) --semilla S.
- Cada turno: acción válida al azar (intención + parámetros del estado) → narrar.
- Salida tools/reporte/reporte.json + reporte.html (tabla, sin dependencias): frecuencia por plantilla, plantillas nunca usadas, top 20 aperturas repetidas, escenas sin texto ambiental, NPCs que no se movieron, excepciones con semilla y turno, palabras totales distintas emitidas.
- Test: N=2, M=10, misma semilla → mismo reporte.
Commit: "medicion: simulador y reporte base". Informe con 5 números clave.
```

## P1.5 — Carga de contenido ampliado (esfuerzo medio) — NUEVO

```
Tarea: narrador/contenidoAmpliado.js + integrar en el cargador actual.
- Cargar data/contenido/ampliado/*.json (ordenado por nombre) y fusionar sobre v3 en memoria; v3 no se modifica.
- Opcional: sin carpeta o vacía → v3 puro (test).
- Ignorar archivos con "estado":"borrador"; con "a_aprobar" y "a_aprobar_canon": cargar solo si opción cargarPendientes=true (def true en tools/ y prueba, false en producción hasta aprobar).
- Mapa por clave: ambiente→escena, plantillas→plantillas (suma variantes), voces/memoria/rumores/charla→por npc, eventos/cierre→por id, simbolos→gramática, conocimientos→npc.conocimientos (ids únicos; duplicado = error), temas→npc.temas, unicos→lista única, reformulacion→claves nuevas.
- validarContenido.js: validar ampliado: JSON, claves de `c` permitidas (f cl r ts rec ant esc npc vis rep cat fz), ids existentes, placeholders ({npc} {objeto} {lugar} {conocimiento} {nombres}), símbolos #x# resolubles, ids de conocimiento únicos.
Tests: sin ampliado = idéntico; fusión suma; duplicado falla; símbolo inexistente falla.
Re-correr simular.js: sin cargarPendientes, igual a P1.
```

## P2 — Selección por especificidad (bajo-medio)

```
Tarea: narrador/seleccion.js.
- hechosDe(estado, contexto) → {f franja, cl clima|null, r relación (mala|neutra|buena), ts tensión (baja|alta), esc, npc, vis (1|2|3+), rep (1|2|3+), cat (ciudad|camino|otro), rec verbos recordados, ant (reciente|lejano), fz (fuerte|difuso)}. Umbrales en t00-guia.json.
- cumple(c, hechos): igualdad o lista (cualquiera); "3+" = ≥3; clave ausente en hechos → no cumple.
- elegir(variantes, hechos, {rng, aperturas}): filtrar los que cumplen; mayor nº de claves en `c`; desempate con aperturas (VENTANA_APERTURAS=5) y rng derivado "seleccion". String o sin `c` = 0 claves.
- Los consumidores actuales pasan por elegir(). Sin `c` en contenido = salida idéntica (test).
Tests: especificidad gana, genérico de respaldo, listas, clave ausente, retrocompatibilidad.
Re-correr simular.js: igual a P1.
```

## P3 — Gramática (medio)

```
Tarea: narrador/gramatica.js.
- expandir(texto, simbolos, {rng, hechos, profundidadMax=6}): #a.b# resuelve en orden: a.b.<franja>.<clima> → a.b.<franja> → a.b.<clima> → a.b. Variante al azar con rng derivado "gramatica".
- Modificadores .el/.un/.de solo si el dato tiene género/número; sin dato → masculino singular y anotar supuesto (no hay género en v3; tablas en t00-guia.json).
- Placeholders {npc} etc. siguen igual y se aplican después.
- Símbolo inexistente o tope → eliminar el símbolo, registrar en estado.avisos, nunca romper.
Tests: orden de resolución, recursión, tope, símbolo faltante, semilla; 500 expansiones sin "#".
Cierre: validar que t01 y t15 expanden sin avisos.
```

## P4 — Ambiente, clima y franja (medio)

```
Tarea: narrador/ambiente.js + clima en reloj.js.
- Franja horaria (madrugada|manana|tarde|noche) derivada del reloj; umbrales en t00.
- estado.clima ∈ [despejado, nublado, lluvia, niebla]; cambia cada 6 h con rng derivado "clima". Partida vieja → "despejado".
- mensajeAmbiental(estado,{rng}): usa ambiente de la escena (t02, t13) vía elegir; prob 0.25; nunca 2 turnos seguidos; sin repetir en ventana 8; sentido dominante de t00.
- Rutinas y gestos de NPC (t03): en saludo/charla si el NPC está presente.
- Sin datos → nada.
Tests: probabilidad con semilla, no consecutivo, ventana, cambio de clima, carga vieja, retrocompatibilidad.
```

## P5 — Intenciones y voces (medio)

```
Tarea: consumir t04, t14 (plantillas por intención) y t05, t17 (voces, charla).
- Plantillas de intención: variantes con `c` se suman a las del v3 por intención/resultado.
- npc.voces.saludo/despedida/no_se/revelar reemplazan las genéricas si el NPC coincide; {conocimiento} se rellena.
- charla.<npc>: se usa en hablar_con sin conocimiento ni tema.
Tests: voz del NPC gana a genérica, charla sin conocimiento, retrocompatibilidad.
```

## P6 — Memoria de hechos (medio)

```
Tarea: narrador/hechos.js + consumir t06, t18.
- estado.hechos[]: {id,tipo,npc,escena,tick,peso}. Máx 200; borrar menor peso y más viejo.
- Registrar verbos presionar, atacar, ayudar, negociar, emboscar, defender (peso 2; atacar 3).
- hechosDe: rec [verbos del npc actual], ant (≤48 h reloj = reciente).
- memoria.<npc>.<verbo> = [reciente, lejano]; genericas si el NPC no tiene línea.
- Persistencia en guardado actual; partida vieja → [].
Tests: registro, tope, carga vieja, reciente/lejano, callback elegido.
```

## P7 — Utilidad por NPC (medio)

```
Tarea: etiquetas de verbos en narrador/etiquetasVerbos.js (código, no texto).
- npc.valores{orden,dinero,curiosidad,miedo,lealtad} ∈ -2..2 opcional (ausente = 0; no editar v3: valores en data/contenido/ampliado/valores.json si existe).
- deltaRelacion extra = Σ peso×etiqueta, acotado ±1.
- hechosDe: afinidadAccion.
Tests: npc sin valores = conducta idéntica; dos NPCs reaccionan distinto.
A APROBAR: tabla de valores para los 12 NPCs.
```

## P8 — Eventos con saliencia y tensión (medio-alto)

```
Tarea: SOLO narrador/eventos.js (diff mínimo) + consumir t09, t19.
- estado.tension 0..10: +2 conflicto, -1 por turno de calma.
- Puntaje = especificidad(cuando) + min(10, turnos desde último uso)/2 + ajuste(|tensionObjetivo - tension|).
- tensionObjetivo +1 cada 10 turnos sin evento; vuelve a 3 tras uno.
- Variantes de inicio de t09/t19 se suman a las del v3; cierre.<categoria> al expirar.
- Mayor puntaje; empate con rng derivado "eventos".
Tests: frescura evita repetición, especificidad gana, tensión acotada, semilla.
Re-correr simular.js: comparar repetición de eventos vs P1.
```

## P9 — Rumores (medio)

```
Tarea: narrador/rumores.js desde avanzarMundo + consumir t07, t18.
- Cada 6 h: hechos peso≥2 se copian a NPCs de escenas conectadas con fuerza=peso-1; sarin_mensajera y brenn_arriero propagan fuerza completa. Fuerza 0 no propaga. Sin duplicados por NPC.
- hechosDe: escuchoDe, fz (fuerte|difuso). remate_ciudad y reaccion_npc según relación.
Tests: propagación, decaimiento, sin duplicados, mensajeros.
```

## P10 — Conocimientos, temas y únicos (medio)

```
Tarea: consumir t16 y t12.
- conocimientos nuevos: misma lógica del v3 (umbralRelacion, requiereEvento, requiereMarca, palabrasClave). pista[] si falta relación.
- temas.<npc>.<tema>: respuesta si hay tema reconocido y ningún conocimiento coincide. Mapa tema↔palabras en código SIN texto (dinero, guerra, camino, tiempo, gente, trabajo, ciudad, rumor).
- únicos (t12): unica:true sale una vez por partida; estado.unicasUsadas persistido. `u_niebla_voces`: no cargar hasta aprobar (posible choque con regla sin magia).
Tests: tema sin conocimiento, conocimiento gana a tema, pista, única no repite, carga vieja.
```

## P11 — Comprensión: stemmer + n-gramas (alto)

```
Tarea:
- narrador/stemmer.js: Snowball español propio. Tests con 20 pares (palabra→raíz) que verifiques contra la especificación Snowball en el sitio oficial; los que no puedas verificar → "sin verificar", no inventarlos.
- narrador/ngramas.js: trigramas de caracteres con bordes + coseno.
- comprension.decidir: si la vía actual no resuelve, 2ª pasada stem; luego n-gramas umbral 0.6; solo antes de reformular.
- t11 (reformulación diferenciada): requiere claves nuevas verbo_desconocido, nombre_desconocido, objeto_desconocido, destino_invalido, cerrado; soportarlas con fallback a la reformulación actual.
- Registro: campo opcional con la pasada que resolvió.
Tests: "calmando la situacion", typos, falso positivo no resuelve, casos actuales sin cambio. Correr comprension*.test.js.
```

## P12 — Propiedades sin dependencias + CI (medio)

```
Tarea:
- narrador/propiedades.test.js con generador propio (mulberry32 + secuencias de acciones, sin fast-check; 200 corridas, semilla fija). Propiedades: (1) salida sin "{" "}" "#" sin expandir; (2) estado serializable y válido tras 30 acciones; (3) texto del jugador no aparece en la salida; (4) misma semilla → misma salida; (5) estado.avisos vacío con contenido aprobado.
- Fallo → reproducir con semilla, reducir a mano, bucle de P0.
- .github/workflows/narrador.yml: checkout, node, npm test, node tools/simular.js, subir tools/reporte con actions/upload-artifact. NO desplegar a Pages ni tocar el workflow de Pages existente. Lo no probado en local → "sin verificar".
```

## P13 — Medición final y aprobación (bajo)

```
Tarea: re-correr simular.js con cargarPendientes=true; comparar con P1: plantillas nunca usadas, top aperturas, palabras distintas, excepciones. Listar en informe todos los A APROBAR y el estado de cada tanda. No cambiar "estado" de ningún JSON (lo cambia el autor).
```

---

---

# Extensiones (después de P13; cada una independiente, en este orden)

Texto nuevo de cada una → `data/contenido/ampliado/t20+`, `"estado":"a_aprobar"`. Código sin texto narrativo.

## P14 — Eco del jugador (medio)

```
Tarea: narrador/eco.js.
- Del texto del jugador extraer SOLO tokens ya reconocidos (NPC, objeto, lugar, verbo normalizado) y 1 sustantivo/adjetivo libre ≤12 letras si pasa filtro (sin stopwords, sin insultos de una lista en data, sin números).
- hechosDe agrega eco:{verbo,objeto,palabra}. Plantillas con `{eco}` o `c:{eco:1}` usan la palabra. Sin eco válido → variante sin `{eco}`.
- Máx. 1 eco cada 4 turnos; nunca citar frases completas del jugador (propiedad 3 de P12 se mantiene: texto literal no aparece).
- Texto: t20-eco.json, ~60 variantes con `{eco}` por intención.
Tests: filtro, límite de frecuencia, sin eco, propiedad 3.
```

## P15 — Consecuencias visibles en el mundo (medio-alto)

```
Tarea: narrador/consecuencias.js, llamado desde avanzarMundo.
- Tabla en data (no en código): hecho(tipo,npc,peso) → efecto{id, escena, duracionH, c}. Ej.: ayudar a Serel → "pan_extra" en mercado_circular 24 h.
- estado.efectos[] con expiración por reloj; persistir; partida vieja → [].
- hechosDe agrega efectos activos de la escena; ambiente y saludos pueden pedirlos en `c` (clave efecto).
- Texto: t21-consecuencias.json, 1–2 líneas de aparición y 1 de expiración por efecto; ≥2 efectos por NPC, todos pequeños (nada que cambie la trama).
Tests: aparece, expira, persiste, no se duplica, retrocompatibilidad.
```

## P16 — Objetivos personales por NPC (alto)

```
Tarea: narrador/objetivos.js.
- Datos en data/contenido/ampliado/objetivos.json: por NPC 1–2 objetivos {id, descripcion_corta, pasos[{c,avanzaCada(h),prob}], estadoFinal}. Avanzan con rng derivado "objetivos" en avanzarMundo, aunque el jugador no esté.
- Hechos del jugador pueden acelerar/frenar (ayudar +, presionar −), vía etiquetas, no texto.
- hechosDe agrega objetivoPaso:{npc→id.paso}. Saludos/charla/rumores pueden pedirlo.
- Texto: t22-objetivos.json (≥3 líneas de charla por paso, 1 rumor por paso).
Tests: avanza sin jugador, determinista con semilla, persiste, acelera/frena.
A APROBAR: los objetivos son canon propuesto; no activar sin aprobación.
```

## P17 — Diario automático (medio)

```
Tarea: narrador/diario.js + comando existente o nuevo "diario".
- Entradas generadas desde hechos/efectos/eventos: {dia, tipo, npc, escena}. Resumen por día con plantillas `c` (tipo, fz).
- Máx. 50 entradas; funde las viejas en una línea por día.
- Persistir. Sin hechos → mensaje vacío de plantilla.
- Texto: t23-diario.json (~80 líneas con símbolos y {npc}{lugar}).
Tests: orden, tope, fusión, partida vieja, sin hechos.
```

## P18 — Apodo del jugador (bajo-medio)

```
Tarea: narrador/apodo.js.
- Apodo derivado del hecho de mayor peso reciente (o del verbo más usado ≥5 veces) vía tabla en data: verbo/tipo → lista de apodos.
- hechosDe agrega apodo. Plantillas con `{apodo}` solo desde relación ≥ neutra de ese NPC; antes "forastero".
- Máx. 1 apodo activo; cambia solo si otro supera por ≥2 puntos.
- Texto: t24-apodos.json (tabla + ~40 usos en saludos).
Tests: derivación, cambio con histéresis, NPC sin relación, persistencia.
```

## P19 — Ritmo y silencio (bajo)

```
Tarea: en seleccion/narrarTurno.
- hechosDe: ritmo (corto si ts alta o repeticion≥3; largo si ts baja y vis≥3).
- Plantillas pueden marcar `largo`:true/`corto`:true (en `c`: ritmo). Preferir las que coinciden; si no hay, caer a las demás.
- Silencio: con prob 0.1 y ts alta, la respuesta es solo gesto (#gesto.tenso#) sin diálogo.
- Texto: t25-silencio.json (~50 líneas cortas por intención y 20 de solo gesto).
Tests: selección por ritmo, silencio acotado, determinismo.
```

## P20 — Errores amables en escena (bajo)

```
Tarea: integrar t11 con la escena actual.
- La reformulación elige variante por NPC presente (voces) y franja; si no hay NPC, símbolo de ambiente.
- Máx. 2 reformulaciones seguidas; la 3ª sugiere (código) opciones válidas del contexto sin texto nuevo en código.
- Texto: t26-reformulacion2.json (~60 líneas por NPC presente, 12 NPCs × 5).
Tests: elección por NPC, límite, opciones válidas.
```

## P21 — Calendario y festividades (medio)

```
Tarea: narrador/calendario.js.
- Días de reloj → estación (4) y festividad (datos en data/contenido/ampliado/calendario.json: id, día del año, ciudad, duración).
- hechosDe: estacion, festividad. Ambiente, eventos (`c`) y saludos pueden pedirlas.
- Festividades = canon propuesto: A APROBAR.
- Texto: t27-calendario.json (~120 líneas: 4 estaciones × 12 escenas ambiente corto + 6 festividades × 8 líneas).
Tests: transición estación, festividad activa/inactiva, partida vieja.
```

## P22 — Modo revisión de contenido (bajo)

```
Tarea: tools/revisar.js.
- Lista por tanda: cantidad de líneas, 5 líneas al azar con sus condiciones, y errores de validación.
- Salida tools/reporte/revision.html (tabla; sin dependencias) con filtro por tanda, NPC, estado; botón "marcar aprobado" que NO escribe: genera un diff JSON de estados para pegar a mano.
- Incluir A APROBAR acumulados (t16, t22, t27, objetivos).
Tests: salida estable con semilla; tanda vacía.
```

---

## PE — Rescate

```
El último paso dejó tests rojos o conducta incorrecta.
1. git log -3 y git diff HEAD~1 --stat. Identificar paso.
2. npm test; listar solo nombres fallidos.
3. Por cada uno, bucle de P0.
4. Causa de diseño → git revert, anotar en docs/SUPUESTOS-v3.md, proponer en 3 líneas cómo rehacer.
Informe: causa, arreglo o reversión, tests en verde sí/no.
```

## PR — Revisión tras cada paso

```
Revisá el último commit contra P0 sin cambiar código: ¿texto narrativo en código? ¿v3 tocado? ¿retrocompatibilidad probada? ¿rng derivado (no el principal)? ¿VERSION subida? ¿validarContenido cubre ampliado?
Correr tools/simular.js y comparar con el reporte anterior.
Salida: incumplimientos (o "OK") + 3 números.
```
