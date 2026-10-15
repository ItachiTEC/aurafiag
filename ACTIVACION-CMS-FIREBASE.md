# AURA — activación segura del administrador Firebase

Estado: **rama de prueba** `feature/firebase-auth-staging` / PR #7. No fusionar sin verificar APIs privadas y Storage.

## Lo que ya funciona

La cuenta de prueba pudo iniciar sesión, verificar correo y recibir en `/api/firebase-auth-check` el rol `administrator`. El CMS en producción (GitHub/Azure SWA) permanece independiente.

El panel en `/firebase-admin/` reutiliza el gestor de entradas, propuestas, equipo, recursos, identidad, subida de imágenes y bandeja de mensajes. Ningún dato privado se incorpora al HTML inicial.

### Seguridad de las rutas

- Las rutas antiguas `/admin/` y `/api/admin/*` siguen restringidas por el rol `administrator` de Azure Static Web Apps.
- Las nuevas rutas `/api/firebase-admin/*` son verificadas en **CADA** petición por `api/src/firebase-gate.js`.
- Requisitos: token Firebase firmado y válido, correo verificado, claim `aura_role=administrator` y **revocación/inhabilitación comprobada en Firebase** con `verifyIdToken(token,true)`.
- Token ausente/expirado/revocado: 401; rol no válido: 403; credenciales Admin SDK no disponibles: 503 **sin acceso a datos**.
- La vista `/firebase-admin/` puede ser pública como HTML; la API privada no lo es. No confiar en esconder botones para autorizar.
- Los `viewer` y `editor` quedan bloqueados de todas las operaciones privadas hasta implementar un mapa de permisos por recurso y pruebas. El único acceso Firebase a este CMS es `administrator`.

## Paso necesario: credenciales del Admin SDK en Azure

El verificador de revocación (`verifyIdToken(token,true)`) **necesita credenciales de servicio**, no solo el `firebaseConfig` web ni un ID token de usuario.

### Opción inicial

1. En la consola Firebase del proyecto `aura-fiag`, ve a **Project settings → Service accounts**.
2. Genera la clave de una cuenta de servicio autorizada solo cuando sea necesario. Esta es una credencial muy sensible; idealmente utiliza una identidad de carga de trabajo administrada, sin claves descargables, cuando la infraestructura lo permita.
3. En el **Azure Portal → Static Web Apps → AURA → Configuration → Application settings** añade el secreto `AURA_FIREBASE_SERVICE_ACCOUNT_JSON` con el contenido JSON completo. Azure debe almacenarlo como setting privado; **no en el repositorio, variables del frontend, mensajes de chat, logs ni capturas**.
4. Confirma que `project_id` del JSON es exactamente `aura-fiag`. Si se usa otro proyecto, el backend falla cerrado.
5. Reinicia/actualiza la aplicación según corresponda. Considera rotar/eliminar la clave si alguna vez se filtró.
6. Verifica también que `AURA_STORAGE_CONNECTION_STRING` está configurado en Azure para acceder a Table y Blob Storage. Este secreto es independiente.

La API pública de diagnóstico `GET /api/firebase-auth-check` valida firmas y roles, pero **no prueba** que estén listas las credenciales administrativas para verificar revocaciones. El panel privado sí prueba esa parte.

### Cómo probar la vista previa

1. Abre [login de Firebase](https://orange-grass-0dd34e310-7.centralus.4.azurestaticapps.net/firebase-login/).
2. Entra con la cuenta de administradora verificada, que tenga el claim `administrator`.
3. Aparecerá el botón **Entrar al panel AURA**. Abre `/firebase-admin/`.
4. Si aparece un **503** desde `/api/firebase-admin/content`, comprueba en Azure **primero** `AURA_FIREBASE_SERVICE_ACCOUNT_JSON` y **después** `AURA_STORAGE_CONNECTION_STRING`. No desactives el control para “arreglar” ese error.
5. Prueba lectura de contenido, crea un **borrador de prueba** (no lo publiques), súbele una imagen pequeña si Blob Storage funciona, revisa mensajes y retira el borrador.
6. Repite las solicitudes sin token, con un usuario sin claim y con un token revocado. Deben denegarse.

**No fusionar a la rama pública hasta haber completado las pruebas reales**, incluso aunque GitHub Actions muestre success. El pipeline valida tests unitarios y empaquetado, no la disponibilidad real de las credenciales Azure ni el estado de Storage.
