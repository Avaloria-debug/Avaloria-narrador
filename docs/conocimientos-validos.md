# Conocimientos válidos

Fuente: `data/contenido/contenido-v3.json` (v3.1). Un conocimiento tiene un único NPC dueño; la escena es la inicial del dueño (`escenaInicialId`). Los NPC con `movimiento` cambian de escena.

| Conocimiento | Dueño (NPC) | Escena donde da la pista | Umbral de relación | Condiciones |
|---|---|---|---|---|
| `conocimiento_maren_1` | `maren_archivista` | `escena_archivo_real` (Archivo Real) | 40 | — |
| `conocimiento_serel_1` | `serel_panadero` | `escena_mercado_circular` (Mercado Circular) | 30 | — |
| `conocimiento_ivor_1` | `ivor_cambista` | `escena_plaza_cambistas` (Plaza de los Cambistas) | 50 | evento: evento_deuda_impaga |
| `conocimiento_naela_1` | `naela_tabernera` | `escena_taberna_lareth` (Taberna de la Campana Tardía) | 30 | — |
| `conocimiento_tiren_1` | `tiren_docente` | `escena_aula_cartografia` (Aula de cartografía) | 40 | — |
| `conocimiento_elia_1` | `elia_bibliotecaria` | `escena_biblioteca_publica` (Biblioteca pública de Halenor) | 50 | marca: leyo |
| `conocimiento_brenn_1` | `brenn_arriero` | `escena_camino_norte` (Camino del norte) (se mueve: alternancia) | 35 | — |
| `conocimiento_ysolde_1` | `ysolde_pescadora` | `escena_lago_espejos` (Lago de espejos) | 40 | — |
| `conocimiento_dario_1` | `dario_guardia` | `escena_puente_aduana` (Puente de la aduana) | 45 | evento: evento_disputa_aduana |
| `conocimiento_sarin_1` | `sarin_mensajera` | `escena_camino_este` (Camino del este) (se mueve: rotacion) | 35 | — |
| `conocimiento_sendero_sin_vigilancia` | `hollis_pastor` | `escena_camino_sur` (Camino del sur) | 30 | evento: evento_tormenta_verano |
| `conocimiento_oren_1` | `oren_peregrino` | `escena_cruce_colinas` (Cruce de colinas) | 30 | marca: leyo |
