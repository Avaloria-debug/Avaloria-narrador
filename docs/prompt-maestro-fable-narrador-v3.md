# PROMPT MAESTRO v3 — Narrador por código + registro (Cleverbot) + Firestore — Crónicas de Avaloria

Modelo: Fable 5.2. Un solo encargo. No hay pasos de aprobación: entregás todo al final, con el informe de la sección 9.

---

## 1. Objetivo

Construir, en módulos separados, el narrador por código completo:
1. Carga y validación del contenido.
2. Comprensión del texto libre.
3. Motor de turnos, estado de escena y eventos.
4. Narración por plantillas.
5. Cliente de la IA de última instancia (Groq).
6. Registro de cada respuesta (sistema tipo Cleverbot), con almacenamiento en Firestore.

**Ubicación:** carpeta `/narrador/` en la raíz del repo, con módulos ES y sin build. Se prueba con `node --test`.
**No se toca el HTML de Avaloria.** La integración con el HTML es una fase posterior.

---

## 2. Archivos de entrada (adjuntos)

1. `contenido-v3.json`: fuente única del contenido. Todos los campos referencian ids de `vocabulario-v1.md`. Claves: `escenas`, `npcs`, `objetos`, `eventos`, `intenciones`, `plantillas` (26 bloques), `transiciones`, `reglas` (incluye economía, combate y persistencia).
1b. `onboarding-v1.md`: textos de la pantalla de clave. Referencia solo para la interfaz.
1c. `cierre-diseno-v1.md`: decisiones de diseño y contrato de entrada. Es la referencia para `narrar`, `crearPartida` y `cargarPartida`.
2. `vocabulario-v1.md`: ids, valores permitidos y nombres. Es la referencia para todo el código.
3. `comprension-v1.md`: cómo se interpreta el texto libre (normalización, typos, alias de NPC, empates, reformulación).
4. `narrador-ia-v1.md`: contrato de la IA de última instancia.
5. `sistema-registro-aprendizaje-narrador.md`: formato del registro. Se usa solo para el formato.
6. `SUPUESTOS.md`: decisiones reversibles. Se respetan.
7. ZIP de la beta del motor (`fase8-orquestador`): base de código a reutilizar donde encaje.

Si algo que necesitás no está en estos archivos, no lo inventes: anotalo en tu informe.

---

## 3. Qué NO tocar

- El HTML publicado de Avaloria.
- Los tests del zip que hoy pasan: tienen que seguir pasando.
- Los archivos de entrada. Si encontrás un error en `contenido-v3.json`, anotalo en el informe y no lo corrijas.

---

## 4. Decisiones cerradas

- Escena inicial del jugador: `escena_mercado_circular`.
- Dinero inicial: aleatorio al crear la partida. Bronce entre 100 y 300, plata entre 0 y 5. Está en `reglas.dineroInicial`.
- Rasgos: ignorados en la versión 1. No afectan al narrador.
- Reloj inicial: 08:00 del primer día.
- Escala de relación: -100 a 100. Delta final = delta × sensibilidad del NPC, recortado al rango.
- Presionar: éxito +5 de relación y -1 de disposición. Fallo -15 y disposición fijada en -2.
- Atacar y Emboscar: -40, disposición fijada en -2, bloquean conocimientos para siempre.
- Estado de escena: el evento de mayor gravedad propio. La escena vecina sube el estado como máximo un nivel, y solo si es más grave.
- Neutros: no cambian el estado de escena.
- Máximo 2 eventos activos por escena.
- El reloj del mundo es el único que avanza. Los viajes descuentan las horas de `reglas.viajeHorasPorCamino`.
- La IA escribe texto. Nunca cambia efectos.
- Presupuesto de la IA: hasta 800 tokens por turno, entre entrada y salida.
- Economía: trabajar gana entre 20 y 60 bronce. Comprar falla si no alcanza, sin descontar nada. El dinero nunca queda en negativo.
- Combate: no hiere al jugador en la versión 1. Solo afecta a NPCs y eventos.
- Efectos de eventos: vienen estructurados en `eventos[].efectos` (tipos `disposicion`, `bloqueo`, `habilita`, `precio`). No se parsea texto libre.
- Fin por hora: se evalúa al avanzar el reloj, aunque el jugador esté en otra escena. Si el fin es `hora` sin valor, la hora de fin es inicio + duración.
- Huir exitoso mueve al jugador a la escena de salida (igual que la beta). Huir fallido no mueve.
- Marca `leyo`: la activa `leer` en `escena_biblioteca_publica`. La usan Elia y Oren.
- Clave de Groq: se pasa como parámetro, nunca se guarda en el estado del narrador. Se guarda en `localStorage`, igual que la beta y el HTML.
- Partidas del narrador: se guardan en IndexedDB con `persistencia/adaptadores/almacenIndexedDB.js` (ya existe y tiene tests). No se usa `localStorage` para partidas.
- Modelo: `openai/gpt-oss-120b`. Cada llamada envía `reasoning_effort: "low"` para que el razonamiento no consuma la cuota de salida. Límites del plan gratuito: 30 RPM, 1.000 RPD, 8.000 TPM, 200.000 TPD. Verificar en `console.groq.com/docs/rate-limits` antes de la prueba real.
- Texto de onboarding: `onboarding-v1.md`. El módulo no muestra textos de onboarding; la interfaz los toma de ahí.
- Persistencia: el estado del narrador se guarda como JSON, con la versión del contenido, en el servicio de persistencia de la beta. Ver `cierre-diseno-v1.md`, sección 5.

