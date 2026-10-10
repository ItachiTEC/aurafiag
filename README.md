# AURA FIAG / UNJBG · Web versión 1.0

Plataforma informativa con prioridad en el Consejo de Facultad de la FIAG y una sección complementaria de Asamblea Universitaria. Sitio construido en HTML, CSS y JavaScript sin framework ni dependencias de frontend. Backend de Azure Functions y Azure Table Storage para el buzón.

## Estado

- Sitio visual: listo para publicar en Azure Static Web Apps.
- 4 escuelas: Arquitectura, Ingeniería Civil, Ingeniería Geológica-Geotecnia y Artes.
- Propuestas: fichas en etapa «En consulta», **no son compromisos aprobados**.
- Formulario: código listo, requiere una cuenta de Azure Storage y su cadena de conexión configurada en el recurso Static Web App. Hasta entonces, aparece explícitamente «Buzón pendiente de activación» y no permite enviar.
- Panel privado: disponible con rol `administrator` de Azure Static Web Apps, después de configurar el almacenamiento y la invitación.
- Equipo y logotipo oficial: pendientes de datos y archivos confirmados.
- Aviso de privacidad: borrador que debe completarse antes de activar el buzón público.

## Abrir la web localmente

Necesitas Node.js 20 o superior:

```bash
npm run check
npm run build
npm start
```

Abre http://localhost:8000. En modo local, el buzón no guarda mensajes; la API requiere Azure Functions + Storage. Puedes revisar páginas, buscador, filtros y fichas.

## Modificar textos y propuestas

`src/assets/content.js` controla marca, objetivos, escuelas, propuestas, equipo, enlaces y recursos. Puedes actualizar los textos y desplegar nuevamente. No inventes nombres de personas, documentos, resultados ni credenciales.

Agregar logo oficial: coloca su archivo optimizado en `src/assets/` y modifica `identity.logoUrl` (ej. `/assets/logo-aura.webp`). La marca geométrica actual es provisional.

## Publicación

Lee `GUIA-AZURE.md`. Conserva el archivo workflow que Azure ya generó en tu repositorio, incluido su token de despliegue. No copies secretos al ZIP ni a GitHub.

## Estructura

```
src/                          páginas públicas, CSS y JavaScript
src/assets/content.js         textos y propuestas editables
src/assets/styles.css         estilos responsivos
src/assets/app.js             interfaz, buscador, formularios, bandeja
src/staticwebapp.config.json  seguridad y acceso por roles
api/src/functions/messages.js API de recepción y administración
api/host.json                 configuración de Functions
scripts/build.mjs             compila a dist/
GUIA-AZURE.md                 instrucciones de integración
```

## Privacidad y control

El buzón no requiere afiliación. Nombre y correo son opcionales. Las notas internas y los mensajes se consultan únicamente con rol administrador y comprobación de identidad en la API. No utilizar los datos de correo para difundir contenido masivo sin consentimiento separado. Activar protección contra abuso adicional antes de difusión amplia (ej. CAPTCHA con validación backend).

Documentación institucional de la FIAG: https://fiag.unjbg.edu.pe/

Este proyecto es de un grupo estudiantil, no un portal oficial de la UNJBG.
