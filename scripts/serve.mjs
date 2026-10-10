import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
const root = resolve('src');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const server = createServer((req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Activa la API y Azure Table Storage en Azure para recibir mensajes.'}));return;}
    const path = resolve(root, '.' + normalize('/'+pathname));
    if (!path.startsWith(root+sep) && path!==root) throw new Error('Ruta no válida');
    let final=path; if(statSync(final).isDirectory()) final=join(final,'index.html');
    res.writeHead(200,{'Content-Type':types[extname(final)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(readFileSync(final));
  } catch {res.writeHead(404);res.end('No encontrado');}
});
server.listen(Number(process.env.PORT||8000),()=>console.log('Vista local: http://localhost:'+ (process.env.PORT||8000)));
