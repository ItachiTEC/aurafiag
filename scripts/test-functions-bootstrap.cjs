// Prueba de arranque real de rutas Azure Functions v4, sin infraestructura ni dependencias instaladas.
const assert=require('node:assert/strict');
const Module=require('node:module');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const json=JSON.parse(readFileSync(resolve(__dirname,'../api/package.json'),'utf8'));
assert.equal(json.main,'src/index.js','The explicit runtime main must be api/src/index.js');
const registered=new Map();let blobImported=false;
const original=Module._load;
Module._load=function(name,parent,isMain){
 if(name==='@azure/functions')return {app:{http:(name,options)=>{
   assert(!registered.has(name),'Duplicate function: '+name);registered.set(name,options);
 }}};
 if(name==='@azure/data-tables')return {TableClient:class FakeTable{}};
 if(name==='@azure/storage-blob'){blobImported=true;throw Error('Blob SDK must not be loaded at function startup');}
 return original.apply(this,arguments);
};
try{require('../api/src/index.js');}finally{Module._load=original;}
for(const [name,route] of [
 ['status','status'],['messages','messages'],['adminMessages','admin/messages'],
 ['adminMessageAction','admin/messages/{id}'],['publicContent','content'],
 ['adminContent','admin/content'],['adminContentDelete','admin/content/{type}/{id}'],
 ['adminMediaUpload','admin/media'],['publicMedia','media/{name}'],
 ['cmsHealth','cms-health'],['adminCmsDiagnostic','admin/cms-diagnostic']
]){
 assert(registered.has(name),'Missing registration '+name);
 assert.equal(registered.get(name).route,route,name+' route mismatch');
}
assert.equal(blobImported,false,'Unrelated media SDK blocked route registrations.');
console.log('AURA Functions: '+registered.size+' registered routes, Blob loading deferred, paths verified.');
