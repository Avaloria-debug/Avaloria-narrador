# Conocimientos propuestos (ronda Opus)

Un segundo conocimiento por NPC de `data/contenido/contenido-v3.json`. **No están cargados**: Tomás los aprueba uno por uno y recién ahí pasan al archivo de contenido.

Reglas que se cumplieron:
- El NPC puede saberlo por su rol y su escena inicial o de movimiento.
- No repite el hecho de su conocimiento `_1` ni contradice los `_1` de los demás.
- No nombra NPC inexistentes (no nombra a ninguno).
- Ninguna palabra clave está en otro conocimiento (`_1`, propuestos ni `conocimiento_sello_doble` de `docs/motor-caso-v1.md`), ni es alias de NPC. Van en minúsculas y sin tildes, como las actuales.

## conocimiento_maren_2

Dueño: `maren_archivista` (Archivista del Archivo Real). Escenas: escena_archivo_real.

```json
{
  "id": "conocimiento_maren_2",
  "contenido": "El Archivo Real cambió hace un mes la cerradura de la sala de mapas, y solo dos llaves abren la nueva.",
  "umbralRelacion": 30,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "cerradura",
    "cerraduras",
    "llave",
    "llaves"
  ]
}
```

- Aprobado: [ ]

## conocimiento_serel_2

Dueño: `serel_panadero` (Panadero). Escenas: escena_mercado_circular.

```json
{
  "id": "conocimiento_serel_2",
  "contenido": "Los hornos comunales del mercado se encienden antes del alba y quedan sin cuidar la primera hora.",
  "umbralRelacion": 25,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "horno",
    "hornos",
    "alba"
  ]
}
```

- Aprobado: [ ]

## conocimiento_ivor_2

Dueño: `ivor_cambista` (Cambista y prestamista). Escenas: escena_plaza_cambistas.

```json
{
  "id": "conocimiento_ivor_2",
  "contenido": "La Casa Aster entrega fichas propias en los préstamos chicos, y esas fichas solo se cambian en su mesa de la plaza.",
  "umbralRelacion": 40,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "ficha",
    "fichas",
    "empeno"
  ]
}
```

- Aprobado: [ ]

## conocimiento_naela_2

Dueño: `naela_tabernera` (Tabernera de turno nocturno). Escenas: escena_taberna_lareth.

```json
{
  "id": "conocimiento_naela_2",
  "contenido": "Los guardias que salen del turno de noche pasan por la taberna de madrugada, y alguno se va de la lengua.",
  "umbralRelacion": 30,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "turno",
    "madrugada",
    "parroquianos"
  ]
}
```

- Aprobado: [ ]

## conocimiento_tiren_2

Dueño: `tiren_docente` (Docente de cartografía). Escenas: escena_aula_cartografia.

```json
{
  "id": "conocimiento_tiren_2",
  "contenido": "Los mapas del aula marcan un vado del río que la crecida deja al descubierto unos pocos días al año.",
  "umbralRelacion": 35,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "vado",
    "rio",
    "crecida"
  ]
}
```

- Aprobado: [ ]

## conocimiento_elia_2

Dueño: `elia_bibliotecaria` (Bibliotecaria pública). Escenas: escena_biblioteca_publica.

```json
{
  "id": "conocimiento_elia_2",
  "contenido": "Al registro de préstamos de la biblioteca le arrancaron las páginas del último invierno.",
  "umbralRelacion": 40,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "registro",
    "paginas",
    "invierno"
  ]
}
```

- Aprobado: [ ]

## conocimiento_brenn_2

Dueño: `brenn_arriero` (Arriero de caravanas). Escenas: escena_camino_norte, escena_camino_sur.

```json
{
  "id": "conocimiento_brenn_2",
  "contenido": "Los ladrones del camino del sur se esconden en un molino en ruinas cerca de la bajada.",
  "umbralRelacion": 40,
  "requiereEvento": "evento_ladrones_sur",
  "requiereMarca": null,
  "palabrasClave": [
    "molino",
    "ruinas",
    "bajada"
  ]
}
```

- Aprobado: [ ]

## conocimiento_ysolde_2

Dueño: `ysolde_pescadora` (Pescadora del lago). Escenas: escena_lago_espejos, escena_camino_norte.

```json
{
  "id": "conocimiento_ysolde_2",
  "contenido": "En las noches de niebla alguien cruza el lago en un bote sin farol hacia la orilla del camino.",
  "umbralRelacion": 35,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "niebla",
    "bote",
    "farol"
  ]
}
```

- Aprobado: [ ]

## conocimiento_dario_2

Dueño: `dario_guardia` (Guardia de aduana). Escenas: escena_puente_aduana.

```json
{
  "id": "conocimiento_dario_2",
  "contenido": "En el cambio de guardia del puente la barrera queda sin nadie unos minutos.",
  "umbralRelacion": 40,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "barrera",
    "relevo",
    "garita"
  ]
}
```

- Aprobado: [ ]

## conocimiento_sarin_2

Dueño: `sarin_mensajera` (Mensajera de la Casa Aster). Escenas: escena_camino_este, escena_camino_norte, escena_camino_sur.

```json
{
  "id": "conocimiento_sarin_2",
  "contenido": "La Casa Aster pide una consigna distinta cada vez que recibe un mensaje en mano.",
  "umbralRelacion": 45,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "consigna",
    "contrasena",
    "santo"
  ]
}
```

- Aprobado: [ ]

## conocimiento_hollis_2

Dueño: `hollis_pastor` (Pastor de ovejas). Escenas: escena_camino_sur, escena_cruce_colinas.

```json
{
  "id": "conocimiento_hollis_2",
  "contenido": "Cuando el rebaño pasa la noche en el cruce bajan lobos de las colinas, y los pastores prenden fogatas para alejarlos.",
  "umbralRelacion": 25,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "lobos",
    "rebano",
    "fogatas"
  ]
}
```

- Aprobado: [ ]

## conocimiento_oren_2

Dueño: `oren_peregrino` (Peregrino hacia el Gran Roble). Escenas: escena_cruce_colinas.

```json
{
  "id": "conocimiento_oren_2",
  "contenido": "Los peregrinos dejan ofrendas al pie del Gran Roble, y alguien se las lleva antes del amanecer.",
  "umbralRelacion": 25,
  "requiereEvento": null,
  "requiereMarca": null,
  "palabrasClave": [
    "ofrenda",
    "ofrendas",
    "amanecer"
  ]
}
```

- Aprobado: [ ]

