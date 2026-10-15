# Imágenes en AURA FIAG — subida y visualización

## Cómo se suben

1. Entra en **Administrador → Entradas** y abre la noticia que quieres editar.
2. En **Imagen principal**, selecciona un archivo JPEG, PNG o WebP de hasta **20 MB**.
3. Pulsa **Subir y optimizar imagen** y espera el aviso **«Imagen subida y comprobada»**.
4. La foto aparece como vista previa. Después pulsa **Guardar cambios** para asociarla con la noticia.

### ¿Por qué se optimizan?

La foto original puede pesar hasta 20 MB, pero el archivo que se publica se reduce automáticamente para mantenerse en **2 MB o menos**. AURA usa WebP cuando el navegador lo permite y adapta resolución/calidad para reducir consumo de datos, especialmente en celulares.

La compresión cambia el archivo servido, no conserva una copia original de alta resolución. Para logos o imágenes de diseño conviene guardar una copia editable aparte.

## Solución para imágenes antiguas que aparecían rotas

Las imágenes nuevas y anteriores mantienen URLs `/api/media/{uuid}.{ext}`. La API entrega ahora un **redirect temporal con firma de solo lectura** a un Blob privado; esto evita los problemas que pueden aparecer cuando Azure Static Web Apps sirve una respuesta binaria mediante Functions.

La firma SAS dura diez minutos. Cada visita a la ruta original obtiene una nueva firma, sin necesidad de modificar las noticias.

Si Blob Storage no permite crear una firma SAS con esas credenciales, la API usa una respuesta binaria como alternativa.

La carga comprueba de forma real si el enlace público se puede abrir **antes de** actualizar el campo de imagen. Si aparece un error, no pulses Guardar: recarga y vuelve a intentar la subida.

## Validación después del despliegue

- Abrir una entrada ya publicada con imagen dañada y verificar que ahora cargue.
- Subir una imagen de aproximadamente 6–10 MB; confirmar que AURA la optimiza y muestra una vista previa.
- Guardar la noticia, recargar tanto el CMS como `/entradas/?id=...`, y confirmar que la imagen continúa visible.
- Probar como visitante sin estar autenticado.
- No publicar valores de `AURA_STORAGE_CONNECTION_STRING` ni compartir la firma SAS.
- Si la imagen sigue rota, abrir la URL visible del recurso original `/api/media/...` y comprobar si recibe 302 hacia Blob o un mensaje de error; nunca copiar la firma SAS completa a un chat público.

La ruta antigua del CMS y sus permisos se mantienen sin cambios.
