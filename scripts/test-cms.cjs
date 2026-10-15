/* AURA CMS tests: no Azure account or external packages needed. */
const assert=require('node:assert/strict');
const Module=require('node:module');
const registrations={}, tables=new Map(), images=new Map();
const original=Module._load;
class FakeTable{
 constructor(name){this.items=tables.get(name)||new Map();tables.set(name,this.items);}
 static fromConnectionString(_connection,name){return new FakeTable(name);}
 async createTable(){}
 async upsertEntity(row){this.items.set(row.partitionKey+'/'+row.rowKey,Object.assign({},row));}
 async *listEntities(){for(const v of this.items.values())yield v;}
}
class FakeContainer{
 async createIfNotExists(){}
 getBlockBlobClient(name){return {uploadData:async data=>{images.set(name,Buffer.from(data));}};}
 getBlobClient(name){return {downloadToBuffer:async()=>{if(!images.has(name)){const e=Error('Not found');e.statusCode=404;throw e;}return images.get(name);}};}
}
class FakeBlob{
 static fromConnectionString(){return new FakeBlob();}
 getContainerClient(){return new FakeContainer();}
}
Module._load=function(name,parent,isMain){
 if(name==='@azure/functions')return {app:{http:(n,options)=>{registrations[n]=options.handler;}}};
 if(name==='@azure/data-tables')return {TableClient:FakeTable};
 if(name==='@azure/storage-blob')return {BlobServiceClient:FakeBlob};
 return original.apply(this,arguments);
};
process.env.AURA_STORAGE_CONNECTION_STRING='fake-azure-storage';
require('../api/src/functions/cms.js');
Module._load=original;
const administrator={userId:'editor1',userRoles:['authenticated','administrator']};
const request=(method='GET',body=null,admin=false,params={})=>({
 method,params,headers:{get(key){if(key==='x-ms-client-principal'&&admin)return Buffer.from(JSON.stringify(administrator)).toString('base64');if(key==='content-length')return body?String(JSON.stringify(body).length):'0';return null;}},
 json:async()=>body
});
const context={error:()=>{}};
(async()=>{
 const initial=await registrations.publicContent(request(),context);
 assert.equal(initial.status,200);assert.deepEqual(initial.jsonBody.items,[]);
 const forbidden=await registrations.adminContent(request('GET'),context);
 assert.equal(forbidden.status,403);
 const draft={type:'news',id:'primera-noticia',state:'draft',data:{title:'Primera noticia',summary:'Resumen',body:'Una noticia de prueba sin publicar.',category:'AURA',date:'2026-10-14'}};
 let res=await registrations.adminContent(request('POST',draft,true),context);assert.equal(res.status,200);
 let publicResult=await registrations.publicContent(request(),context);
 assert(!JSON.stringify(publicResult.jsonBody).includes('Una noticia de prueba'), 'Draft content leaked');
 assert(publicResult.jsonBody.items.some(x=>x.id==='primera-noticia'&&x.deleted===true));
 draft.state='published';
 res=await registrations.adminContent(request('POST',draft,true),context);assert.equal(res.status,200);
 publicResult=await registrations.publicContent(request(),context);
 assert(publicResult.jsonBody.items.some(x=>x.id==='primera-noticia'&&x.data.body.includes('noticia')));
 let adminResults=await registrations.adminContent(request('GET',null,true),context);
 assert(adminResults.jsonBody.items.some(x=>x.id==='primera-noticia'));
 const bad={type:'proposals',id:'prueba',state:'published',data:{title:'Tema',scope:'no-valido',school:'civil',status:'consulta',actions:[]}};
 res=await registrations.adminContent(request('POST',bad,true),context);assert.equal(res.status,400);
 const good={...bad,data:{...bad.data,scope:'fiag'}};
 res=await registrations.adminContent(request('POST',good,true),context);assert.equal(res.status,200);
 const reject=await registrations.adminContentDelete(request('DELETE',null,false,{type:'proposals',id:'prueba'}),context);assert.equal(reject.status,403);
 const deleted=await registrations.adminContentDelete(request('DELETE',null,true,{type:'proposals',id:'prueba'}),context);assert.equal(deleted.status,200);
 publicResult=await registrations.publicContent(request(),context);
 assert(publicResult.jsonBody.items.some(x=>x.id==='prueba'&&x.deleted===true));
 const fakeJpg=Buffer.from([255,216,255,224,...Array.from({length:70},()=>1)]);
 const upload=await registrations.adminMediaUpload(request('POST',{base64:fakeJpg.toString('base64')},true),context);
 assert.equal(upload.status,201);
 assert.match(upload.jsonBody.url,/^\/api\/media\/[0-9a-f-]+\.jpg$/);
 const path=upload.jsonBody.url.split('/').pop();
 const display=await registrations.publicMedia(request('GET',null,false,{name:path}),context);
 assert.equal(display.status,200);assert.equal(display.body.length,fakeJpg.length);
 const dangerous=await registrations.adminMediaUpload(request('POST',{base64:Buffer.from('<svg>fake</svg>').toString('base64')},true),context);
 assert.equal(dangerous.status,400);
 console.log('CMS: admin auth, drafts, publishing, updates, tombstones, image upload and type checks OK.');
})().catch(e=>{console.error(e);process.exit(1);});
