# AURA — diagnóstico CMS y cuentas de los encargados

## Error 404 de la bandeja de administración

La captura muestra `No se pudo abrir el editor: Error 404`. Esta respuesta indica que la ruta consultada `GET /api/admin/content` no se encontró. No demuestra por sí sola que Azure Table Storage esté desconectado.

Se implementó:
- `api/src/index.js` como punto único de registro de Azure Functions v4.
- Carga de Blob Storage bajo demanda, para que una dependencia de imágenes no afecte el arranque del editor.
- `GET /api/cms-health`: ruta pública de salud del módulo CMS (sin datos sensibles).
- `GET /api/admin/cms-diagnostic`: ruta privada para verificar si la cuenta de Storage está configurada, si funcionan tablas y si Blob Storage está disponible.
- Mensajes específicos para 404 (ruta), 503 (almacenamiento), 401/403 (autorización), con opción de reintento.

### Prueba de diagnóstico tras publicar

1. Comprueba que GitHub Actions en `main` haya terminado correctamente.
2. Visita `https://orange-grass-0dd34e310.4.azurestaticapps.net/api/cms-health`. Resultado esperado: `{"ok":true,"service":"AURA CMS","apiVersion":"2","routesRegistered":true}`.
3. Con sesión administrativa, abre `https://orange-grass-0dd34e310.4.azurestaticapps.net/api/admin/cms-diagnostic`.
4. Cuando los cuatro indicadores `apiRegistered`, `storageConfigured`, `tablesReady` y `blobsReady` sean verdaderos, intenta publicar una entrada de prueba.
5. Si `tablesReady` es falso, revisa variable `AURA_STORAGE_CONNECTION_STRING`, Storage Account, Firewall y Azure Table Storage. No publiques secretos.
6. Si `blobsReady` es falso, la subida de fotografías estará pendiente; revisa Blob Storage en una cuenta General Purpose v2.
7. Si `cms-health` devuelve 404, revisa configuración de Azure Static Web Apps, registro de Functions y logs de Application Insights. GitHub en verde no certifica que la función haya iniciado.
8. Confirma que `/api/status` y la bandeja de mensajes anterior siguen funcionando.

## Cuentas para responsables de AURA sin GitHub

La necesidad es tener acceso por credenciales administradas por ti: cuenta, contraseña inicial y permisos individuales, además de revocación de acceso. No significa permitir administración anónima.

### Recomendación

Usar **Microsoft Entra External ID** con cuentas locales **correo + contraseña**, que puedes crear y administrar; al recibir una contraseña temporal, el usuario la cambia. Integrarlo a Azure Static Web Apps mediante un proveedor de identidad personalizado requiere plan **Standard** (que puede tener cargos) y una configuración del tenant, registro de aplicación y controles de permisos.

No crear contraseñas dentro de `content.js`, JavaScript público o tablas en texto claro. Tampoco modificar la ruta `/admin*` para dar acceso a cualquier usuario `authenticated`: se expondrían publicaciones y datos estudiantiles.

Modelo posterior de usuarios:
- `administrator`: asigna o revoca permisos, controla publicaciones y acceso administrativo.
- `editor`: crea y edita noticias, propuestas y recursos, sin poder gestionar permisos ni leer mensajes privados a menos que se le otorgue.
- `viewer`: consulta datos autorizados sin poder publicarlos.
- Cuentas revocables, cambios auditables, recuperación de contraseña y MFA cuando sea viable.

### Antes de integrar usuarios propios

1. Confirma el plan de tu recurso Static Web Apps: **Free** o **Standard**.
2. Comprueba que puedes crear o administrar un tenant de Microsoft Entra External ID y revisa los costos de Azure for Students.
3. Elige credenciales por correo electrónico y contraseña (recomendado para recuperar acceso) o una necesidad específica de identificador.

Se debe conservar GitHub como ruta administrativa de respaldo hasta completar y probar la migración.

Documentación Microsoft:
- https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom
- https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-manage-customer-accounts
- https://learn.microsoft.com/en-us/azure/static-web-apps/plans
