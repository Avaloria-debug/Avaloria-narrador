# ONBOARDING DE LA CLAVE DEL NARRADOR — Versión 1 — Crónicas de Avaloria

Textos de la pantalla de clave. Siguen el tono y la estructura de la pantalla "Clave del Narrador" de la beta (voz de usted, frases cortas, sin tecnicismos). Se muestran en el HTML de Avaloria, en la pantalla que aparece antes de la primera partida si no hay clave guardada.

*Nota técnica: la beta guarda la clave en `localStorage`. Los documentos de Fase 7 y 8 dicen `IndexedDB`. Lo correcto es `localStorage`, que es lo que hace el HTML. El módulo del narrador tiene que usar el mismo.*

---

## 1. Pantalla de clave (primera vez)

**Título:** Clave del Narrador

**Texto principal:**
> Para despertar al Narrador necesita una clave de Groq. Es gratuita y le lleva unos minutos.
>
> 1. Entre a console.groq.com/keys.
> 2. Cree su cuenta.
> 3. Genere una API key.
> 4. Péguela acá.

**Campo:** Clave API (placeholder: `gsk_...`)

**Botón:** Confirmar

**Nota debajo del campo:**
> La clave se guarda solo en este navegador, en localStorage. El juego no tiene servidor propio, así que nadie más la ve.

**Enlace:** ← Volver

---

## 2. Qué pasa si no pone la clave

**Texto (aparece con el enlace "Seguir sin clave"):**
> Sin clave, el juego sigue. El Narrador responde con sus propias respuestas, más cortas y con menos variedad. Podrá usar la clave más adelante desde Configuración.

**Botón:** Seguir sin clave

---

## 3. Confirmación

**Texto (después de Confirmar, con clave válida):**
> Listo. El Narrador está despierto.

**Texto (si la clave no funciona):**
> No pudimos usar esa clave. Revísela y vuelva a intentarlo. Si sigue sin funcionar, puede seguir sin clave.

**Botones:** Reintentar · Seguir sin clave

---

## 4. Aviso de cuota agotada (durante la partida)

Aparece una sola vez por día, en el log del Narrador:
> Se agotó el cupo diario del Narrador. Por hoy, las respuestas siguen siendo del juego, con menos variedad. Mañana vuelve a estar disponible.

---

## 5. Reglas de este texto

- Nunca dice que la clave es secreta: dice que se guarda en este navegador. Eso es lo que el jugador tiene que entender.
- No menciona límites de tokens, RPM, TPM ni nada técnico. Solo "cupo diario".
- No culpa al jugador si la clave falla.
- Se puede quitar la clave desde la pantalla de Configuración, con el botón existente "Cambiar API key".

---

## 6. Pendientes
- Enlace de ayuda para crear la cuenta de Groq (si cambia la consola, actualizar el enlace).
- Revisión de tono de los textos por Tomás antes de publicar.
