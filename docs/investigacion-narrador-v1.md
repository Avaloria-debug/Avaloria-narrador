# Investigación: narrador sin IA — realismo e inmersión

Destino: Claude Opus 5.5, esfuerzo bajo. Repo: `Avaloria-debug/avaloria-narrador`.
Restricciones vigentes (CLAUDE.md): todo texto narrativo vive en `data/contenido/contenido-v3.json` y lo aprueba Tomás; el código solo elige y combina. Sin servidor, sin tokens. Corre en navegador (GitHub Pages).

## 0. Estado actual (base)
- Comprensión: normalizar → tokenizar → quitar vacías → Levenshtein por largo de palabra (≤3 exacto, 4 → ≤1, >4 → ≤2) → intención/NPC/objeto/destino → reformular 1 vez → IA (Groq).
- Narración: `narracion.js`. `elegirPlantilla` elige al azar entre variantes de un bloque; `completar` sustituye placeholders planos (`npc, objeto, lugar, conocimiento, nombres`); anti-repetición por apertura (`VENTANA_APERTURAS=5`).
- Mundo: `reloj.js`, `eventos.js`, `movimientoNpcs.js`, `npcs.js` (relación, estado emocional), `conocimientos.js` (revelables por NPC).
- Límite: el texto no depende del contexto fino (hora, clima, historia, ánimo). Misma acción → mismo tipo de frase. El mundo no cambia si el jugador no actúa. Los NPCs no recuerdan hechos concretos.

## 1. Métodos

Formato: Qué es · Fuente · Cambio en el repo · Diferencia con lo actual.

### M1. Selección por especificidad (reglas de Valve)
- Qué: cada línea declara condiciones sobre hechos del mundo; gana la que más condiciones cumple; las genéricas quedan de respaldo.
- Fuente: Elan Ruskin, "AI-driven Dynamic Dialog through Fuzzy Pattern Matching", GDC 2012 (Left 4 Dead). PDF público en cdn steamstatic.
- Cambio: plantillas con campo `cuando` (ej. `{franja:"noche", clima:"lluvia", relacion:">=2", eventoReciente:"incendio"}`). Nuevo módulo `narrador/seleccion.js`: arma un diccionario plano de hechos del estado → filtra plantillas que cumplen → ordena por nº de condiciones → desempata con rng + ventana de aperturas. `elegirPlantilla` pasa a llamarlo.
- Diferencia: hoy azar uniforme; después, texto que reacciona al contexto. Contenido viejo sigue andando (0 condiciones = genérica).
- Prioridad: 1. Es la base de M3, M4, M5, M8.

### M2. Gramáticas de reemplazo (tipo Tracery)
- Qué: símbolos anidados en JSON que se expanden recursivamente (`#apertura# #gesto_npc#`).
- Fuente: Compton, Kybartas, Mateas, "Tracery", ICIDS 2015. Caves of Qud usa gramáticas + máquina de estados para historia y mitos (Grinblat y Bucklew, PCG 2017).
- Cambio: `narrador/gramatica.js`: expansión recursiva con tope de profundidad, rng con semilla, modificadores de concordancia española (`.el`, `.un`, género/número desde datos del NPC/objeto). Símbolos en una sección nueva del contenido (requiere aprobación de Tomás).
- Diferencia: hoy una plantilla = una frase; después, 40 fragmentos → cientos de combinaciones coherentes.
- Riesgo: concordancia rota. Mitigar con test que expanda todos los símbolos y busque `#` sin resolver.

### M3. Ambiente vivo (sentidos, tiempo, clima, rutinas)
- Qué: mensajes ambientales por turno, sentido dominante por lugar, eventos de fondo con horario, NPCs ocupados aunque no se interactúe.
- Fuente: Emily Short, "Inform 7 for the fiction author" (every-turn rules, atmósfera, Weather, horarios). Guía IF "Setting as Character": usar todos los sentidos.
- Cambio: en contenido, por escena: `sentidoDominante`, pool `ambiente` con condiciones M1 (franja, clima). Por NPC: `rutina` por franja. Módulo `narrador/ambiente.js`: probabilidad baja, nunca dos turnos seguidos, sin repetir dentro de ventana. Clima: estado simple en `reloj.js` (cambia cada N horas).
- Diferencia: hoy la escena es estática entre acciones; después, el lugar "respira".
- Riesgo: mensajes genéricos delatan la máquina. Siempre atados a escena.

