# CIERRE DE DISEÑO — Versión 1 — Crónicas de Avaloria

Cierra los seis faltantes de diseño del narrador por código. Las plantillas nuevas y las reglas están en `contenido-v3.json`. Este archivo explica las decisiones.

---

## 1. Plantillas de viajar

Placeholder: `{lugar}` = escena destino.

- **Éxito:**
  - "Tomás el camino y llegás a {lugar} sin contratiempos."
  - "Caminás hasta {lugar}. El viaje fue largo, pero llegaste."
- **Fallo:**
  - "Intentás salir, pero el camino está cortado. No llegás a {lugar}."
  - "No podés seguir hacia {lugar} por ahora."
- **Neutro:**
  - "Te ponés en camino hacia {lugar}."

El viaje descuenta horas del reloj (`reglas.viajeHorasPorCamino`). Si el jugador se detiene en un camino, esa escena se narra como cualquier otra. Un evento de bloqueo produce fallo.

---

## 2. Conocimientos y narrativos

Cuando un NPC revela un conocimiento, o cuando el jugador le muestra un narrativo, se usa una plantilla nueva con el placeholder `{conocimiento}` (el texto del conocimiento tal cual está en `npcs.json`).

- **Revelar conocimiento (éxito):**
  - "{npc} baja la voz y te cuenta: {conocimiento}."
  - "Después de un rato, {npc} te dice: {conocimiento}."
- **Mostrar narrativo (éxito, por el verbo usar):**
  - "Le mostrás {objeto} a {npc}. Lo mira con atención y empieza a hablar."
- **Mostrar narrativo sin conocimiento (fallo):**
  - "Le mostrás {objeto} a {npc}, pero no le dice nada que no sepa."

Regla: un conocimiento se revela una sola vez por NPC. Después, el mismo pedido responde con la plantilla de fallo.

---

## 3. Economía

- **Trabajar:** gana entre 20 y 60 bronce, al azar. No necesita NPC.
- **Comprar:** descuenta el precio del objeto. Si no alcanza, falla.
- **Sin deudas:** el dinero nunca queda en negativo. Si una compra falla, no se descuenta nada.
- **Dinero visible:** el jugador ve su dinero en monedas (bronce, plata), nunca en números de otra clase.

---

## 4. Combate y heridas

- En la versión 1, el combate **no hiere al jugador**. Afecta solo a los NPCs (relación y disposición) y a los eventos.
- Huir, rendirse o perder un combate no tiene costo de salud. Sí puede tener costo de tiempo (el evento sigue) o de relación.
- Esto coincide con la pantalla de la beta ("Se siente bien, sin heridas").

*Supuesto: en una versión futura se puede agregar salud. No se diseña ahora.*

---

## 5. Persistencia de la partida del narrador

El estado se guarda como un JSON, con esta forma:

```
{
  "version": "v1",
  "versionContenido": "v3",
  "jugador": { "nombre": "...", "escenaId": "escena_mercado_circular", "bronce": 0, "plata": 0 },
  "reloj": { "dia": 1, "hora": "08:00" },
  "npcs": { "<npcId>": { "relacion": 0, "disposicion": 0, "bloqueadoConocimientos": false, "conocimientosRevelados": [] } },
  "eventosActivos": [ { "id": "<eventoId>", "escenaId": "<escenaId>", "turnosRestantes": 0, "horaFin": null } ],
  "inventario": [ { "objetoId": "<objetoId>", "usosRestantes": 0 } ],
  "marcas": ["leyo"]
}
```

- **Dónde se guarda:** en el mismo servicio de persistencia de la beta (`servicioPersistencia`). Al guardar, se guarda también la versión del contenido.
- **Carga:** si la versión del contenido guardado no coincide con la actual, se reconstruye lo que se pueda y se marca un aviso en el log. No se borra la partida.
- **Campo de dinero:** se guardan monedas por separado, sin conversión.

---

## 6. Contrato de entrada (lo que llama la interfaz)

Tres funciones públicas, en `/narrador/index.js`:

```
crearPartida(opciones?)  -> estado
  opciones: { semilla? }   // semilla opcional para tests
  devuelve: estado inicial (escena, dinero aleatorio, reloj 08:00)

cargarPartida(json)  -> estado
  devuelve: estado restaurado, o lanza error si el JSON no tiene la forma mínima

narrar(estado, entrada)  -> { texto, estado, tipo, registro, errores }
  entrada (botón):  { tipo: "boton", intencionId, parametros? }
  entrada (texto):  { tipo: "texto", texto }
  tipo: "narracion" | "reformulacion" | "dialogo_ia" | "error"
  texto: lo que se muestra al jugador (siempre texto plano)
  estado: el estado nuevo (la interfaz lo guarda)
  registro: el registro del turno, o null si no hubo texto libre
  errores: lista de avisos para el log de la interfaz (nunca se muestran al jugador)
```

**Reglas del contrato:**
- `narrar` nunca lanza excepción hacia la interfaz. Los errores van en `errores` y se devuelve una respuesta válida.
- La interfaz no toca el estado internamente: solo lo pasa de vuelta.
- Los textos que se devuelven no contienen ids, corchetes ni placeholders sin resolver.

---

## 7. Pendientes que no son de diseño
- Código de Fable.
- Medición de tokens con Groq real.
- Revisión del tono de las plantillas (la aprobás vos).
- Set de prueba con testers reales.
