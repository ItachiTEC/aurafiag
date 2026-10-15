'use strict';
// Punto único y explícito de arranque de Azure Functions v4.
// Si falla alguna dependencia, el despliegue debe detectarlo en vez de dejar rutas silenciosamente ausentes.
require('./functions/messages.js');
require('./functions/cms.js');

require('./functions/firebase-auth.js');
