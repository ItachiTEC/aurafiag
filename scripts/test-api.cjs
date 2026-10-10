// Tests autocontenidos de validación y permisos, sin recursos de Azure ni dependencias instaladas.
const assert = require('node:assert/strict');
const Module = require('node:module');
const functions={}; const entities=new Map();
const original=Module._load;
class FakeTableClient {
  async createTable(){}
  async createEntity(e){entities.set(e.rowKey,e);}
  async *listEntities(){yield* entities.values();}
  async updateEntity(e){Object.assign(entities.get(e.rowKey),e);}
  async deleteEntity(_,id){entities.delete(id);}
  static fromConnectionString(){return new FakeTableClient();}
}
Module._load=function(name,parent,isMain){if(name==='@azure/functions')return {app:{http:(name,config)=>{functions[name]=config.handler;}}};if(name==='@azure/data-tables')return {TableClient:FakeTableClient};return original.apply(this,arguments);};
process.env.AURA_STORAGE_CONNECTION_STRING='fake';
require('../api/src/functions/messages.js');Module._load=original;
const headers=(user)=>({get(name){return name==='x-ms-client-principal'&&user?Buffer.from(JSON.stringify(user)).toString('base64'):null;}});
const req=(body,role)=>({headers:headers(role),json:async()=>body,method:'POST',params:{}});
const context={error:()=>{}};
(async()=>{
 const stat=await functions.status(req(),context);assert.equal(stat.jsonBody.ready,true);
 const invalid=await functions.messages(req({type:'idea'}),context);assert.equal(invalid.status,400);
 const input={type:'idea',school:'arquitectura',subject:'Mi propuesta',message:'Este texto tiene bastante contenido de ejemplo.',senderName:'',email:'',proposal:'',consent:true};
 const created=await functions.messages(req(input),context);assert.equal(created.status,201);assert.ok(created.jsonBody.reference);
 const unauth=await functions.adminMessages(req(),context);assert.equal(unauth.status,403);
 const admin={userId:'user1',userRoles:['authenticated','administrator']};
 const list=await functions.adminMessages(req(null,admin),context);assert.equal(list.jsonBody.items.length,1);
 const id=created.jsonBody.reference;
 const patch=await functions.adminMessageAction({...req({status:'revision',note:'Revisado'},admin),method:'PATCH',params:{id}},context);assert.equal(patch.status,200);assert.equal(entities.get(id).status,'revision');
 const deleted=await functions.adminMessageAction({...req(null,admin),method:'DELETE',params:{id}},context);assert.equal(deleted.status,200);assert.equal(entities.size,0);
 console.log('API: validación, guardado, permisos, actualización y eliminación correctos.');
})().catch(e=>{console.error(e);process.exit(1);});
