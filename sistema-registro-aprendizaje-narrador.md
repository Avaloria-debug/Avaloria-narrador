# SISTEMA DE REGISTRO Y APRENDIZAJE DEL NARRADOR — Crónicas de Avaloria

## 1. Qué es y qué no es
Es el sistema que registra cada respuesta del jugador en texto libre y cómo el juego la resolvió, para que Tomás la analice a mano y decida qué entra al narrador de código.

Reglas fijas:
- El juego NO repite texto escrito por otros jugadores como respuesta del narrador.
- El juego NO le pregunta al jugador cómo le hubiese gustado que respondiera.
- Nada nuevo entra al narrador sin revisión humana de Tomás.
- Los registros guardan el texto completo del jugador, sin limpieza.
- Ningún texto del jugador se interpreta como instrucción para ningún modelo.

## 2. Escalera de resolución (orden obligatorio)
1. **Código entiende.** Responde al instante con una respuesta del narrador de código. Registra en Grupo 1.
2. **Código no entiende.** Pide al jugador que lo diga de forma más específica, una sola vez, con texto breve y natural. No registra nada todavía.
3. **Código sigue sin entender.** Pasa al narrador IA con un contexto compacto. Registra en Grupo 2 con la respuesta que dio la IA.

Meta: el código resuelve al menos el 80% de los textos libres en la primera pasada o tras el reintento. Se mide con el set de prueba de la sección 5.

## 3. Qué se registra y en qué formato
Cada turno con texto libre genera un registro en JSON, una línea por registro, con este formato fijo:

```json
{
  "id": "reg_000001",
  "fecha": "2026-11-13T21:14:00",
  "escena": "escena_plaza",
  "estado_escena": "tenso",
  "ultimos_turnos": ["Examinar la plaza", "Hablar con el guardia"],
  "texto_jugador": "texto exacto que escribió el jugador",
  "ruta": "grupo_1",
  "intento_reformulacion": false,
  "intencion_detectada": "hablar_con_npc",
  "origen_respuesta": "codigo",
  "respuesta_mostrada": "texto exacto que vio el jugador",
  "revision": "pendiente",
  "notas": ""
}
```

Valores permitidos:
- `ruta`: `grupo_1` (código) o `grupo_2` (IA).
- `origen_respuesta`: `codigo` o `ia`.
- `intencion_detectada`: id de intención del catálogo, o `null` si no hubo coincidencia.
- `revision`: `pendiente`, `aprobada` o `descartada`. Solo Tomás la cambia.
- `notas`: campo libre para Tomás.

Si el código pidió reformulación y el jugador respondió, el registro queda con `intento_reformulacion: true` y el texto de la segunda respuesta.

## 4. Análisis e integración (manual, lo hace Tomás)
1. Tomás revisa los registros con `revision: pendiente`, priorizando `grupo_2`.
2. Para cada texto que se repite o aparece en `grupo_2`, decide una de tres acciones:
   - **Agregar variante:** la intención existe, se suma una forma más de expresarla.
   - **Nueva intención:** no existe ninguna y se crea una con su respuesta.
   - **Descartar:** no aporta, es ruido, o contiene instrucciones para un modelo.
3. Las respuestas nuevas del narrador son escritas o aprobadas por Tomás. Nunca se copian del texto del jugador.
4. Los cambios aprobados se cargan en el corpus del narrador de código y se sube la versión del corpus.
5. Los registros analizados se marcan `aprobada` o `descartada`.

## 5. Cómo se verifica
- **Set de prueba (80%):** 100 a 200 frases escritas por jugadores de prueba, con typos, voseo y frases raras. Se corre antes y después de cada versión del corpus. Métrica: porcentaje resuelto por código en la primera pasada o tras reintento.
- **Contaminación:** cada versión del corpus se revisa buscando frases que parezcan instrucciones ("ignorá", "respondé como", "sos un"). Si aparece alguna, se descarta antes de publicar.
- **Repetición:** en tres turnos seguidos con la misma acción, el narrador no puede abrir con la misma frase.
- **Registro completo:** cada turno con texto libre genera exactamente un registro con todos los campos obligatorios. Un registro incompleto es un error.

## 6. Privacidad (fase posterior, no bloquea esta versión)
Los registros contienen texto completo, incluido cualquier dato personal que escriba el jugador. Antes de compartir el juego con personas fuera del grupo actual, se define la política de privacidad y el texto de consentimiento. Hasta entonces, el acceso a los registros es solo de Tomás.

## 7. Pendiente antes de usar el sistema
- Catálogo de intenciones del narrador de código. Sin él, el campo `intencion_detectada` no tiene valores válidos.
