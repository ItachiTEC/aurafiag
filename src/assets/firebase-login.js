/* AURA · Acceso Firebase de prueba.
 * Autenticar NO autoriza automáticamente el CMS. Los permisos se validan en servidor.
 */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,sendPasswordResetEmail,sendEmailVerification,signOut,onAuthStateChanged,reload} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {firebaseConfig} from '/assets/firebase-config.js';

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
window.__auraFirebaseModuleReady=true;
auth.languageCode='es';
const byId=id=>document.getElementById(id);
const form=byId('firebase-login-form');
const emailInput=byId('fb-email');
const passwordInput=byId('fb-password');
const submit=byId('fb-login-submit');
const status=byId('fb-status');
const actions=byId('fb-actions');
const verify=byId('fb-verify-email');
const recheck=byId('fb-recheck-email');
const logout=byId('fb-logout');
const reset=byId('fb-reset');

function notice(message,{warning=false,ok=false}={}){
 status.textContent=message;
 status.classList.toggle('auth-status-warning',warning);
 status.classList.toggle('auth-status-ok',ok);
}
function errorInfo(error){
 const code=String(error?.code||'');
 const dictionary={
  'auth/invalid-credential':'Correo o contraseña incorrectos. Comprueba que la cuenta esté creada en Authentication → Users.',
  'auth/wrong-password':'Correo o contraseña incorrectos.',
  'auth/user-not-found':'No encontramos esta cuenta. Revísala en Firebase Authentication → Users.',
  'auth/invalid-email':'El correo electrónico no es válido.',
  'auth/too-many-requests':'Firebase bloqueó temporalmente los intentos. Espera y utiliza Recuperar contraseña si corresponde.',
  'auth/user-disabled':'Esta cuenta está desactivada en Firebase Authentication.',
  'auth/network-request-failed':'No hay conexión con Firebase. Prueba con Chrome o Safari y revisa tu conexión.',
  'auth/operation-not-allowed':'Activa Email/Password en Firebase Authentication → Sign-in method.',
  'auth/configuration-not-found':'No está configurado el proveedor Email/Password para este proyecto.',
  'auth/unauthorized-domain':'Añade el dominio de esta página en Firebase Authentication → Authorized domains.',
  'auth/api-key-not-valid':'La configuración API del proyecto Firebase no está funcionando.',
  'auth/invalid-api-key':'La clave de configuración pública de Firebase es incorrecta.',
  'auth/quota-exceeded':'Se alcanzó temporalmente un límite de Firebase. Reintenta más tarde.',
  'auth/requires-recent-login':'Por seguridad, cierra sesión y vuelve a entrar.',
  'auth/invalid-action-code':'Enlace de verificación vencido o usado. Solicita uno nuevo.'
 };
 const description=dictionary[code]||'Firebase rechazó la operación. Si persiste, informa el código mostrado.';
 return description+(code?' (Código: '+code+')':'');
}
function showForm(){
 form.hidden=false;
 actions.hidden=true;
}
function showUser(email){
 form.hidden=true;
 actions.hidden=false;
 byId('fb-account').textContent='Sesión de: '+email;
}
let activeDiagnosis=0;
async function diagnoseUser(user,{refresh=false}={}){
 const run=++activeDiagnosis;
 showUser(user.email||'cuenta Firebase');
 if(refresh){
  try{await reload(user);}catch(e){notice(errorInfo(e),{warning:true});return;}
 }
 if(!user.emailVerified){
  notice('Inicio de sesión correcto. Ahora debes verificar tu correo. Pulsa «Enviar verificación», abre el mensaje y después «Ya verifiqué mi correo».',{warning:true});
  verify.hidden=false;
  recheck.hidden=false;
  return;
 }
 verify.hidden=true;
 recheck.hidden=true;
 notice('Inicio de sesión correcto y correo verificado. Comprobando tu rol en AURA…');
 try{
  // Evita bloqueos largos del refresco de token en navegadores integrados.
  // Una nueva comprobación manual sí refresca claims recién asignados.
  const token=await Promise.race([
   user.getIdToken(refresh),
   new Promise((_,reject)=>setTimeout(()=>reject(new Error('token-timeout')),12000))
  ]);
  if(run!==activeDiagnosis)return;
  const response=await fetch('/api/firebase-auth-check',{
   method:'GET',
   headers:{'X-AURA-Firebase-Token':token},
   cache:'no-store',
   signal:AbortSignal.timeout(12000)
  });
  if(run!==activeDiagnosis)return;
  if(response.status===404){
   notice('¡Firebase inició sesión correctamente! Falta publicar o reparar la API /api/firebase-auth-check de Azure. No es un problema de contraseña.',{warning:true});
   return;
  }
  if(response.status===401||response.status===403){
   let detail={};
   try{detail=await response.json();}catch{}
   if(detail.reason==='firebase-token-missing'){
    notice('Firebase inició sesión, pero el token no llegó al servidor. Comprueba que el despliegue esté actualizado. (HTTP 401)',{warning:true});
   }else if(detail.reason==='firebase-token-invalid'){
    notice('Firebase inició sesión, pero el servidor rechazó el token de identidad. Cierra sesión, vuelve a ingresar y comprueba el proyecto de Firebase. (HTTP 401)',{warning:true});
   }else if(detail.reason==='verify-email'){
    notice('Firebase requiere verificar tu correo electrónico. Cierra sesión y vuelve a entrar tras verificarlo.',{warning:true});
   }else{
    notice('El servicio de Azure rechazó la comprobación. No es un error de tu contraseña. (HTTP '+response.status+')',{warning:true});
   }
   return;
  }
  if(response.status===503){
   notice('¡Firebase inició sesión correctamente! La API de Azure no logró verificar el token. Comprueba la ejecución de Azure Functions.',{warning:true});
   return;
  }
  if(!response.ok){
   notice('¡Firebase inició sesión correctamente! Falló la comprobación del servidor (HTTP '+response.status+').',{warning:true});
   return;
  }
  const result=await response.json();
  if(result.authorized){
   notice('¡Cuenta verificada! Rol AURA: '+result.role+'. Esta versión es una prueba de acceso; el panel privado todavía necesita completar su integración.',{ok:true});
  }else{
   notice('¡Inicio de sesión correcto! Tu cuenta aún no tiene un rol de AURA (administrator/editor/viewer). Debe asignarlo la administración mediante un procedimiento seguro; el CMS permanece restringido.',{warning:true});
  }
 }catch(error){
  if(run!==activeDiagnosis)return;
  const label=error?.name==='TimeoutError'||error?.message==='token-timeout'?'La verificación tardó demasiado':'No se pudo consultar la API de Azure';
  notice('¡Firebase inició sesión correctamente! '+label+'. El acceso al editor sigue pendiente, pero no necesitas restablecer tu contraseña.',{warning:true});
 }
}