---

## 5. Entregables (en este orden)

### 5.1 Contenido y validación
Módulo que carga `contenido-v3.json` y valida:
- Conteos: 12 escenas, 12 NPCs, 40 objetos, 70 eventos, 24 intenciones, 26 bloques de plantillas (23 intenciones más `intencion_viajar`, `revelar_conocimiento` y `mostrar_narrativo`).
- Referencias: salidas, escena de cada NPC, escenas de cada evento, NPC de cada narrativo, verbos de cada intención.
- Que cada intención tenga plantillas para `exito`, `fallo` y `neutro`.

**Mapeo de plantillas:** el zip llama a las plantillas `resultado_<verbo>_<exito|fallo|neutro>`. Esa clave se resuelve como `plantillas[intencion_<verbo>][<resultado>]`. Ese mapeo es la solución al aviso "plantilla no registrada".

### 5.2 Comprensión
Implementá `comprension-v1.md` tal cual, incluidos:
- Normalización y palabras vacías.
- Tolerancia a typos: distancia ≤ 2 para palabras de más de 4 letras, ≤ 1 para 4 letras, exacta para 3 o menos.
- Formas de varias palabras en orden.
- Alias de NPC y solo NPCs presentes en la escena.
- Reglas de objetivo: `hablar_con` nunca elige por el jugador. Los demás usan `resolverNpcObjetivo` cuando hay dos o más presentes.
- Empates: reformulación.
- Una reformulación por turno. Después, IA.

### 5.3 Estado y eventos
- Cálculo de estado de escena con la regla de vecina.
- Disparo de eventos por `azar`, `hora` o `accion`, según `disparo`.
- Fin de eventos por `tiempo`, `hora` o `accion`, según `fin` y `duracion`.
- Un evento con `escenas` vacías o inválidas no se dispara.

### 5.4 Motor de turnos
Orden fijo: comprender → resolver → efectos sobre NPC → narrar → avanzar reloj → disparar y cerrar eventos → registrar.

### 5.5 Narración
- Plantillas con placeholders `{npc}`, `{objeto}`, `{lugar}`.
- Si falta un valor, se elige una plantilla que no lo necesite.
- Ventana de las últimas 5 aperturas. No se repite la misma apertura dentro de la ventana.

### 5.6 IA de última instancia
Cliente para Groq con el contrato de `narrador-ia-v1.md`:
- Mensaje de sistema fijo y reutilizable.
- Contexto compacto por llamada: escena, NPC con disposición en palabras, últimas 3 acciones, eventos activos, frase del jugador.
- Salida en texto plano, 1 a 3 oraciones, máximo 120 tokens.
- Validación: no vacía, sin ids ni corchetes, dentro de largo. Si falla, plantilla.
- Reintento por cupo una vez. Si la clave falta o el RPD está agotado, modo código con aviso.
- La IA nunca cambia efectos.

