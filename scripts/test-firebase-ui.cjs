'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const read=path=>readFileSync(resolve(__dirname,'..',path),'utf8');
const html=read('src/firebase-login/index.html');
const js=read('src/assets/firebase-login.js');
const config=read('src/assets/firebase-config.js');
for(const required of ['fb-email','fb-password','firebase-login-form','fb-status','fb-verify-email','fb-recheck-email','fb-logout','fb-account']) {
 assert(html.includes('id="'+required+'"'), 'Missing Firebase login field: '+required);
}
assert(html.includes('/assets/firebase-login.js'),'Firebase login module missing');
assert(html.includes('__auraFirebaseModuleReady'),'SDK load diagnosis missing');
assert(js.includes('signInWithEmailAndPassword'),'Email and password authentication missing');
assert(js.includes('sendEmailVerification'),'Verification action missing');
assert(js.includes('await reload(user)'),'Email verification refresh missing');
assert(js.includes('/api/firebase-auth-check'),'Server verification call missing');
assert(js.includes("'X-AURA-Firebase-Token':token"),'Firebase token must use its own SWA header');
assert(!js.includes("'Authorization':'Bearer '+token"),'Azure may replace Authorization before Functions');
assert(js.includes('response.status===404'),'Azure API missing endpoint diagnosis absent');
assert(js.includes('Tu cuenta aún no tiene un rol')||js.includes('no tiene un rol de AURA'),'Unauthenticated roles must be clearly explained');
assert(!js.includes("location.href='/admin/'"),'Firebase login must not bypass Azure administrator role');
assert(config.includes('projectId: "aura-fiag"'),'Incorrect Firebase project');
console.log('Firebase UI: diagnóstico de inicio, verificación de correo, API y roles OK.');

const adminPage=read('src/firebase-admin/index.html');
const dashboard=read('src/assets/firebase-dashboard.js');
assert(adminPage.includes('firebase-dashboard.js'),'Firebase admin dashboard script missing');
assert(dashboard.includes('mountCmsAdmin(root,{firebaseToken:'),'CMS must use Firebase token provider');
assert(js.includes("'/firebase-admin/'")||read('src/firebase-login/index.html').includes('href="/firebase-admin/"'),'Administrator login must link to Firebase dashboard');
