# Acceso a la administración AURA (GitHub + Azure)

Acceso del equipo: https://orange-grass-0dd34e310.4.azurestaticapps.net/login/  
Panel CMS: https://orange-grass-0dd34e310.4.azurestaticapps.net/admin/  
Administración del recurso: https://portal.azure.com/

## ¿Por qué aparece «Acceso restringido»?

El error HTTP 403 corresponde a la protección de Azure Static Web Apps: la sesión ha llegado a Azure, pero el usuario no tiene el rol necesario, o Azure no puede completar sus datos de identidad. En AURA se exige explícitamente el rol `administrator`.

El nuevo acceso usa GitHub mediante Azure. AURA no almacena contraseñas de administrador y el inicio de sesión NO asigna permisos automáticamente.

## Autorizar tu cuenta con una invitación

1. Accede a https://portal.azure.com/ y abre el recurso **Static Web Apps** de AURA.
2. En el menú izquierdo ve a **Settings / Configuración → Role management / Administración de roles**.
3. Pulsa **Invite / Invitar**.
4. Selecciona el proveedor **GitHub** y escribe tu nombre de usuario exacto de GitHub. Si utilizas `ItachiTEC` para iniciar sesión, escribe `ItachiTEC`.
5. Selecciona el dominio `orange-grass-0dd34e310.4.azurestaticapps.net`, o el mismo dominio por el que abrirás la web.
6. En **Role / Rol** escribe exactamente `administrator`.
7. Elige una duración para aceptar la invitación (por ejemplo, 24 horas), y genera el vínculo.
8. Abre el enlace de invitación y acéptalo con la misma cuenta de GitHub.
9. Entra a `/login/`. Si tenías otra sesión, pulsa «Salir y cambiar de cuenta». A continuación usa «Iniciar sesión con GitHub».
10. Si Azure confirma `administrator` aparecerá el botón «Ir al administrador».

## Qué implementa este módulo

- Ruta pública `/login/`, con botón de acceso a GitHub y comprobación automática de la sesión mediante `/.auth/me`.
- La página de error `403` muestra qué permiso falta y cómo obtenerlo.
- El error `401` redirige a `/login/`.
- Enlace «Acceso equipo» en el pie de la web.
- Se mantiene `/admin*` y `/api/admin/*` protegidos con `administrator`, y el backend mantiene su validación interna.

## Diagnóstico

- «Iniciar sesión» → no hay sesión iniciada.
- «Cuenta autenticada, pero falta permiso» → genera y acepta la invitación de Azure.
- «Acceso autorizado» pero el panel sigue 403 → revisa el dominio vinculado a la invitación y cierra sesión para refrescar los roles.
- Si el login funciona pero el gestor no guarda noticias → revisa Azure Table Storage/Blob Storage: es un asunto distinto.
- No compartas ni publiques cadenas de conexión, tokens de GitHub o capturas con enlaces de invitación.

Fuentes oficiales:
- https://learn.microsoft.com/es-es/azure/static-web-apps/authentication-custom
- https://learn.microsoft.com/es-es/azure/static-web-apps/configuration
