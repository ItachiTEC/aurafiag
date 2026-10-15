'use strict';
// Identidad verificable con Firebase; no concede acceso al CMS.
const {app}=require('@azure/functions');
const PROJECT_ID='aura-fiag';
const ROLES=new Set(['administrator','editor','viewer']);
const response=(status,data)=>({status,jsonBody:data,headers:{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'}});
let firebaseApp;
function verifier(){
 const {getApps,initializeApp}=require('firebase-admin/app');
 const {getAuth}=require('firebase-admin/auth');
 firebaseApp=firebaseApp||getApps().find(x=>x.name==='aura-firebase-check')||initializeApp({projectId:PROJECT_ID},'aura-firebase-check');
 return getAuth(firebaseApp);
}
app.http('firebaseAuthCheck',{route:'firebase-auth-check',methods:['GET'],authLevel:'anonymous',handler:async(req,context)=>{
 // SWA can replace the Authorization header with its own platform token.
 // Only a distinct application header can carry the Firebase ID token reliably.
 const token=req.headers.get('x-aura-firebase-token')||'';
 if(!/^[^\s]{100,8192}$/.test(token))return response(401,{authenticated:false,authorized:false,reason:'firebase-token-missing'});
 try{
  const claims=await verifier().verifyIdToken(token);
  if(!claims.email_verified)return response(403,{authenticated:true,authorized:false,reason:'verify-email'});
  const role=ROLES.has(claims.aura_role)?claims.aura_role:null;
  return response(200,{authenticated:true,authorized:Boolean(role),role});
 }catch(error){
  // Invalid session tokens are user errors; unavailable Firebase Admin
  // credentials/project configuration must NOT be reported as a bad password.
  const code=String(error.code||'');
  if(['auth/invalid-id-token','auth/id-token-expired','auth/id-token-revoked','auth/argument-error'].includes(code)){
   return response(401,{authenticated:false,authorized:false,reason:'firebase-token-invalid'});
  }
  context.error('Firebase auth check unavailable: '+String(error.code||error.name||'service'));
  return response(503,{error:'No se pudo verificar Firebase en este momento.'});
 }
}});