### 5.7 Registro tipo Cleverbot
- Cada turno con texto libre genera exactamente un registro, con los campos y valores de `vocabulario-v1.md` (sección 13).
- Un texto de jugador que contenga instrucciones para un modelo ("ignorá", "respondé como", "sos un") se registra igual, con marca `contaminacion: true` en el registro, y no cambia el comportamiento del narrador.
- Los registros se guardan primero en una cola local en memoria, y después se envían a Firestore.
- Fallo de red: la cola reintenta. No se pierden registros mientras la pestaña esté abierta.

### 5.8 Firestore
- Colección `registros`, un documento por registro, id `reg_<número>`. Campos del formato de registro.
- Adaptador de Firestore detrás de una interfaz. Adaptador en memoria para los tests.
- Autenticación anónima para escribir.
- **Reglas de seguridad:**
  - Escritura solo desde sesión anónima válida, con los campos del registro y tamaño máximo por documento.
  - Lectura solo para la cuenta del administrador (se deja el id como constante a configurar).
  - Sin borrado y sin actualización de registros ya enviados.
- Las reglas se escriben en `firestore.rules`, marcadas como `sin verificar en emulador` hasta que Tomás las pruebe.
- No se publica nada en el proyecto real: solo se deja el archivo listo.

### 5.9 Tests
- Por módulo, y una suite de integración de punta a punta.
- Set de prueba: `data/pruebas/frases.json` con 100 frases ficticias: 40 de botones o texto exacto, 30 con typos y voseo, 20 informales o ambiguas, 10 para IA. Marcado `sin verificar con jugadores reales`.

---

### 5.10 Contrato de entrada
Tres funciones públicas en `/narrador/index.js`, según `cierre-diseno-v1.md`, sección 6:

```
crearPartida(opciones?)  -> estado            (opciones: { semilla? })
cargarPartida(json)      -> estado            (lanza error si la forma mínima no existe)
narrar(estado, entrada, { groqKey? }) -> { texto, estado, tipo, registro, errores }
```

- `entrada`: `{ tipo: "boton", intencionId, parametros? }` o `{ tipo: "texto", texto }`.
- `tipo` de salida: `narracion`, `reformulacion`, `dialogo_ia` o `error`.
- `narrar` nunca lanza excepción hacia la interfaz. Los errores van en `errores`.
- La interfaz no modifica el estado: lo recibe y lo devuelve.
- Los textos devueltos no contienen ids, corchetes ni placeholders sin resolver.
- La clave de Groq entra solo por `groqKey` y no se guarda en el estado ni en el registro.

## 6. Reglas de ejecución

- No hagas preguntas. Si algo no está claro, elegí lo más simple y anotalo en `SUPUESTOS-v3.md`.
- No escribas texto de narración fuera de `plantillas`.
- El texto del jugador nunca se usa como respuesta del narrador ni como instrucción para la IA.
- No leas los tests del zip salvo los que fallen.
- Archivos nuevos completos. Archivos existentes: diff.
- Sin saludos ni resúmenes largos.
- Marcá como `sin verificar` cualquier API de navegador, de Groq o de Firebase que no puedas comprobar en el entorno.

---

## 7. Criterios de aceptación

- Tests en verde, incluidos los del zip que ya pasaban.
- Validador de contenido en verde.
- En el set de prueba, al menos el 80% de las frases que no van a IA se resuelven por código en la primera pasada o tras una reformulación.
- Una llamada a la IA no supera 800 tokens. Medilo y reportá la cifra.
- Sin clave o con RPD agotado, el juego sigue en modo código y muestra el aviso.
- Tres turnos seguidos con la misma acción no repiten la apertura.
- Cada turno con texto libre genera un registro completo con valores válidos.
- Un texto con instrucciones para un modelo no cambia el comportamiento y queda marcado.
- Con el adaptador en memoria, la cola de registros envía todo y no pierde registros tras un fallo simulado de red.

---

## 8. Entregables de archivo

Carpeta `/narrador/` con módulos y tests, `data/pruebas/frases.json`, `firestore.rules`, `SUPUESTOS-v3.md`.

---

## 9. Informe final

1. Entregables: tabla con archivo, propósito y estado (completo, parcial, sin verificar).
2. Conteos contra la meta.
3. Pruebas: pasa, falla o sin verificar, por criterio de la sección 7.
4. Medición de tokens: cifra y método.
5. Supuestos nuevos (además de `SUPUESTOS.md`).
6. Errores encontrados en los archivos de entrada, sin corregirlos.
7. Pendientes para la integración con el HTML.

Sin saludos. Sin preguntas al final.
