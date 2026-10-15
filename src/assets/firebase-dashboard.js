/* Panel de administración Firebase. El permiso NO depende de esta interfaz:
   cada petición a /api/firebase-admin/* valida token+rol y revocación en Azure. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {firebaseConfig} from '/assets/firebase-config.js';
import {mountCmsAdmin} from '/assets/cms.js';

const auth=getAuth(initializeApp(firebaseConfig));
const root=document.getElementById('fb-admin-root');
const status=document.getElementById('fb-admin-state');
const account=document.getElementById('fb-admin-user');
const logout=document.getElementById('fb-admin-logout');
let mounted=false;
const say=message=>{status.textContent=message;status.hidden=false;};
logout.addEventListener('click',async()=>{
 try{await signOut(auth);}finally{location.replace('/firebase-login/');}
});
onAuthStateChanged(auth,async user=>{
 if(!user){location.replace('/firebase-login/');return;}
 account.textContent=user.email||'Cuenta AURA';
 say('Comprobando rol de administrador…');
 try{
  await user.reload();
  if(!user.emailVerified){say('Verifica tu correo antes de utilizar el administrador.');return;}
  const token=await user.getIdToken(true);
  const response=await fetch('/api/firebase-auth-check',{
   headers:{'X-AURA-Firebase-Token':token},
   cache:'no-store',signal:AbortSignal.timeout(12000)
  });
  if(!response.ok){say('No se pudo comprobar tu sesión (HTTP '+response.status+'). Regresa al login e inténtalo nuevamente.');return;}
  const data=await response.json();
  if(!data.authorized||data.role!=='administrator'){say('Esta cuenta no tiene rol administrator para gestionar AURA.');return;}
  if(!mounted){
   mounted=true;status.hidden=true;
   await mountCmsAdmin(root,{firebaseToken:()=>user.getIdToken()});
  }
 }catch(error){say('No se pudo conectar con Azure: '+(error?.name==='TimeoutError'?'tiempo de espera agotado':'comprueba la API privada y reintenta'));}
});
