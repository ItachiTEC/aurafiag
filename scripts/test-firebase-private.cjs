'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const registrations={};
let storageCalls=0,tokenChecks=0;
const tables=new Map();
class FakeTable{
 constructor(name){this.name=name;this.entries=tables.get(name)||new Map();tables.set(name,this.entries);}
 static fromConnectionString(_connection,name){storageCalls++;return new FakeTable(name);}
 async createTable(){}
 async upsertEntity(entity){this.entries.set(entity.partitionKey+'/'+entity.rowKey,{...entity});}
 async createEntity(entity){this.entries.set(entity.partitionKey+'/'+entity.rowKey,{...entity});}
 async *listEntities(){yield* this.entries.values();}
}
const original=Module._load;
const validAdmin='A'.repeat(130),badRole='V'.repeat(130),revoked='R'.repeat(130),unverified='E'.repeat(130);
Module._load=function(name,parent,isMain){
 if(name==='@azure/functions')return {app:{http:(n,o)=>{registrations[n]=o;}}};
 if(name==='@azure/data-tables')return {TableClient:FakeTable};
 if(name==='firebase-admin/app')return {getApps:()=>[],initializeApp:()=>({name:'aura-private-cms'}),cert:v=>v};
 if(name==='firebase-admin/auth')return {getAuth:()=>({verifyIdToken:async(token,checkRevoked)=>{
  tokenChecks++;assert.equal(checkRevoked,true,'Admin routes must reject revoked Firebase tokens');
  if(token===validAdmin)return {aura_role:'administrator',email_verified:true};
  if(token===badRole)return {aura_role:'viewer',email_verified:true};
  if(token===unverified)return {aura_role:'administrator',email_verified:false};
  const e=Error('revoked');e.code='auth/id-token-revoked';throw e;
 }})};
 return original.apply(this,arguments);
};
process.env.AURA_STORAGE_CONNECTION_STRING='fake-test-storage';
require('../api/src/functions/cms.js');
require('../api/src/functions/messages.js');
const request=(token,method='GET',data=null,params={})=>({
 method,params,headers:{get:k=>k==='x-aura-firebase-token'?token:k==='content-length'?data?String(JSON.stringify(data).length):'0':null},
 json:async()=>data
});
const context={error:()=>{}};
(async()=>{
 const cms=registrations.firebaseAdminContent,del=registrations.firebaseAdminContentDelete,media=registrations.firebaseAdminMediaUpload;
 const inbox=registrations.firebaseAdminMessages,act=registrations.firebaseAdminMessageAction,diagnostic=registrations.firebaseAdminCmsDiagnostic;
 for(const fn of [cms,del,media,inbox,act,diagnostic])assert(fn,'Private Firebase route not registered');
 assert.equal(cms.route,'firebase-admin/content');
 assert.equal(inbox.route,'firebase-admin/messages');
 let r=await cms.handler(request(''),context);assert.equal(r.status,401);
 assert.equal(storageCalls,0,'Unauthorized request must never access Storage');
 r=await cms.handler(request(badRole),context);assert.equal(r.status,403);
 assert.equal(storageCalls,0);
 r=await cms.handler(request(unverified),context);assert.equal(r.status,403);
 r=await cms.handler(request(revoked),context);assert.equal(r.status,401);
 r=await cms.handler(request(validAdmin),context);assert.equal(r.status,200);
 const item={type:'news',id:'private-test',state:'draft',data:{title:'Private',summary:'draft',body:'Contenido privado por ahora'}};
 r=await cms.handler(request(badRole,'POST',item),context);assert.equal(r.status,403);
 r=await cms.handler(request(validAdmin,'POST',item),context);assert.equal(r.status,200);
 r=await cms.handler(request(validAdmin),context);assert(r.jsonBody.items.some(x=>x.id==='private-test'));
 r=await del.handler(request(badRole,'DELETE',null,{type:'news',id:'private-test'}),context);assert.equal(r.status,403);
 r=await media.handler(request(badRole,'POST',{base64:'invalid'}),context);assert.equal(r.status,403);
 r=await media.handler(request(validAdmin,'POST',{base64:'invalid'}),context);assert.equal(r.status,400);
 r=await inbox.handler(request(),context);assert.equal(r.status,401);
 r=await inbox.handler(request(badRole),context);assert.equal(r.status,403);
 r=await inbox.handler(request(validAdmin),context);assert.equal(r.status,200);
 r=await act.handler(request(badRole,'PATCH',null,{id:'bad'}),context);assert.equal(r.status,403);
 r=await diagnostic.handler(request(badRole),context);assert.equal(r.status,403);
 assert(tokenChecks>=11);
 console.log('AURA Firebase private CMS: admin-only, revoked tokens, draft, image, messages verified.');
})().catch(err=>{console.error(err);process.exit(1);}).finally(()=>{Module._load=original;});