### M4. Memoria de hechos + callbacks (Wildermyth)
- Qué: cada elección relevante deja una "línea de historia" y un "gancho" que habilita contenido futuro.
- Fuente: Wildermyth wiki, "Event design philosophy" (History Line + Hook). Alterna capas hechas a mano y procedurales.
- Cambio: `estado.hechos[]`: `{id, tipo, actor:"jugador", npc, escena, tick, peso}`. Se registra al resolver acciones marcadas como memorables. M1 expone hechos como condiciones (`recuerda:"presionado_por_jugador"`). Plantillas de callback en contenido.
- Diferencia: hoy la relación es un número; después, el NPC recuerda qué pasó, dónde y cuándo.

### M5. Rumores / propagación de conocimiento
- Qué: los hechos viajan entre NPCs y escenas, pierden fuerza y se distorsionan.
- Fuente: Talk of the Town / Neighborly (Johnson-Bey y Nelson, CoG 2022). Kreminski, "Toward Better Gossip Simulation", CoG 2023: problema abierto, ningún sistema lo simula completo.
- Cambio: en `avanzarMundo`, cada N horas copiar hechos con peso ≥ umbral a NPCs de escenas conectadas (Sarin, Brenn como vectores). `fuerza` decrece; distorsión = elegir variante de texto según sesgo del NPC (no inventa datos). Reutilizar `conocimientos.js` (conocimientos creados en partida).
- Diferencia: hoy lo que pasa en Ardenhall no existe en Lareth; después, la reputación precede al jugador.

### M6. Storylets + saliencia + puntaje de tensión (gestor de drama)
- Qué: piezas narrativas con precondiciones y efectos; se elige la más saliente. Un gestor ajusta el ritmo.
- Fuente: Kreminski y Wardrip-Fruin, "Sketching a Map of the Storylets Design Space", ICIDS 2018. Emily Short, "Beyond Branching" (2016): empezar con contenido amplio y sumar específico. Façade: drama manager por beats (Mateas y Stern).
- Cambio: en `core/eventos/motorEventos.js`, reemplazar elección al azar entre válidos por puntaje = especificidad + frescura (turnos desde la última vez) + ajuste a la tensión objetivo. `estado.tension` sube con conflictos y baja con calma; si pasan N turnos sin evento, subir peso de eventos.
- Diferencia: hoy los eventos son sorteo; después, curva de ritmo (calma → tensión → resolución).

### M7. Pesos de utilidad por NPC (Versu)
- Qué: la personalidad es cuánto valora cada NPC cada tipo de acción/resultado; reacciona con lo que maximiza su utilidad.
- Fuente: Evans y Short, "Versu — A Simulationist Storytelling System", IEEE TCIAIG 2014. Ensemble/Prom Week (McCoy et al.).
- Cambio: en contenido, por NPC: `valores:{orden, dinero, curiosidad, miedo, lealtad}` (-2..+2). En `npcs.js`/`motorNPCs.js`: delta de relación y reacción = Σ(peso × etiqueta de la acción). Las acciones del vocabulario llevan etiquetas.
- Diferencia: hoy reacción por categoría de relación; después, mismo acto → reacciones distintas y coherentes por personalidad.

### M8. Capa de discurso (qué pasó ≠ cómo se cuenta)
- Qué: el mismo hecho se narra distinto según ritmo, foco y repetición.
- Fuente: Nick Montfort, "Generating Narrative Variation in Interactive Fiction" (tesis UPenn).
- Cambio: post-proceso en `narrarTurno`: con tensión alta, elegir variantes cortas; acción repetida 3+ veces seguidas, usar variante elíptica; foco en el sentido dominante (M3). Solo selecciona variantes del contenido, no reescribe texto.
- Diferencia: hoy todas las salidas tienen el mismo tono; después, ritmo de narrador humano.

### M9. Momentos raros (romper el molde)
- Qué: plantillas de probabilidad muy baja atadas a condiciones únicas.
- Fuente: reseña de "Annals of the Parrigues" (Short, 2015): el ritmo generativo hace más fuerte la ruptura.
- Cambio: flag `unica:true` + condiciones M1 (primer amanecer en el lago, 3.ª visita a la biblioteca). Se registra en `estado.hechos` para no repetirla.
- Diferencia: no existe hoy. Genera los recuerdos del jugador.

