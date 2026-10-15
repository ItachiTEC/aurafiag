import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const paths=['src/index.html','src/assets/app.js','src/assets/content.js','src/assets/styles.css','src/participa/index.html','src/admin/index.html','src/staticwebapp.config.json','api/host.json','api/src/functions/messages.js','api/src/functions/cms.js','api/src/index.js','scripts/test-functions-bootstrap.cjs','src/assets/cms.js','src/entradas/index.html','src/login/index.html','src/403.html','src/assets/auth.css','src/assets/auth.js'];
for(const f of paths){if(!existsSync(resolve(f)))throw new Error('Falta archivo: '+f);}
for(const f of ['src/assets/app.js','src/assets/content.js','src/assets/cms.js','src/assets/auth.js','api/src/functions/messages.js','api/src/functions/cms.js','api/src/index.js'])execFileSync('node',['--check',f]);
const config=JSON.parse(readFileSync('src/staticwebapp.config.json','utf8'));
if(!config.routes.some(x=>x.route==='/api/admin/*'&&x.allowedRoles?.includes('administrator')))throw new Error('API admin sin protección.');
if(!config.routes.some(x=>x.route==='/admin*'&&x.allowedRoles?.includes('administrator')))throw new Error('Página admin sin protección.');
console.log('Revisión básica correcta.');