form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 const email=emailInput.value.trim();
 submit.disabled=true;
 notice('Comprobando correo y contraseña en Firebase…');
 try{
  const result=await signInWithEmailAndPassword(auth,email,passwordInput.value);
  passwordInput.value='';
  // La identidad ya se autenticó: actualiza explícitamente el estado aunque
  // onAuthStateChanged se ejecute antes, después o solo al restaurar la sesión.
  notice('Sesión de Firebase iniciada. Comprobando permisos de AURA…',{ok:true});
  await diagnoseUser(result.user);
 }catch(error){
  // Firebase puede haber autenticado correctamente aunque Azure esté caído.
  if(auth.currentUser){
   notice('Tu sesión de Firebase está activa. No hemos podido completar la comprobación del rol en Azure.',{warning:true});
  }else{
   notice(errorInfo(error),{warning:true});
  }
 }finally{submit.disabled=false;}
});
reset.addEventListener('click',async()=>{
 const email=emailInput.value.trim();
 if(!email){notice('Escribe primero tu correo y pulsa Recuperar contraseña.',{warning:true});emailInput.focus();return;}
 try{
  await sendPasswordResetEmail(auth,email);
  notice('Si la cuenta existe, recibirás un correo para recuperar la contraseña.',{ok:true});
 }catch(error){notice(errorInfo(error),{warning:true});}
});
verify.addEventListener('click',async()=>{
 const user=auth.currentUser;
 if(!user)return;
 verify.disabled=true;
 try{
  await sendEmailVerification(user);
  notice('Verificación enviada. Abre el correo, usa el enlace y luego pulsa «Ya verifiqué mi correo».');
 }catch(error){notice(errorInfo(error),{warning:true});}
 finally{verify.disabled=false;}
});
recheck.addEventListener('click',async()=>{
 const user=auth.currentUser;
 if(user)await diagnoseUser(user,{refresh:true});
});
logout.addEventListener('click',async()=>{
 try{activeDiagnosis++;await signOut(auth);showForm();notice('Sesión cerrada. Ahora puedes acceder con otra cuenta.');}
 catch(error){notice(errorInfo(error),{warning:true});}
});
onAuthStateChanged(auth,user=>{
 if(!user){showForm();notice('Escribe la cuenta creada en Firebase Authentication → Users.');return;}
 diagnoseUser(user).catch(()=>notice('Error al comprobar la cuenta. Reintenta iniciar sesión.',{warning:true}));
},error=>{
 showForm();
 notice(errorInfo(error),{warning:true});
});
