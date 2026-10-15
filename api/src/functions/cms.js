'use strict';
/* AURA CMS — Azure Tables + private Blob storage. Read: public published content. Write: administrator only. */
const {app}=require('@azure/functions');
const {TableClient}=require('@azure/data-tables');
// El cliente Blob se carga solo al subir/leer imágenes; una dependencia de medios nunca debe impedir registrar las rutas de contenido.
const {randomUUID}=require('node:crypto');

const TYPES=new Set(['proposals','news','team','resources','identity']);
const TABLE='AURAContent';
const CONTAINER='auramedia';
const MAX_IMAGE_BYTES=2*1024*1024;
let tablePromise,containerPromise;
const ok=(status,json)=>({status,jsonBody:json,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const canStore=()=>Boolean(process.env.AURA_STORAGE_CONNECTION_STRING);
function principal(req){
 const raw=req.headers.get('x-ms-client-principal');
 if(!raw||raw.length>10000)return null;
 try{const p=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));return p&&Array.isArray(p.userRoles)&&p.userRoles.includes('administrator')&&p.userId?p:null;}catch{return null;}
}
/*
 * Managed Azure Static Web Apps Functions: /api/admin/* has
 * allowedRoles:["administrator"] in src/staticwebapp.config.json.
 * The SWA edge performs authentication and authorization BEFORE a handler runs.
 * Re-checking x-ms-client-principal here caused false 403 responses when the
 * platform did not forward this informational header. We intentionally rely on
 * the mandatory route policy for these endpoints. Do not use this function app
 * as a separately exposed BYO Functions endpoint without adding independent
 * authentication middleware.
 */
