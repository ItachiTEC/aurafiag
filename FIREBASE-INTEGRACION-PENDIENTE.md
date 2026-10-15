# AURA — preparación de Firebase Authentication (NO activada)

Fecha: 14 de octubre de 2026. Rama `feature/firebase-auth-preparacion`. La web pública **mantiene GitHub/Azure** para administrar hasta que se conecte y pruebe Firebase.

## Estado real

- Se añadió `api/src/lib/firebase-auth.js`: validación de ID tokens Firebase en el servidor, correo verificado y rol `auraRole`.
- Se añadió `firebase-admin` al paquete de API, **solo en esta rama**, y pruebas que comprueban que sin credenciales todo se deniega.
- No se han inventado claves, proyectos de Google ni cuentas.
- **No se modificaron las rutas públicas ni se abrió `/api/admin/*` al público.**

## Qué debes activar en Firebase

1. Crea o conecta un proyecto en [Firebase Console](https://console.firebase.google.com/). Si usas el conector Firebase de ChatGPT, completa la conexión y selecciona el proyecto correcto.
2. En **Authentication → Sign-in method** activa **Email/Password**. Google como proveedor sería opcional.
3. En **Authentication → Settings → Authorized domains** incluye el dominio exacto de AURA: `orange-grass-0dd34e310.4.azurestaticapps.net`, y el dominio propio cuando exista.
4. En **Project settings → General → Your apps**, registra una **Web App** y copia la configuración de cliente (`apiKey`, `authDomain`, `projectId`, `appId`). Estos identificadores son públicos y no conceden acceso administrativo por sí solos.
5. En **Service accounts → Firebase Admin SDK**, obtén las credenciales del servidor, pero **no las subas a GitHub ni las pegues en chats**. Se configuran como secretos de Azure Static Web Apps, por ejemplo mediante `FIREBASE_SERVICE_ACCOUNT_JSON`. Preferir una identidad gestionada u otro mecanismo sin claves si el entorno lo soporta.
6. Establece **un primer propietario** por un procedimiento separado, explícito y auditado. Nunca se debe asignar `owner` por el correo, nombre, dominio ni solicitud de registro del navegador.
7. El servidor deberá validar los ID tokens con Firebase Admin SDK y comprobar `auraRole`, no confiar en roles enviados por el cliente.

## Modelo de cuentas que se construirá cuando el proyecto esté conectado

- **Propietario**: da y revoca permisos; gestiona el equipo.
- **Editor**: crea y publica entradas, propuestas y recursos.
- **Consulta**: solo consulta lo permitido.
- Cada persona entra mediante **correo y contraseña individual**, con recuperación de acceso; el propietario asigna el nombre visible.
- En vez de compartir contraseñas temporales, es preferible enviar una invitación de recuperación/establecimiento de contraseña al correo del encargado.
- La migración debe tener rutas de API propias verificadas por Firebase en el backend. **No basta con cambiar el login visual**. Las rutas Azure actuales quedan protegidas hasta que el camino Firebase esté probado extremo a extremo.

## Error 404 previo de AURA

El 404 de `GET /api/admin/content` es **separado** de Firebase. Los logs de GitHub muestran que Oryx construyó la carpeta de API y subió un paquete, pero no confirman el arranque de la función.

Para obtener un diagnóstico útil, abre:

- `https://orange-grass-0dd34e310.4.azurestaticapps.net/api/cms-health`
- `https://orange-grass-0dd34e310.4.azurestaticapps.net/api/status`

El primero debería responder JSON con `ok: true`; el segundo, JSON con `ready: true` o `false`. Si `cms-health` responde 404, no servirá cambiar el método de login hasta resolver el registro de funciones o el enlace de API de Azure. Comprueba **Static Web Apps → APIs**, logs de funciones y que no exista una API externa vinculada que esté anulando la API administrada.

## Siguiente paso

Conectar Firebase al chat o aportar el **Project ID** (no es secreto) y la configuración web pública, además de confirmar quién debe ser el primer propietario. La clave privada jamás debe enviarse por conversación.

Referencias:
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://firebase.google.com/docs/auth/admin/custom-claims
- https://learn.microsoft.com/en-us/azure/static-web-apps/configuration
