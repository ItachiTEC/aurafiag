/* Acceso Firebase a AURA: identidad; no concede permisos de edición por sí solo. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,sendPasswordResetEmail,sendEmailVerification,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {firebaseConfig} from '/assets/firebase-config.js';

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
auth.languageCode='es';
const form=document.getElementById('firebase-login-form');
const emailInput=document.getElementById('fb-email');
const passwordInput=document.getElementById('fb-password');
const submit=document.getElementById('fb-login-submit');
const status=document.getElementById('fb-status');
const actions=document.getElementById('fb-actions');
const verify=document.getElementById('fb-verify-email');
const logout=document.getElementById('fb-logout');
const reset=document.getElementById('fb-reset');
function state(message,warning=false){status.textContent=message;status.classList.toggle('auth-status-warning',warning);status.classList.toggle('auth-status-ok',!warning);}
function friendly(error){
 const code=String(error?.code||'');
 const texts={
  'auth/invalid-credential':'Credenciales incorrectas. Comprueba el correo y la contraseña.',
  'auth/invalid-email':'El correo no es válido.',
  'auth/too-many-requests':'Demasiados intentos. Espera e inténtalo después.',
  'auth/user-disabled':'Esta cuenta ha sido desactivada.',
  'auth/network-request-failed':'No se pudo conectar con Firebase.',
  'auth/operation-not-allowed':'Activa Correo electrónico/contraseña en Firebase Authentication.',
  'auth/unauthorized-domain':'Agrega el dominio de AURA en Firebase Authentication → Authorized domains.'
 };
 return texts[code]||'No se pudo completar la operación. Revisa la configuración de Firebase.';
}
form.addEventListener('submit',async e=>{
 e.preventDefault();
 const email=emailInput.value.trim();
 if(!email||!passwordInput.value)return;
 submit.disabled=true;state('Validando la cuenta con Firebase…');
 try{
  await signInWithEmailAndPassword(auth,email,passwordInput.value);
  passwordInput.value='';
 }catch(err){state(friendly(err),true);}
 finally{submit.disabled=false;}
});
reset.addEventListener('click',async()=>{
 const email=emailInput.value.trim();
 if(!email){state('Escribe primero tu correo para recuperar la contraseña.',true);return;}
 try{await sendPasswordResetEmail(auth,email);state('Si la cuenta existe, recibirás instrucciones para recuperar el acceso.');}
 catch(err){state(friendly(err),true);}
});
verify.addEventListener('click',async()=>{
 if(!auth.currentUser)return;
 try{await sendEmailVerification(auth.currentUser);state('Se envió la verificación. Abre el correo y vuelve a entrar.');}
 catch(err){state(friendly(err),true);}
});
logout.addEventListener('click',async()=>{
 await signOut(auth);form.hidden=false;actions.hidden=true;state('Sesión cerrada. Puedes iniciar sesión con otra cuenta.');
});
onAuthStateChanged(auth,async user=>{
 if(!user){form.hidden=false;actions.hidden=true;state('Ingresa con el correo y la contraseña que te asignaron.');return;}
 form.hidden=true;actions.hidden=false;
 if(!user.emailVerified){state('Sesión iniciada. Falta verificar el correo para solicitar acceso al panel.',true);return;}
 state('Correo verificado. Comprobando autorización en el servidor…');
 try{
  const token=await user.getIdToken(true);
  const response=await fetch('/api/firebase-auth-check',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(response.status===404){state('Firebase inició sesión, pero Azure todavía no tiene disponible la API de comprobación. El CMS sigue protegido.',true);return;}
  const data=await response.json();
  if(!response.ok){state('No se pudo comprobar el acceso del encargado. La edición sigue deshabilitada.',true);return;}
  if(data.authorized){state('Identidad verificada. Rol reconocido: '+data.role+'. La activación del nuevo panel aún está pendiente.');}
  else{state('Sesión válida, pero todavía no tienes rol AURA de editor o administrador. Debe asignarlo un encargado autorizado.',true);}
 }catch{state('Sesión en Firebase, pero no se pudo verificar la autorización con Azure. Intenta más tarde.',true);}
});
