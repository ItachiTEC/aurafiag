'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const handlers={};
const orig=Module._load;
Module._load=function(name,parent,isMain){
 if(name==='@azure/functions')return {app:{http:(name,options)=>handlers[name]=options}};
 if(name==='firebase-admin/app')return {getApps:()=>[],initializeApp:()=>({name:'aura-firebase-check'})};
 if(name==='firebase-admin/auth')return {getAuth:()=>({verifyIdToken:async token=>{
  if(token==='x'.repeat(120))return {email_verified:true,aura_role:'editor'};
  if(token==='y'.repeat(120))return {email_verified:true};
  if(token==='z'.repeat(120))return {email_verified:false,aura_role:'administrator'};
  const e=new Error('Invalid token');e.code='auth/argument-error';throw e;
 }})};
 return orig.apply(this,arguments);
};
require('../api/src/functions/firebase-auth.js');
const h=handlers.firebaseAuthCheck?.handler;
assert(h,'Firebase check function not registered');
const req=v=>({headers:{get:k=>k==='x-aura-firebase-token'?v:''}});
const ctx={error:()=>{}};
(async()=>{
 let res=await h(req(''),ctx);assert.equal(res.status,401);assert.equal(res.jsonBody.reason,'firebase-token-missing');
 const swappTokenOnly={headers:{get:k=>k==='authorization'?'Bearer '+'x'.repeat(120):''}};
 res=await h(swappTokenOnly,ctx);assert.equal(res.status,401,'Azure platform token must NEVER authorize the Firebase route');
 res=await h(req('x'.repeat(120)),ctx);assert.equal(res.status,200);assert.equal(res.jsonBody.authorized,true);assert.equal(res.jsonBody.role,'editor');
 res=await h(req('y'.repeat(120)),ctx);assert.equal(res.status,200);assert.equal(res.jsonBody.authorized,false);
 res=await h(req('z'.repeat(120)),ctx);assert.equal(res.status,403);
 res=await h(req('q'.repeat(120)),ctx);assert.equal(res.status,401);
 console.log('Firebase: token requerido, rol y correo verificado, rechazo seguro OK');
})().catch(e=>{console.error(e);process.exit(1);}).finally(()=>{Module._load=orig;});
