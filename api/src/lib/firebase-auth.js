'use strict';
/**
 * Firebase Authentication bridge for AURA (not enabled in production).
 * All privileged authorization must happen on the server using verified ID tokens.
 * Never treat a client-provided role, email or user id as proof of authorization.
 */
let appInstance;
function firebaseConfigured(){
 return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}
function firebaseAuth(){
 if(!firebaseConfigured())throw new Error('Firebase not configured');
 if(!appInstance){
  const {initializeApp,cert,getApps}=require('firebase-admin/app');
  let credential;
  try{
   credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
   if(!credential.project_id||!credential.client_email||!credential.private_key)throw Error('Incomplete Firebase credential');
  }catch(e){throw Error('Invalid Firebase service account configuration');}
  appInstance=getApps().find(a=>a.name==='aura-backend')||initializeApp({credential:cert(credential)},'aura-backend');
 }
 const {getAuth}=require('firebase-admin/auth');
 return getAuth(appInstance);
}
async function verifyFirebaseRequest(req,allowedRoles=['owner','editor','viewer']){
 if(!firebaseConfigured())return {ok:false,status:503,error:'Firebase todavía no está configurado.'};
 const header=req.headers.get('authorization')||'';
 const match=/^Bearer ([A-Za-z0-9._-]+)$/.exec(header);
 if(!match)return {ok:false,status:401,error:'Necesitas iniciar sesión.'};
 try{
  const auth=firebaseAuth();
  const token=await auth.verifyIdToken(match[1],true);
  if(!token.email_verified||!token.email)return {ok:false,status:403,error:'Verifica tu correo antes de ingresar.'};
  const role=typeof token.auraRole==='string'?token.auraRole:'';
  if(!allowedRoles.includes(role))return {ok:false,status:403,error:'No tienes permiso para esta acción.'};
  return {ok:true,uid:token.uid,email:token.email,role};
 }catch{return {ok:false,status:401,error:'Sesión inválida o vencida.'};}
}
module.exports={firebaseAuth,firebaseConfigured,verifyFirebaseRequest};
