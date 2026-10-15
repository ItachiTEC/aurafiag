# Guía: panel de administración AURA CMS

**Versión:** primer editor de contenidos, octubre de 2026.  
**Acceso:** `https://orange-grass-0dd34e310.4.azurestaticapps.net/admin/`.  
**Seguridad:** entra únicamente con GitHub invitado al rol exacto `administrator` de Azure Static Web Apps.

## ¿Qué puedes administrar sin programar?

| Sección del panel | Qué hace |
|---|---|
| **Entradas** | Crear comunicados, noticias y artículos. Separar párrafos con línea vacía, elegir categoría, fecha, resumen e imagen. |
| **Propuestas** | Actualizar las 18 ideas originales o crear nuevas, cambiar escuela, ámbito, acciones, estado e imagen. |
| **Equipo** | Publicar nombres, roles, biografías y fotografías verificadas; sustituye la ficha de ejemplo. |
| **Recursos** | Crear/enmendar documentos, URLs oficiales y referencias en la baraja de recursos. |
| **Identidad** | Cambiar el nombre, descripción, contactos, redes sociales y logo. |
| **Mensajes** | Abrir la bandeja privada anterior para clasificar y exportar respuestas estudiantiles. |

### 1. Requisitos de Azure

Esta versión usa la variable ya existente `AURA_STORAGE_CONNECTION_STRING`. La cuenta de Azure debe ser **StorageV2 (General Purpose v2)** y permitir **Azure Table Storage y Blob Storage**, no solamente una base de datos de tablas incompatible con Blobs.

- El formulario existente usa la tabla `AURAMensajes`.
- El gestor de contenidos crea/usa `AURAContent`.
- Las imágenes se guardan en el contenedor privado `auramedia`.
- La API sirve esas imágenes desde URLs `/api/media/…`; NO hay contenedor público.
- El secreto de Azure permanece en **Environment variables**; no lo copies en GitHub.
- Revisa los costos de almacenamiento, operaciones y tráfico en Azure for Students.

Para validar que el formulario existente sigue operativo visita `/api/status`. El CMS usa otras rutas: `GET /api/content`, `GET /api/admin/content` y `POST /api/admin/content`. Si el gestor muestra error 503, verifica la variable de entorno y las capacidades de la cuenta Storage.

### 2. Crear una noticia

1. Abre `/admin/`, inicia sesión con el rol `administrator`.
2. Elige **Entradas** → **+ Nueva publicación**.
3. Completa título, resumen, contenido en texto, fecha, categoría e imagen opcional. Para los párrafos separa bloques con una línea en blanco.
4. El identificador puede dejarse vacío: se genera a partir del título en minúsculas y guiones. **No lo cambies después de publicar** para conservar enlaces.
5. Elige **Borrador** si aún falta revisión, o **Publicado** si el texto está aprobado; pulsa **Guardar cambios**.
6. Comprueba el artículo en `/entradas/?id=identificador`. La lista pública está en `/entradas/`.

No copies HTML ni scripts en el campo de noticia. El texto se muestra como contenido escapado, lo que evita ejecutar etiquetas HTML recibidas.

### 3. Publicar o actualizar una propuesta

En **Propuestas**, selecciona una propuesta actual o elige **+ Nueva publicación**. Llena título, ámbito, escuela, área, resumen, problema, acciones (una por línea), resultado, competencia y estado. Mantén **En consulta** cuando aún no exista una gestión respaldada; **Presentada** y **Finalizada** requieren evidencia real. Utiliza el modo borrador para ocultar temporalmente una ficha, incluso si estaba originalmente en el código.

Las URLs anteriores `/propuestas/?id=…` siguen siendo compatibles. Las tarjetas principales de la portada se mantienen como colección editorial; el panel gestiona su contenido, pero no modifica automáticamente la composición de esa portada.

### 4. Fotografías y logo

Desde un campo **Imagen / Retrato / Logo** pulsa **Elegir archivo** y **Subir imagen**. Acepta JPEG, PNG y WebP de **hasta 2 MB**. El campo se rellenará con `/api/media/…`; **después pulsa Guardar cambios** para vincular el archivo al contenido.

La foto debe contar con consentimiento para publicarla. Los archivos ya subidos no se borran físicamente al retirar una noticia, por lo que periódicamente convendrá limpiar medios huérfanos mediante un proceso controlado.

### 5. Equipo, recursos e identidad

- **Equipo:** publica solo identidades, fotos y cargos confirmados. La ficha de muestra desaparecerá al haber registros reales.
- **Recursos:** conserva HTTPS en enlaces externos; el nuevo recurso aparecerá en la baraja de la página pública.
- **Identidad:** utiliza correo de atención real, enlaces de Instagram/WhatsApp con HTTPS y logotipo con fondo transparente. Esto no cambia los textos decorativos fijos de la portada ni la distribución de secciones; esos cambios siguen requiriendo código.

### 6. Borradores, publicación y retirada

- **Borrador:** registro guardado de forma privada y excluido del sitio público.
- **Publicado:** disponible al recargar la web, normalmente sin nueva publicación de GitHub.
- **Retirar de la web:** conserva una marca de ocultación en la tabla (tombstone). No borra las fotografías ya cargadas ni elimina los archivos originales de GitHub.
- Un registro de propuesta o recurso incluido inicialmente en `content.js` puede ser reemplazado o escondido mediante CMS sin editarlo allí. Para eliminar la marca de ocultación hay que guardarlo de nuevo con el mismo ID.

**No se ha implementado todavía:** historial de revisiones con aprobación de varias personas, editor visual enriquecido, control de versiones del contenido, eliminación física automática de imágenes, edición de estructura de página, fichas FIAG completas ni respuesta automática por correo.

### 7. Seguridad, privacidad y buenas prácticas

La API administrativa está protegida en dos niveles: `src/staticwebapp.config.json` exige `administrator` y las funciones validan el principal autenticado. No crees enlaces de administración públicos ni subas secretos en recursos. Evita almacenar datos personales de estudiantes dentro de propuestas o entradas. El aviso de privacidad sigue necesitando datos reales de responsable, plazo de conservación y contacto, antes de impulsar formularios masivos.

Haz primero una noticia ficticia con estado **Borrador**, después publícala, visualízala, y finalmente retírala. Si la API muestra un error, revisa los logs de Azure Functions, sin pegar cadenas de conexión en el chat.

### 8. Cómo está hecho

`src/assets/cms.js` prepara la interfaz de administración y superpone los registros publicados a los datos iniciales de `src/assets/content.js`. El contenido se consulta en `/api/content` antes de renderizar las páginas. `api/src/functions/cms.js` valida, guarda y entrega medios. El panel de mensajes anterior se conserva sin cambiar la tabla `AURAMensajes`.

### 9. Pruebas del despliegue

El workflow de GitHub Actions ejecuta `npm run check` y `npm test` antes de Azure Static Web Apps. Los tests cubren permisos de administración, borradores ocultos, publicaciones, retirada de registros, tipo de archivo y carga de imágenes con almacenamiento simulado. Estas pruebas **no verifican** la configuración real de tu cuenta de Azure; esa prueba se realiza desde `/admin/` con una cuenta invitada y un archivo de prueba.
