# AURA FIAG — Firebase Authentication (fase de integración segura)

**Proyecto:** `aura-fiag` · **Aplicación:** registrada con configuración web pública.  
**Estado:** entorno de prueba. **No reemplaza aún el administrador GitHub de producción.**

## Antes de probar el acceso

1. En [Firebase Console](https://console.firebase.google.com/project/aura-fiag/authentication/providers) abre **Authentication → Sign-in method** y activa **Correo electrónico/contraseña**.
2. En **Authentication → Settings → Authorized domains**, agrega el hostname de AURA: `orange-grass-0dd34e310.4.azurestaticapps.net`. Agrega también el dominio de vista previa de Azure si pruebas desde un Pull Request; no agregues dominios que no controlas.
3. En **Authentication → Users**, agrega manualmente una cuenta de prueba usando un correo que controles. **No uses contraseñas comunes ni compartidas.**
4. Antes de habilitar cuentas, verifica el origen del error 404 de Azure Functions en `/api/status`, `/api/cms-health` y la sección APIs / Application Insights del recurso. Este problema es independiente de Firebase.

## Alcance de la implementación de esta rama

- `src/assets/firebase-config.js`: configuración pública de Firebase.
- `src/firebase-login/`: acceso experimental por correo y contraseña; recuperación de contraseña y verificación por email, sin registro público.
- `api/src/functions/firebase-auth.js`: `GET /api/firebase-auth-check`, que **verifica el ID token en el servidor** y devuelve únicamente si existe un claim `aura_role` entre `administrator`, `editor` o `viewer`.
- La API **no devuelve datos privados**, no entrega acceso al CMS y no acepta contraseñas.
- Login actual de GitHub y rutas `/admin/`, `/api/admin/*` se mantienen intactos.
- Pruebas automatizadas de token ausente/inválido, email no verificado y roles.

## Activar tu primer administrador (fase posterior)

Firebase Authentication distingue autenticación de autorización. Un usuario recién creado en Firebase **no tiene poderes administrativos**.

Para otorgar un rol se necesita acceso de confianza a Firebase Admin SDK. Se incluye un script de operación manual en `api/scripts/assign-role.cjs`. Solo debe ejecutarlo el propietario en un equipo de confianza, con una cuenta de servicio obtenida en Firebase Console → Configuración del proyecto → Cuentas de servicio y almacenada **fuera** del repositorio. Nunca subas el JSON de la clave a GitHub ni lo compartas por chat.

En un entorno donde `firebase-admin` esté instalado y `GOOGLE_APPLICATION_CREDENTIALS` apunte a ese archivo privado, ejecuta:

```sh
node api/scripts/assign-role.cjs cuenta@ejemplo.com administrator
```

El correo debe estar previamente verificado. El usuario tiene que volver a iniciar sesión para renovar su token. Para administrar usuarios desde AURA sin usar Firebase Console, se requerirá añadir endpoints exclusivos para administradores, verificaciones de tokens revocados, permisos por acción y auditoría de cambios.

## Lo que falta antes de activar el CMS con Firebase

1. Resolver y **comprobar realmente** el 404 de Azure Functions. Sin API operativa no se puede administrar contenido.
2. Configurar el acceso seguro de Firebase Admin en Azure (idealmente secretos gestionados, no claves en GitHub).
3. Verificar tokens y revocaciones en **cada** operación privada (publicar, borrar, subir archivos, gestionar mensajes y usuarios), no solo en el navegador.
4. Crear rutas específicas de administración Firebase; las rutas actuales `/admin*` y `/api/admin/*` continúan exigiendo rol `administrator` de Azure.
5. Verificar planes y cuotas, políticas de contraseñas y recuperación, pruebas de permisos `viewer/editor/administrator`.
6. Realizar despliegue de revisión y prueba con datos ficticios antes de fusionar a `main`.

**No cambies los allowedRoles de Azure ni pongas el panel actual como anónimo para hacer funcionar Firebase.**
