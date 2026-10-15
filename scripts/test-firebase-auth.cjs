const assert=require('node:assert/strict');
const Module=require('node:module');
const {verifyFirebaseRequest,firebaseConfigured}=require('../api/src/lib/firebase-auth.js');
const request=value=>({headers:{get:name=>name==='authorization'?value:null}});
(async()=>{
 delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 assert.equal(firebaseConfigured(),false);
 const disabled=await verifyFirebaseRequest(request('Bearer token'));
 assert.equal(disabled.status,503,'Firebase must fail closed if not configured');
 process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'example',client_email:'firebase-adminsdk@example.iam.gserviceaccount.com',private_key:'fake-key'});
 const original=Module._load;
 let payload={uid:'user-1',email:'person@example.org',email_verified:true,auraRole:'editor'};
 Module._load=function(name,parent,isMain){
  if(name==='firebase-admin/app')return {initializeApp:()=>({name:'aura-backend'}),cert:()=>({}),getApps:()=>[]};
  if(name==='firebase-admin/auth')return {getAuth:()=>({verifyIdToken:async()=>payload})};
  return original.apply(this,arguments);
 };
 try{
  const missing=await verifyFirebaseRequest(request(''));
  assert.equal(missing.status,401);
  const malformed=await verifyFirebaseRequest(request('Bearer token spaces'));
  assert.equal(malformed.status,401);
  const allowed=await verifyFirebaseRequest(request('Bearer valid.test.token'),['owner','editor']);
  assert.equal(allowed.ok,true);assert.equal(allowed.role,'editor');
  const denied=await verifyFirebaseRequest(request('Bearer valid.test.token'),['owner']);
  assert.equal(denied.status,403);
  payload={...payload,email_verified:false};
  const unverified=await verifyFirebaseRequest(request('Bearer valid.test.token'));
  assert.equal(unverified.status,403);
  console.log('Firebase bridge: fails closed, verifies email and roles on server.');
 }finally{Module._load=original;delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;}
})().catch(error=>{console.error(error);process.exit(1)});