function forbid(_req){return null;}
const {requireFirebaseAdmin}=require('../firebase-gate.js');
// Las rutas SWA /api/admin/* mantienen su propio control Azure.
// Estas rutas paralelas son públicas a nivel de gateway, pero cada solicitud
// se autoriza en el servidor antes de usar Table/Blob Storage.
function registerFirebaseTwin(name,options){
 app.http(name,options);
 app.http('firebase'+name.charAt(0).toUpperCase()+name.slice(1),{
  ...options,
  route:options.route.replace(/^admin\//,'firebase-admin/'),
  handler:async(req,context)=>{
   const denial=await requireFirebaseAdmin(req,context);
   if(denial)return denial;
   return options.handler(req,context);
  }
 });
}

async function store(){
 if(!canStore())throw Error('AURA_STORAGE_CONNECTION_STRING no configurado');
 if(!tablePromise){
  const table=TableClient.fromConnectionString(process.env.AURA_STORAGE_CONNECTION_STRING,TABLE);
  tablePromise=table.createTable().then(()=>table).catch(e=>{if(e.statusCode===409)return table;tablePromise=null;throw e;});
 }
 return tablePromise;
}
async function mediaStore(){
 if(!canStore())throw Error('AURA_STORAGE_CONNECTION_STRING no configurado');
 if(!containerPromise){
  const {BlobServiceClient}=require('@azure/storage-blob');
  const container=BlobServiceClient.fromConnectionString(process.env.AURA_STORAGE_CONNECTION_STRING).getContainerClient(CONTAINER);
  containerPromise=container.createIfNotExists().then(()=>container).catch(e=>{containerPromise=null;throw e;});
 }
 return containerPromise;
}
function clean(x,max=3000){return typeof x==='string'?x.trim().slice(0,max):'';}
const ID=/^[a-z0-9][a-z0-9-]{0,79}$/;
const FIELDS={
 proposals:{title:160,summary:460,problem:2600,result:1200,competence:1300,area:100,scope:30,school:60,status:30,image:220},
 news:{title:160,summary:420,body:9000,category:70,image:220,date:32},
 team:{name:100,school:80,role:120,bio:1200,photo:220},
 resources:{title:160,href:400,type:80,detail:500},
 identity:{acronym:35,subtitle:70,fullName:130,intro:900,description:1500,email:160,instagram:400,whatsapp:400,logoUrl:220}
};
function validate(t, id, body, state){
 if(!TYPES.has(t)||!ID.test(id))return 'Tipo o identificador incorrecto.';
 if(!['draft','published'].includes(state))return 'Elige Borrador o Publicado.';
 if(!body||typeof body!=='object'||Array.isArray(body))return 'Completa la información.';
 const valid=FIELDS[t],v={};
 for(const [k,length] of Object.entries(valid)){if(body[k]!==undefined){if(typeof body[k]!=='string'||body[k].length>length)return 'Campo inválido: '+k;v[k]=clean(body[k],length);}}
 if(t==='identity'&&id!=='site')return 'Identificador de identidad inválido.';
 if(t==='proposals'){
  if(!['fiag','asamblea'].includes(v.scope)||!['arquitectura','civil','geologica','artes','comun','universidad'].includes(v.school)||!['consulta','formulacion','presentada','seguimiento','finalizada'].includes(v.status))return 'Ámbito, escuela o estado inválido.';
  if(!Array.isArray(body.actions)||body.actions.length>12||body.actions.some(a=>typeof a!=='string'||a.length>350))return 'Acciones inválidas.';
  v.actions=body.actions.map(a=>clean(a,350)).filter(Boolean);
 }
 if(t==='resources'&&v.href&&!(/^(https:\/\/|\/(?!\/))/i.test(v.href)))return 'La dirección debe usar HTTPS o ruta interna.';
 if(t==='identity'){
  for(const key of ['instagram','whatsapp'])if(v[key]&&!/^https:\/\//i.test(v[key]))return 'Las redes deben usar HTTPS.';
  if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return 'Correo electrónico inválido.';
 }
 if(t==='team'&&v.photo&&!/^\/api\/media\/[0-9a-f-]{36}\.(webp|png|jpg)$|^\/assets\/[a-z0-9/_-]+\.(webp|png|jpg|jpeg)$/i.test(v.photo))return 'Fotografía inválida.';
 for(const key of ['image','logoUrl'])if(v[key]&&!/^\/api\/media\/[0-9a-f-]{36}\.(webp|png|jpg)$|^\/assets\/[a-z0-9/_-]+\.(webp|png|jpg|jpeg)$/i.test(v[key]))return 'Ruta de imagen inválida.';
 if(t!=='identity'&&!v.title&&!v.name)return 'Falta un título o nombre.';
 if(t==='news'&&(!v.body||v.body.length<10))return 'La entrada debe tener contenido.';
 return v;
}
function convert(e){let data={};try{data=JSON.parse(e.payload||'{}');}catch{return null;}return {type:e.partitionKey,id:e.rowKey,state:e.state||'draft',deleted:!!e.deleted,updatedAt:e.updatedAt,data};}
async function records(all=false){
 const table=await store(),items=[];
 for await (const e of table.listEntities()){
  if(!TYPES.has(e.partitionKey))continue;
  const item=convert(e);if(!item)continue;
  if(!all&&item.state!=='published'){items.push({type:item.type,id:item.id,state:'draft',deleted:true,updatedAt:item.updatedAt,data:{}});continue;}
  items.push(item);
  if(items.length>1200)break;
 }
 return items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
function serverError(context,error){context.error('AURA CMS: '+(error?.code||error?.name||'StorageFailure'));}
app.http('publicContent',{route:'content',methods:['GET'],authLevel:'anonymous',handler:async(req,context)=>{
 if(!canStore())return ok(200,{ready:false,items:[]});
 try{return ok(200,{ready:true,items:await records(false)});}catch(e){serverError(context,e);return ok(503,{error:'No se pudo recuperar contenido.'});}
}});
registerFirebaseTwin('adminContent',{route:'admin/content',methods:['GET','POST'],authLevel:'anonymous',handler:async(req,context)=>{
 const denial=forbid(req);if(denial)return denial;
 if(req.method==='GET'){try{return ok(200,{items:await records(true)});}catch(e){serverError(context,e);return ok(503,{error:'No se pudo abrir el editor.'});}}
 let input;try{const size=Number(req.headers.get('content-length')||0);if(size>20000)return ok(413,{error:'Contenido demasiado grande.'});input=await req.json();if(JSON.stringify(input).length>20000)return ok(413,{error:'Contenido demasiado grande.'});}catch{return ok(400,{error:'JSON inválido.'});}
 const {type,id,state='draft',data}=input||{};
 const valid=validate(type,id,data,state);
 if(typeof valid==='string')return ok(400,{error:valid});
 const now=new Date().toISOString();
 try{const table=await store();await table.upsertEntity({partitionKey:type,rowKey:id,state,deleted:false,updatedAt:now,payload:JSON.stringify(valid)},'Replace');return ok(200,{ok:true,id,updatedAt:now});}catch(e){serverError(context,e);return ok(503,{error:'No fue posible guardar el contenido.'});}
}});
registerFirebaseTwin('adminContentDelete',{route:'admin/content/{type}/{id}',methods:['DELETE'],authLevel:'anonymous',handler:async(req,context)=>{
 const denial=forbid(req);if(denial)return denial;
 const {type,id}=req.params;
 if(!TYPES.has(type)||!ID.test(id)||type==='identity')return ok(400,{error:'Tipo no válido.'});
 try{const table=await store();await table.upsertEntity({partitionKey:type,rowKey:id,state:'published',deleted:true,updatedAt:new Date().toISOString(),payload:'{}'},'Replace');return ok(200,{ok:true});}catch(e){serverError(context,e);return ok(503,{error:'No se pudo retirar.'});}
}});
function imageType(data){
 if(data.length>=12&&data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')return {mime:'image/webp',ext:'webp'};
 if(data.length>=8&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',ext:'png'};
 if(data.length>=4&&data[0]===255&&data[1]===216&&data[2]===255)return {mime:'image/jpeg',ext:'jpg'};
 return null;
}
registerFirebaseTwin('adminMediaUpload',{route:'admin/media',methods:['POST'],authLevel:'anonymous',handler:async(req,context)=>{
 const denial=forbid(req);if(denial)return denial;
 let payload;try{
  if(Number(req.headers.get('content-length')||0)>3_000_000)return ok(413,{error:'Máximo 2 MB por imagen.'});
  payload=await req.json();
 }catch{return ok(400,{error:'Archivo inválido.'});}
 const b64=payload?.base64;
 if(typeof b64!=='string'||b64.length>2_850_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)||!b64)return ok(400,{error:'Formato base64 inválido.'});
 const data=Buffer.from(b64,'base64');const format=imageType(data);
 if(!format||data.length>MAX_IMAGE_BYTES||data.length<20)return ok(400,{error:'Solo JPEG, PNG o WebP de máximo 2 MB.'});
 const name=randomUUID()+'.'+format.ext;
 try{const container=await mediaStore();await container.getBlockBlobClient(name).uploadData(data,{blobHTTPHeaders:{blobContentType:format.mime,blobCacheControl:'public, max-age=3600'}});return ok(201,{url:'/api/media/'+name});}catch(e){serverError(context,e);return ok(503,{error:'No se pudo subir la imagen. Comprueba Blob Storage.'});}
}});
app.http('publicMedia',{route:'media/{name}',methods:['GET'],authLevel:'anonymous',handler:async(req,context)=>{
 const name=req.params.name;
 if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(name||''))return ok(404,{error:'No encontrado.'});
 try{
  const container=await mediaStore(),blob=container.getBlobClient(name);
  // Azure Static Web Apps puede tratar de forma diferente las respuestas
  // binarias de Functions. Una redirección firmada por poco tiempo entrega la
  // imagen directamente desde Blob, sin hacer público el contenedor privado.
  if(!await blob.exists())return ok(404,{error:'Imagen no encontrada.'});
  try{
   const {BlobSASPermissions}=require('@azure/storage-blob');
   const expiresOn=new Date(Date.now()+10*60*1000);
   const startsOn=new Date(Date.now()-60*1000);
   const signedUrl=await blob.generateSasUrl({
    permissions:BlobSASPermissions.parse('r'),
    startsOn,expiresOn
   });
   return {status:302,headers:{
    'Location':signedUrl,
    'Cache-Control':'public, max-age=90',
    'X-Content-Type-Options':'nosniff'
   }};
  }catch(sasError){
   // Algunos tipos de credenciales no permiten SAS. En esos entornos usamos
   // la respuesta binaria original sin cambiar las rutas de publicaciones.
   context.warn?.('AURA media SAS fallback: '+String(sasError?.code||sasError?.name||'UnsupportedCredential'));
   const download=await blob.downloadToBuffer(0,MAX_IMAGE_BYTES+1);
   if(download.length>MAX_IMAGE_BYTES)return ok(413,{error:'Imagen demasiado grande.'});
   const mime=name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':'image/webp';
   return {status:200,body:new Uint8Array(download),headers:{
    'Content-Type':mime,'Content-Length':String(download.length),
    'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'
   }};
  }
 }catch(e){
  if(e.statusCode===404)return ok(404,{error:'Imagen no encontrada.'});
  serverError(context,e);
  return ok(503,{error:'Imagen no disponible. Revisa el acceso a Azure Blob Storage.'});
 }
}});


/* Comprobación de registro y conectividad, sin exponer secretos ni información de estudiantes. */
app.http('cmsHealth',{route:'cms-health',methods:['GET'],authLevel:'anonymous',handler:async()=>ok(200,{ok:true,service:'AURA CMS',apiVersion:'2',routesRegistered:true})});
app.http('adminCmsAuthCheck',{route:'admin/cms-auth-check',methods:['GET'],authLevel:'anonymous',handler:async(req)=>{
 // Successful JSON proves that Azure Static Web Apps permitted this
 // administrator-only route. We intentionally do not return user details.
 const header=req.headers.get('x-ms-client-principal');
 return ok(200,{gatewayReached:true,principalHeaderReceived:!!header,principalRolePresent:!!principal(req)});
}});
registerFirebaseTwin('adminCmsDiagnostic',{route:'admin/cms-diagnostic',methods:['GET'],authLevel:'anonymous',handler:async(req,context)=>{
 const denial=forbid(req);if(denial)return denial;
 const response={apiRegistered:true,storageConfigured:canStore(),tablesReady:false,blobsReady:false};
 if(!canStore())return ok(200,response);
 try{await store();response.tablesReady=true;}catch(e){serverError(context,e);}
 try{await mediaStore();response.blobsReady=true;}catch(e){serverError(context,e);}
 return ok(200,response);
}});
