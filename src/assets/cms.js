/* AURA CMS: client-side model overlay and authenticated editor (no secrets here). */
import {identity, proposals, resources, team} from './content.js';
export const newsEntries=[];
export const cmsStatus={ready:false,error:''};
const slug=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
const groups={proposals,team,resources,news:newsEntries};
function prepareIds(){
 resources.forEach((v,i)=>{if(!v.id)v.id='resource-'+(i+1);});
 team.forEach((v,i)=>{if(!v.id)v.id=slug(v.name)||'team-'+(i+1);});
}
prepareIds();
function apply(item){
 const {type,id,data={},state='draft',deleted}=item;
 if(type==='identity'){if(state==='published'&&!deleted)Object.assign(identity,data);return;}
 const group=groups[type];if(!group)return;
 const i=group.findIndex(x=>x.id===id);
 if(deleted||state!=='published'){if(i>=0)group.splice(i,1);return;}
 const value=Object.assign({},data,{id});
 if(i<0)group.push(value);else group[i]=value;
}
export async function loadPublicCms(){
 try{
  const response=await fetch('/api/content',{cache:'no-store',signal:AbortSignal.timeout(6500)});
  if(!response.ok)throw Error('Error al cargar contenidos');
  const result=await response.json();
  cmsStatus.ready=!!result.ready;
  (result.items||[]).forEach(apply);
  newsEntries.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 }catch(e){cmsStatus.error=e.message||'Sin conexión';}
}
const FIELDS={
 news:[['title','Título'],['summary','Resumen','textarea'],['body','Texto completo (separa párrafos con línea vacía)','long'],['date','Fecha','date'],['category','Categoría'],['image','Imagen principal','image']],
 proposals:[['title','Título'],['summary','Resumen','textarea'],['scope','Ámbito','scope'],['school','Escuela','school'],['area','Área'],['status','Estado','status'],['problem','Problema','long'],['actions','Acciones (una por línea)','long'],['result','Resultado esperado','textarea'],['competence','Competencia','textarea'],['image','Imagen','image']],
 team:[['name','Nombre'],['school','Escuela'],['role','Rol'],['bio','Descripción','textarea'],['photo','Foto','image']],
 resources:[['title','Título'],['href','Enlace'],['type','Tipo'],['detail','Descripción','textarea']],
 identity:[['acronym','Sigla'],['subtitle','Subtítulo'],['fullName','Nombre completo'],['intro','Introducción','textarea'],['description','Descripción','textarea'],['email','Correo'],['instagram','Instagram HTTPS'],['whatsapp','WhatsApp HTTPS'],['logoUrl','Logo','image']]
};
const OPTIONS={
 scope:[['fiag','Consejo de Facultad'],['asamblea','Asamblea Universitaria']],
 school:[['arquitectura','Arquitectura'],['civil','Ingeniería Civil'],['geologica','Ing. Geológica-Geotecnia'],['artes','Artes'],['comun','FIAG común'],['universidad','UNJBG']],
 status:[['consulta','En consulta'],['formulacion','En formulación'],['presentada','Presentada'],['seguimiento','En seguimiento'],['finalizada','Finalizada']]
};
const NAMES={news:'Entradas',proposals:'Propuestas',team:'Equipo',resources:'Recursos',identity:'Identidad',inbox:'Mensajes'};
let firebaseTokenProvider=null; // set only for /firebase-admin/; legacy GitHub admin remains unchanged
const el=(tag,classname,textValue)=>{
 const n=document.createElement(tag);
 if(classname)n.className=classname;
 if(textValue!==undefined)n.textContent=textValue;
 return n;
};
const button=(label,classname,fn)=>{
 const n=el('button',classname,label);n.type='button';n.addEventListener('click',fn);return n;
};
async function call(url,config){
 let target=url;
 const options=Object.assign({cache:'no-store',credentials:'same-origin'},config||{});
 if(firebaseTokenProvider&&url.startsWith('/api/admin/')){
  target=url.replace('/api/admin/','/api/firebase-admin/');
  const token=await firebaseTokenProvider();
  options.headers={...(config?.headers||{}),'X-AURA-Firebase-Token':token};
 }
 const response=await fetch(target,options);
 let data={};try{data=await response.json();}catch{}
 if(!response.ok){const e=Error(data.error||'Error '+response.status);e.status=response.status;throw e;}
 return data;
}
async function encodeFile(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(Error('No se pudo leer el archivo'));
  reader.onload=()=>resolve(String(reader.result).split(',')[1]);
  reader.readAsDataURL(file);
 });
}
function allDefaults(){
 prepareIds();
 return {
  news:[],
  proposals:proposals.map(item=>({type:'proposals',id:item.id,state:'published',data:Object.assign({},item)})),
  team:team.map(item=>({type:'team',id:item.id,state:'published',data:Object.assign({},item)})),
  resources:resources.map(item=>({type:'resources',id:item.id,state:'published',data:Object.assign({},item)})),
  identity:[{type:'identity',id:'site',state:'published',data:Object.assign({},identity)}]
 };
}
function applyAdminModel(source){
 const all=allDefaults();
 for(const entry of source){
  if(!all[entry.type])continue;
  const list=all[entry.type],index=list.findIndex(x=>x.id===entry.id);
  if(index<0)list.push(entry);else list[index]=entry;
 }
 return all;
}
export async function mountCmsAdmin(root,{firebaseToken=null}={}){
 firebaseTokenProvider=firebaseToken;
 if(!root||root.dataset.cmsMounted)return;
 root.dataset.cmsMounted='true';
 const inbox=el('section','cms-inbox');
 inbox.hidden=true;
 while(root.firstChild)inbox.appendChild(root.firstChild);
 const dashboard=el('section','cms-dashboard');
 const heading=el('div','cms-heading');
 heading.append(el('span','cms-kicker','AURA / ADMINISTRACIÓN'),el('h2',null,'GESTIONA TU WEB.'),el('p',null,'Publica noticias, propuestas, recursos e imágenes sin abrir el código.'));
 const tabs=el('nav','cms-tabs');tabs.setAttribute('aria-label','Secciones del panel');
 const message=el('p','cms-feedback');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const body=el('div','cms-body');
 dashboard.append(heading,tabs,message,body);
 root.append(dashboard,inbox);
 let model=allDefaults(),connected=false,active='news',connectionIssue='';
 function say(v,error=false){message.textContent=v;message.classList.toggle('is-error',error);}
 function current(){return model[active]||[];}
 function displayTabs(){
  [...tabs.children].forEach(n=>{n.classList.toggle('selected',n.dataset.type===active);n.setAttribute('aria-current',n.dataset.type===active?'page':'false');});
  inbox.hidden=active!=='inbox';body.hidden=active==='inbox';
 }
 function select(type){
  active=type;displayTabs();
  if(type==='inbox'){if(firebaseTokenProvider)loadFirebaseInbox();return;}
  showList();
 }
 async function loadFirebaseInbox(){
  inbox.replaceChildren();
  const title=el('h3',null,'Mensajes privados del equipo');
  const info=el('p','cms-feedback','Cargando mensajes…');
  const list=el('div','admin-list');
  inbox.append(title,info,list);
  try{
   const data=await call('/api/admin/messages');
   const records=(data.items||[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
   info.textContent=records.length+' mensajes recibidos. Solo administradores autorizados pueden leerlos.';
   if(!records.length)list.append(el('p',null,'Sin mensajes por ahora.'));
   for(const message of records){
    const card=el('article','admin-item');
    const heading=el('h3',null,message.subject||'Sin asunto');
    const meta=el('p','admin-person',[(message.school||''),(message.senderName||''),(message.email||''),(message.createdAt||'')].filter(Boolean).join(' · '));
    const body=el('p','admin-message',message.message||'');
    const status=el('select');status.setAttribute('aria-label','Estado del mensaje');
    for(const [value,label] of [['nuevo','Nuevo'],['revision','En revisión'],['respondido','Respondido'],['cerrado','Cerrado']]){
     const option=el('option',null,label);option.value=value;if(message.status===value)option.selected=true;status.append(option);
    }
    const note=el('input');note.type='text';note.placeholder='Nota interna';note.maxLength=300;note.value=message.note||'';
    note.setAttribute('aria-label','Nota interna');
    const result=el('p','admin-feedback');
    const save=button('Guardar estado','cms-primary',async()=>{
     save.disabled=true;result.textContent='Guardando…';
     try{await call('/api/admin/messages/'+encodeURIComponent(message.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:status.value,note:note.value})});result.textContent='Mensaje actualizado.';}
     catch(e){result.textContent='Error: '+e.message;}
     finally{save.disabled=false;}
    });
    const remove=button('Eliminar','cms-danger',async()=>{
     if(!confirm('¿Eliminar definitivamente este mensaje?'))return;
     remove.disabled=true;
     try{await call('/api/admin/messages/'+encodeURIComponent(message.id),{method:'DELETE'});card.remove();result.textContent='Mensaje eliminado.';}
     catch(e){result.textContent='Error: '+e.message;remove.disabled=false;}
    });
    card.append(heading,meta,body,status,note,save,remove,result);
    list.append(card);
   }
  }catch(e){info.textContent='No se pudo abrir la bandeja: '+e.message;}
 }
 function showList(){
  body.replaceChildren();
  if(!connected){const alert=el('div','cms-empty');alert.append(el('strong',null,'El editor todavía no está disponible.'),el('p',null,connectionIssue||'Se requiere conexión a la API de contenidos. La bandeja de Mensajes se mantiene aparte.'));const a=el('a','cms-secondary','Ver diagnóstico de API ↗');a.href='/api/cms-health';a.target='_blank';a.rel='noopener noreferrer';const authLink=el('a','cms-secondary','Comprobar permiso de Azure ↗');authLink.href='/api/admin/cms-auth-check';authLink.target='_blank';authLink.rel='noopener noreferrer';alert.append(a,document.createTextNode(' '),authLink,document.createTextNode(' '),button('Reintentar conexión','cms-secondary',connect));body.append(alert);return;}
  if(active==='identity'){edit('site');return;}
  const actions=el('div','cms-bar');const heading=el('div');
  heading.append(el('h3',null,NAMES[active]),el('p',null,'Selecciona un registro o crea uno nuevo.'));
  actions.append(heading,button('+ Nueva publicación','cms-primary',()=>edit(null)));
  body.append(actions);
  const list=el('div','cms-items');
  const items=current().filter(r=>!r.deleted);
  if(!items.length)list.append(el('p','cms-empty','Aún no hay elementos; agrega el primero.'));
  for(const item of items){
   const label=el('span','cms-item-label');
   label.append(el('strong',null,item.data?.title||item.data?.name||item.id),el('small',null,item.id));
   const status=el('span','cms-pill '+(item.state==='published'?'published':''),item.state==='published'?'Publicado':'Borrador');
   const itemButton=button('','cms-item',()=>edit(item.id));itemButton.append(label,status);list.append(itemButton);
  }
  body.append(list);
 }
 function inputField(spec,data,form){
  const [key,label,type='text']=spec;
  const line=el('label','cms-field');line.append(el('span',null,label));
  const currentValue=Array.isArray(data[key])?data[key].join('\n'):String(data[key]||'');
  let control;
  if(OPTIONS[type]){
   control=el('select');
   for(const [value,caption] of OPTIONS[type]){
    const option=el('option',null,caption);option.value=value;
    if(currentValue===value)option.selected=true;
    control.append(option);
   }
  }else if(type==='long'||type==='textarea'){
   control=el('textarea');control.rows=type==='long'?7:3;control.maxLength=type==='long'?9500:1500;control.value=currentValue;
  }else{
   control=el('input');control.type=type==='date'?'date':'text';control.value=currentValue;
  }
  control.name=key;line.append(control);
  if(type==='image'){
   const uploader=el('div','cms-upload');
   const file=el('input');file.type='file';file.accept='image/webp,image/png,image/jpeg';file.setAttribute('aria-label','Archivo para '+label);
   uploader.append(file,button('Subir imagen','cms-secondary',async()=>{
    const chosen=file.files?.[0];
    if(!chosen){say('Selecciona una imagen.',true);return;}
    if(chosen.size>2*1024*1024){say('Límite de 2 MB por imagen.',true);return;}
    say('Subiendo imagen…');
    try{
     const base64=await encodeFile(chosen);
     const result=await call('/api/admin/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64})});
     control.value=result.url;
     say('Imagen subida. Pulsa Guardar para aplicar el cambio.');
    }catch(e){say(e.message,true);}
   }));
   line.append(uploader,el('small',null,'JPEG, PNG o WebP; máximo 2 MB.'));
  }
  form.append(line);
 }
 function edit(id){
  const entry=current().find(item=>item.id===id),data=entry?.data||{};
  body.replaceChildren();
  const bar=el('div','cms-bar');bar.append(el('h3',null,(id?'Editar ':'Crear ')+NAMES[active]));
  bar.append(button('← Regresar','cms-secondary',showList));body.append(bar);
  const form=el('form','cms-edit-form');
  const identifier=el('label','cms-field');
  identifier.append(el('span',null,'Identificador / enlace (minúsculas y guiones)'));
  const idInput=el('input');idInput.name='_id';idInput.value=id||'';idInput.readOnly=!!id;idInput.placeholder='titulo-de-la-entrada';
  idInput.pattern='[a-z0-9][a-z0-9-]{0,79}';identifier.append(idInput);
  form.append(identifier);
  for(const f of FIELDS[active])inputField(f,data,form);
  const state=el('label','cms-field');state.append(el('span',null,'Estado de publicación'));
  const visibility=el('select');visibility.name='_state';
  for(const [value,label] of [['draft','Borrador (oculto)'],['published','Publicado (visible)']]){
   const o=el('option',null,label);o.value=value;if(value===(entry?.state||'draft'))o.selected=true;visibility.append(o);
  }
  state.append(visibility);form.append(state);
  const row=el('div','cms-form-actions');
  const save=el('button','cms-primary','Guardar cambios');save.type='submit';row.append(save);
  if(id&&active!=='identity')row.append(button('Retirar de la web','cms-danger',async()=>{
   if(!confirm('¿Retirar este contenido de la página pública?'))return;
   try{
    await call('/api/admin/content/'+active+'/'+encodeURIComponent(id),{method:'DELETE'});
    model[active]=current().filter(x=>x.id!==id);say('Contenido retirado.');showList();
   }catch(e){say(e.message,true);}
  }));
  form.append(row);body.append(form);
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const fd=new FormData(form),values={};
   for(const [key] of FIELDS[active])values[key]=String(fd.get(key)||'').trim();
   if(active==='proposals')values.actions=values.actions.split('\n').map(x=>x.trim()).filter(Boolean);
   const nextId=String(fd.get('_id')||'').trim()||slug(values.title||values.name)||'nuevo';
   if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(nextId)){say('Usa solo minúsculas, números y guiones en el ID.',true);return;}
   const payload={type:active,id:nextId,state:fd.get('_state'),data:values};
   save.disabled=true;say('Guardando…');
   try{
    await call('/api/admin/content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const r=current(),index=r.findIndex(x=>x.id===nextId);
    if(index<0)r.push(payload);else r[index]=payload;
    say('Guardado: '+(payload.state==='published'?'publicado en la web.':'borrador privado.'));
    showList();
   }catch(e){say(e.message,true);}finally{save.disabled=false;}
  });
 }
 for(const type of Object.keys(NAMES)){
  const t=button(NAMES[type],'cms-tab',()=>select(type));t.dataset.type=type;tabs.append(t);
 }
 async function connect(){
  say('Comprobando el servicio de contenidos…');
  try{
   const response=await call('/api/admin/content');
   model=applyAdminModel(response.items||[]);
   connected=true;connectionIssue='';
   say('Gestor conectado. Los cambios publicados aparecen al actualizar la web.');
   select('news');
  }catch(e){
   connected=false;
   if(e.status===404)connectionIssue='Error 404: Azure no encontró la ruta '+(firebaseTokenProvider?'/api/firebase-admin/content':'/api/admin/content')+'. No es un fallo de contraseña ni significa que Storage esté desconectado. Puede tratarse de funciones no registradas o de despliegue de API pendiente.';
   else if(e.status===503){
    if(/autorización administrativa/i.test(e.message))connectionIssue='Error 503: Firebase Admin SDK todavía no puede comprobar sesiones con revocación. Revisa AURA_FIREBASE_SERVICE_ACCOUNT_JSON en las variables de entorno del despliegue de prueba de Azure. El servidor se detuvo antes de consultar Table Storage.';
    else connectionIssue='Error 503: Azure no pudo abrir el almacenamiento de contenidos. Revisa AURA_STORAGE_CONNECTION_STRING, la disponibilidad de Azure Tables y los registros del servidor.';
   }
   else if(e.status===401||e.status===403)connectionIssue='Acceso restringido al servicio de contenidos. Comprueba que la cuenta tiene el rol administrator y vuelve a iniciar sesión.';
   else connectionIssue='Error de comunicación ('+(e.status||'red')+'). Comprueba las funciones de Azure y reintenta.';
   say('No se pudo abrir el editor: '+e.message,true);
   showList();
  }
 }
 select('news');
 await connect();
}
