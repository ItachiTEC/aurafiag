'use strict';
// Verificación para todas las operaciones privadas del CMS Firebase.
// El encabezado Authorization puede ser reescrito por Azure SWA; se usa uno propio.
let firebaseApp;
const response=(status,error)=>({status,jsonBody:{error},headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
function client(){
 // Importación diferida: los tests y las rutas públicas no necesitan Admin SDK.
 const {getApps,initializeApp}=require('firebase-admin/app');
 const {getAuth}=require('firebase-admin/auth');
 firebaseApp=firebaseApp||getApps().find(a=>a.name==='aura-private-cms')||initializeApp({projectId:'aura-fiag'},'aura-private-cms');
 return getAuth(firebaseApp);
}
async function requireFirebaseAdmin(request,context){
 const token=request.headers.get('x-aura-firebase-token')||'';
 if(!/^[^\s]{100,8192}$/.test(token))return response(401,'Sesión de Firebase requerida.');
 try{
  // checkRevoked:true también detecta cuentas deshabilitadas. Para funcionar
  // necesita ADC autorizado a Firebase Authentication en Azure. Sin él falla cerrado.
  const claims=await client().verifyIdToken(token,true);
  if(claims.email_verified!==true||claims.aura_role!=='administrator')return response(403,'Tu cuenta no tiene permisos de administración en AURA.');
  return null;
 }catch(error){
  const code=String(error?.code||'');
  if(['auth/id-token-expired','auth/id-token-revoked','auth/invalid-id-token','auth/user-disabled','auth/argument-error'].includes(code))
   return response(401,'Sesión vencida o revocada. Vuelve a iniciar sesión.');
  context.error('AURA Firebase admin authorization unavailable: '+String(error?.code||error?.name||'service'));
  return response(503,'La autorización administrativa no está configurada o disponible en Azure.');
 }
}
module.exports={requireFirebaseAdmin};
