# GUÍA DE PUBLICACIÓN AURA FIAG EN AZURE

## 1. Archivos dentro del repositorio GitHub existente

Repositorio: `https://github.com/ItachiTEC/aurafiag`

Dirección actual: `https://orange-grass-0dd34e310.4.azurestaticapps.net/`

Descarga y descomprime el ZIP. Sustituye el contenido de tu repositorio por las carpetas `src`, `api`, `scripts` y los archivos `package.json`, `.gitignore`, `README.md`, `GUIA-AZURE.md`. **Conserva la carpeta `.github/workflows` existente.** No crees otro recurso Azure Static Web Apps ni una cuenta GitHub nueva.

La carpeta `src` nueva sustituye la plantilla `Vanilla JavaScript App`. Si queda contenido viejo bajo `src`, elimínalo antes de incorporar los archivos nuevos. Evita tocar los secretos o tokens.

## 2. Editar el workflow que ya creó Azure

En GitHub abre `.github/workflows/azure-static-web-apps-orange-grass-0dd34e310.yml`. Dentro del paso `Azure/static-web-apps-deploy@v1` localiza `with:` y deja estos valores:

```yaml
app_location: "/"
api_location: "api"
output_location: "dist"
```

No elimines el resto de líneas, condiciones ni `azure_static_web_apps_api_token`. El workflow usa `npm run build` y publica `dist/`; detecta el backend en `api/`.

Confirma el cambio. Abre la pestaña **Actions**, espera el resultado del último workflow y visita tu enlace Azure. Si aparece una X roja, abre el paso `Build and Deploy` y copia el error exacto.

## 3. Activar el buzón real (servicio con posible costo)

El frontend se publica incluso sin almacenamiento, pero el botón Enviar permanece inactivo para evitar fingir una recepción.

1. En Azure Portal, crea una **Storage account** compatible con Table Storage, dentro de tu suscripción permitida. Comprueba precios y condiciones de Azure for Students antes de crear recursos.
2. En Storage account > **Access keys**, copia la cadena de conexión de la cuenta. No la compartas ni subas a GitHub.
3. En tu recurso **Static Web Apps** > **Environment variables** (o **Configuration > Application settings**, según interfaz), agrega exactamente:

   - **Name:** `AURA_STORAGE_CONNECTION_STRING`
   - **Value:** cadena de conexión de la cuenta Storage

4. Guarda la configuración. Vuelve a desplegar si es necesario y prueba `/api/status`: debe contestar `{"ready":true}`.
5. Abre `/participa/`, completa un formulario de prueba y comprueba que entrega un código de referencia. El backend crea automáticamente una tabla privada llamada `AURAMensajes` al primer envío.

Para mayor protección, usa un acceso restrictivo a Storage, rota sus claves de forma periódica y añade una protección CAPTCHA validada en servidor antes de difundir el formulario a gran escala. La cuenta de Storage no está incluida en el plan Free de Static Web Apps.

## 4. Habilitar la bandeja privada

1. En el recurso Static Web Apps busca **Role management** / **Administración de roles**.
2. Envía una invitación al usuario del equipo autorizado con proveedor **GitHub** y rol exacto `administrator`.
3. Acepta la invitación con el usuario GitHub correspondiente.
4. Abre `https://orange-grass-0dd34e310.4.azurestaticapps.net/admin/`.
5. Se solicitará acceso con GitHub. En la bandeja podrás revisar, cambiar estados, agregar notas internas, exportar CSV y eliminar mensajes.

La protección está configurada tanto en la ruta `/admin*` como en `/api/admin/*`, y las funciones vuelven a comprobar el rol antes de devolver datos privados. No uses el rol `authenticated` como alternativa, porque abriría acceso a cualquier usuario conectado.

## 5. Completar antes de la difusión pública

- En `src/assets/content.js`: nombre completo del equipo, biografías, fotos autorizadas, logo oficial, correo público y redes verificadas.
- Validar cada propuesta y sus atribuciones. Las actuales están expresamente marcadas como temas «En consulta».
- En `/privacidad/`: identificar responsable del tratamiento, contacto, plazo de conservación, seguridad, procedimiento de eliminación y ejercicio de derechos. Solicita revisión adecuada para cumplir normativa peruana de datos personales.
- Configurar protección adicional contra spam, pruebas desde celulares, enlace oficial y revisión de accesibilidad.
- Si no se autoriza usar Azure for Students para esta iniciativa, publica desde una suscripción permitida.

## 6. Dominio propio (opcional)

El dominio `azurestaticapps.net` seguirá funcionando. Para usar un dominio comprado, entra a Azure Static Web Apps > **Custom domains**, añade el dominio y crea los registros DNS solicitados por Azure. No registres un dominio sin revisar precio y disponibilidad.

## 7. Comprobar funcionamiento

- Inicio y navegación a las 4 escuelas.
- `Propuestas`: cambiar filtros, buscar, abrir y comentar una ficha.
- `Participa`: verificar el estado del buzón y enviar un registro de prueba cuando Azure Storage esté activado.
- `Admin`: iniciar con usuario autorizado y revisar el mensaje de prueba.
- Abrir en pantalla móvil; comprobar que el menú y los formularios respondan.

Documentación Microsoft:
- https://learn.microsoft.com/es-es/azure/static-web-apps/build-configuration
- https://learn.microsoft.com/es-es/azure/static-web-apps/configuration
- https://learn.microsoft.com/en-us/azure/static-web-apps/add-api
