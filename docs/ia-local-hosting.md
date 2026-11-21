# IA local: hosting del modelo (fase 5)

- **Motor**: WebLLM, importado con `import()` dinámico desde `motor.origen` de `narrador/iaLocal/modelo-manifest.json` (jsdelivr, versión fija). A APROBAR. Sin verificar.
- **Pesos**: origen oficial en Hugging Face (`mlc-ai/<modeloId>`), los que usa WebLLM por defecto según `prebuiltAppConfig`. No se suben pesos al repo (el verificador de fase 5 falla con archivos de más de 5 MB en `narrador/`).
- **Espejo**: no por ahora (decisión R6). Si hiciera falta, GitHub Pages sirve archivos de hasta 100 MB: antes de subir, correr `node tools/verificar-modelo.mjs <carpeta> --max-mb 95`, que escribe `manifest.json` con tamaño y sha256 de cada archivo y falla si alguno se pasa. El campo `espejo` del manifest queda vacío hasta entonces.
- **Caché**: WebLLM guarda los pesos en la Cache API del navegador; la descarga ocurre una sola vez por modelo. Para que el navegador no los borre bajo presión de espacio, la página puede pedir `navigator.storage.persist()` (sin verificar; el navegador puede negarlo).
- **Verificación**: con espejo propio, comparar el sha256 de cada archivo con el `manifest.json` generado; con el origen oficial, confiar en HTTPS de Hugging Face.
- **Tamaño**: el aviso de descarga usa `tamanoMB` del manifest (provisional, aproximado). Medir el real con la herramienta y actualizar el número.
- **Cadena**: PC → principal; móvil → modelo móvil; si falla al cargar o queda bajo el umbral de tok/s → siguiente del `respaldo`; si fallan todos → plantillas (como sin IA).
- **Medición**: abrir `narrador/prueba/bench-ia.html` en cada dispositivo, apretar «Medir» y copiar el JSON (primer token, tok/s, memoria aproximada, errores). Resultados: sin verificar hasta que el autor la corra.
- **Apagado**: `?ialocal=0` la apaga; iOS y navegadores dentro de apps no la ofrecen salvo `?ialocal=forzar`. Si el navegador se cuelga cargando, la próxima visita la bloquea sola (marca `ialocal_cargando`).
