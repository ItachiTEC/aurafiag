'use strict';
// Solo ejecutar en un equipo de confianza. Nunca subir la clave privada al repositorio.
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const [,,email,role]=process.argv;
if(!process.env.GOOGLE_APPLICATION_CREDENTIALS||!email||!['administrator','editor','viewer'].includes(role)){
 console.error('Uso: GOOGLE_APPLICATION_CREDENTIALS=/ruta/privada/service-account.json node api/scripts/assign-role.cjs correo@ejemplo.com administrator');
 process.exit(1);
}
initializeApp({credential:applicationDefault(),projectId:'aura-fiag'});
(async()=>{
 const auth=getAuth(),user=await auth.getUserByEmail(email);
 if(!user.emailVerified||user.disabled)throw Error('Verifica el correo y habilita la cuenta antes de dar permisos.');
 const claims={...(user.customClaims||{}),aura_role:role};
 await auth.setCustomUserClaims(user.uid,claims);
 console.log('Rol guardado para '+email+'; el usuario debe cerrar sesión y volver a entrar.');
})().catch(error=>{console.error('No se pudo asignar el rol: '+error.message);process.exit(1);});