### M10. Medición: simulación masiva + fast-check
- Qué: jugar miles de turnos al azar y verificar invariantes con pruebas de propiedades (semilla reproducible, shrinking, model-based).
- Fuente: fast-check.dev (docs model-based testing y fuzzing). Emily Short, "Visualizing Procgen Text": diseñar y editar el corpus es la mayor parte del trabajo.
- Cambio: `tools/simular.js` (N partidas, M turnos, semilla) → reporte JSON+HTML: frecuencia por plantilla, plantillas nunca usadas, aperturas repetidas, escenas sin ambiente, NPCs atascados. `narrador/propiedades.test.js` con fast-check (devDependency): sin placeholders vacíos, sin `#` sin expandir, estado válido tras cualquier secuencia, texto del jugador nunca en salida del narrador. GitHub Action que corre la simulación y publica el reporte en Pages.
- Diferencia: hoy tests por ejemplos; después, cobertura medida y regresiones detectadas antes de escribir contenido.

### M11. Comprensión: n-gramas + stemmer
- Qué: segunda pasada robusta a typos y conjugaciones antes de reformular.
- Fuente: Shridhar et al., "Subword Semantic Hashing for Intent Classification on Small Datasets" (arXiv 1810.07150). Rasa: n-gramas de caracteres más robustos a typos. Stemmer Snowball español (también en lorca-nlp, basado en Porter).
- Cambio: `narrador/stemmer.js` (copiar algoritmo Snowball, ~100 líneas, sin dependencia). `narrador/ngramas.js`: trigramas de caracteres, similitud coseno contra formas del catálogo; solo si Levenshtein falla y con umbral alto. Reformulación diferenciada: "no entendí la acción" vs "no sé qué/quién es X".
- Diferencia: hoy "calmando" o typos de 3 letras fallan y van a IA; después, menos reformulaciones y menos llamadas a Groq.
- Opcional, al final: embeddings estáticos Model2Vec (tabla token→vector, sin GPU). El modelo chico (~700 KB) es mayormente inglés; el multilingüe pesa más. Solo si M11 no alcanza.

## 2. Plataforma
- GitHub Pages: sitio publicado ≤1 GB, ancho de banda blando 100 GB/mes, deploy ≤10 min. Contenido actual ~60 KB: sin problema. Si crece: cargar por ciudad.
- Todo en ES modules en navegador. Sin build obligatorio.

## 3. Pasos recomendados (orden)
Cada paso = 1 commit, suite en verde, versión +0.0.1 (regla de CLAUDE.md).

1. **M10 base**: `tools/simular.js` + reporte. Medir el estado actual antes de cambiar nada.
2. **M1**: `seleccion.js` + campo `cuando`. Retrocompatible. Tests de especificidad y respaldo.
3. **M2**: `gramatica.js` + concordancia. Test de expansión total.
4. **M3**: ambiente + clima + rutinas. Estructura en código; textos los propone y aprueba Tomás.
5. **M4**: `estado.hechos` + callbacks.
6. **M7**: pesos de utilidad por NPC.
7. **M6**: puntaje de saliencia + tensión en eventos.
8. **M5**: rumores sobre M4.
9. **M8 + M9**: capa de discurso y momentos raros.
10. **M11**: stemmer + n-gramas.
11. **M10 completo**: fast-check + GitHub Action publicando el reporte.

Regla para cada paso: el código nuevo solo selecciona y combina; el texto nuevo va a una lista "a aprobar por Tomás" en el informe, no al contenido.

## 4. Antes vs después (resumen)
| Aspecto | Hoy | Con métodos |
|---|---|---|
| Elección de texto | azar entre variantes | la más específica al contexto (M1) |
| Variedad | 1 plantilla = 1 frase | combinatoria por gramática (M2) |
| Escena | estática | ambiente, clima, rutinas (M3) |
| NPC | número de relación | recuerda hechos (M4), personalidad (M7) |
| Mundo | local | rumores entre ciudades (M5) |
| Ritmo | plano | tensión y discurso (M6, M8) |
| Comprensión | Levenshtein | + stemmer + n-gramas (M11) |
| Calidad | tests por ejemplo | simulación + propiedades (M10) |

## 5. Lectura clave
- Short y Adams (eds.), *Procedural Storytelling in Game Design* (2019): Ingold (impulso narrativo), Snow (texto fijo + procedural), Dias (descripciones en Voyageur), Adams (Dwarf Fortress), Grinblat (generar historias).
