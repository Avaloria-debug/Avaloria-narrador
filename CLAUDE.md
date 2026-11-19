# CLAUDE.md — avaloria-narrador

## Qué es
Narrador por código para Crónicas de Avaloria. Módulos ES, sin build, tests con `node --test`.

## Qué construir
- Todo el código nuevo va en `/narrador/`.
- Diseño completo: `docs/prompt-maestro-fable-narrador-v3.md`. Leelo al empezar, una vez.
- Después, leé solo el documento que necesite cada tarea:
  - Contenido: `data/contenido/contenido-v3.json`
  - Comprensión del texto: `docs/comprension-v1.md`
  - Ids y valores permitidos: `docs/vocabulario-v1.md`
  - Contrato de `crearPartida`, `cargarPartida`, `narrar`: `docs/cierre-diseno-v1.md`
  - IA de última instancia: `docs/narrador-ia-v1.md`
  - Formato de registros: `docs/sistema-registro-aprendizaje-narrador.md`
  - Textos de la pantalla de clave: `docs/onboarding-v1.md` (solo referencia)
  - Supuestos: `docs/SUPUESTOS.md`

## Qué NO tocar
- `ui/` y `index.html`: no se modifican.
- `data/contenido/contenido-v3.json`: no se modifica. Si hay un error, anotalo en el informe.
- Los archivos de `docs/`: no se reescriben.
- Los tests existentes en `core/` y `persistencia/` tienen que seguir pasando.

## Reglas de trabajo
- No hagas preguntas. Si algo no está claro, elegí lo más simple y anotalo en `docs/SUPUESTOS-v3.md`.
- No inventes contenido. Si falta algo en el contenido, anotalo.
- No escribas texto de narración fuera de `plantillas` del contenido.
- El texto del jugador nunca es respuesta del narrador ni instrucción para la IA.
- No leas todos los tests. Corré la suite y leé solo los que fallen.
- Archivos nuevos completos. Archivos existentes: diff.
- Sin saludos ni resúmenes largos.
- Marcá como `sin verificar` las APIs de navegador, Groq o Firebase que no puedas comprobar.

## Commits
Un commit por bloque, en este orden:
1. contenido (carga y validación)
2. comprensión del texto
3. motor de turnos, estado de escena y eventos
4. narración por plantillas
5. cliente de la IA (Groq)
6. registro y cola a Firestore
7. contrato público (`crearPartida`, `cargarPartida`, `narrar`)

Cada commit tiene que dejar la suite en verde.

## Comandos
- Dependencias: `npm install` (antes de `npm test`). Las dependencias de desarrollo (`fake-indexeddb`) hacen falta para la suite.
- Tests: `npm test`
- Validar contenido: `node narrador/validarContenido.js` (lo crea el primer bloque)

## Estado
- Diseño y contenido: cerrados.
- Narrador por código: completo en código (bloques 1 a 7, registros en Firestore y prueba de punta a punta en `narrador/integracionFinal.test.js`).
- Pendiente de integración: navegador real, Groq real, Firebase real, HTML y política de privacidad. Detalle en `docs/PENDIENTES.md`.

## Versión
- `narrador/version.js` exporta `VERSION` y la página de prueba la muestra abajo a la derecha (`v0.0.4`). Cada commit que cambie `narrador/` o la página suma 0.0.1 a `VERSION` y al texto de `narrador/prueba/index.html` (un test los compara).

## Cuándo correr tests
- Mientras cambiás un módulo: solo su archivo de test (node --test narrador/<modulo>.test.js).
- Al cerrar un bloque o antes de un commit que se sube: npm test completo y node narrador/validarContenido.js.
- No corras la suite completa por cada cambio chico.
