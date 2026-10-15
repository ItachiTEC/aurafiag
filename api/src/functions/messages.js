'use strict';
const {app} = require('@azure/functions');
const {TableClient} = require('@azure/data-tables');
const {randomUUID} = require('node:crypto');
const tableName = process.env.AURA_TABLE_NAME || 'AURAMensajes';
let storageReadyPromise;
const TYPES = new Set(['idea','problema','comentario','contacto']);
const SCHOOLS = new Set(['arquitectura','civil','geologica','artes','otra','prefiero-no-decir']);
const STATES = new Set(['nuevo','revision','respondido','cerrado']);
const reply=(status,object)=>({status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},jsonBody:object});
const ready=()=>Boolean(process.env.AURA_STORAGE_CONNECTION_STRING);
const {requireFirebaseAdmin}=require('../firebase-gate.js');
const firebaseAuthorizedRequests=new WeakSet();
function registerFirebaseTwin(name,options){
 app.http(name,options);
 app.http('firebase'+name.charAt(0).toUpperCase()+name.slice(1),{
  ...options,
  route:options.route.replace(/^admin\//,'firebase-admin/'),
  handler:async(req,context)=>{
   const denial=await requireFirebaseAdmin(req,context);
   if(denial)return denial;
   // Este marcador solo puede crearlo el servidor DESPUÉS de validar Firebase.
   // Nunca se acepta un encabezado del navegador como sustituto del permiso.
   firebaseAuthorizedRequests.add(req);
   try{return await options.handler(req,context);}
   finally{firebaseAuthorizedRequests.delete(req);}
  }
 });
}


function getStore(){
 if(!ready()) throw new Error('La cuenta de almacenamiento no está configurada.');
 if(!storageReadyPromise){
   const table=TableClient.fromConnectionString(process.env.AURA_STORAGE_CONNECTION_STRING,tableName);
   storageReadyPromise=table.createTable().then(()=>table).catch(err=>{storageReadyPromise=null;throw err;});
 }
 return storageReadyPromise;
}
function clean(value,max){return typeof value==='string'?value.trim().slice(0,max+1):'';}
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return 'El formato del mensaje no es válido.';
 if(input.website)return 'No se pudo procesar la solicitud.';
 if(!TYPES.has(input.type))return 'Selecciona un tipo de mensaje válido.';
 if(!SCHOOLS.has(input.school))return 'Selecciona una escuela válida.';
 if(clean(input.subject,111).length<5||clean(input.subject,111).length>110)return 'El asunto debe tener entre 5 y 110 caracteres.';
 if(clean(input.message,3001).length<20||clean(input.message,3001).length>3000)return 'El mensaje debe tener entre 20 y 3 000 caracteres.';
 if(clean(input.senderName,81).length>80||clean(input.email,121).length>120)return 'Uno de los campos opcionales es demasiado largo.';
 if(input.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))return 'Escribe un correo válido.';
 if(clean(input.proposal,101).length>100)return 'La referencia de la propuesta es demasiado larga.';
 if(input.consent!==true)return 'Debes aceptar el aviso de privacidad.';
 return null;
}
function isAdmin(req){
 if(firebaseAuthorizedRequests.has(req))return true;
 const raw=req.headers.get('x-ms-client-principal');
 if(!raw||raw.length>10000)return false;
 try{
  const p=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
  return Array.isArray(p.userRoles)&&p.userRoles.includes('administrator')&&p.userId;
 }catch{return false;}
}
function logError(context,err){context.error('AURA API: '+(err?.code||err?.name||'StorageError'));}
app.http('status',{route:'status',methods:['GET'],authLevel:'anonymous',handler:async(req,context)=>{if(!ready())return reply(200,{ready:false});try{await getStore();return reply(200,{ready:true});}catch(e){logError(context,e);return reply(200,{ready:false});}}});
app.http('messages',{route:'messages',methods:['POST'],authLevel:'anonymous',handler:async(req,context)=>{
 if(!ready())return reply(503,{error:'El buzón todavía no está habilitado por el equipo.'});
 const size=Number(req.headers.get('content-length')||0);
 if(size>12000)return reply(413,{error:'El mensaje es demasiado grande.'});
 let body;
 try{body=await req.json();}catch{return reply(400,{error:'Envía un formulario válido.'});}
 if(JSON.stringify(body).length>12000)return reply(413,{error:'El mensaje es demasiado grande.'});
 if(body?.website)return reply(200,{reference:'NO-ENVIADO'}); // Honeypot: no registrar bots.
 const error=validate(body);
 if(error)return reply(400,{error});
 const id=randomUUID();
 const entity={partitionKey:'feedback',rowKey:id,createdAt:new Date().toISOString(),type:clean(body.type,30),school:clean(body.school,45),subject:clean(body.subject,110),message:clean(body.message,3000),senderName:clean(body.senderName,80),email:clean(body.email,120),proposal:clean(body.proposal,100),status:'nuevo',note:''};
 try{const table=await getStore();await table.createEntity(entity);return reply(201,{reference:id});}catch(e){logError(context,e);return reply(503,{error:'El buzón no pudo guardar el mensaje. Inténtalo después.'});}
}});
registerFirebaseTwin('adminMessages',{route:'admin/messages',methods:['GET'],authLevel:'anonymous',handler:async(req,context)=>{
 if(!isAdmin(req))return reply(403,{error:'Acceso no autorizado.'});
 try{
  const table=await getStore(), items=[];
  const iterator=table.listEntities({queryOptions:{filter:"PartitionKey eq 'feedback'"}});
  for await (const entity of iterator){items.push({id:entity.rowKey,createdAt:entity.createdAt,type:entity.type,school:entity.school,subject:entity.subject,message:entity.message,senderName:entity.senderName,email:entity.email,proposal:entity.proposal,status:entity.status,note:entity.note});if(items.length>=300)break;}
  return reply(200,{items});
 }catch(e){logError(context,e);return reply(503,{error:'No se pudo acceder al almacenamiento.'});}
}});
registerFirebaseTwin('adminMessageAction',{route:'admin/messages/{id}',methods:['PATCH','DELETE'],authLevel:'anonymous',handler:async(req,context)=>{
 if(!isAdmin(req))return reply(403,{error:'Acceso no autorizado.'});
 const id=req.params.id;
 if(!/^[0-9a-f-]{36}$/.test(id||''))return reply(400,{error:'Identificador inválido.'});
 try{
  const table=await getStore();
  if(req.method==='DELETE'){await table.deleteEntity('feedback',id);return reply(200,{ok:true});}
  let body;try{body=await req.json();}catch{return reply(400,{error:'Datos inválidos.'});}
  if(!STATES.has(body?.status)||typeof body?.note!=='string'||body.note.length>300)return reply(400,{error:'Estado o nota inválidos.'});
  await table.updateEntity({partitionKey:'feedback',rowKey:id,status:body.status,note:body.note.trim()},'Merge');
  return reply(200,{ok:true});
 }catch(e){logError(context,e);return reply(503,{error:'No se pudo completar la operación.'});}
}});
