import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const headers = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN','Cache-Control':'no-store'};

export function createPreviewServer() {
  return http.createServer(async (request, response) => {
    if (!['GET','HEAD'].includes(request.method)) {
      response.writeHead(405, {...headers, Allow:'GET, HEAD'}).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      const root = resolve(publicRoot);
      if (!file.startsWith(root + sep) || pathname.split(/[\\/]/).some(part => part.startsWith('.') || part === '_headers')) {
        response.writeHead(404, headers).end();
        return;
      }
      try {
        const content = await readFile(file);
        response.writeHead(200, {...headers, 'Content-Type':types[extname(file)] || 'application/octet-stream'});
        response.end(request.method === 'HEAD' ? undefined : content);
      } catch (error) {
        if (!['ENOENT','EISDIR'].includes(error.code)) throw error;
        response.writeHead(404, {...headers, 'Content-Type':types['.html']});
        response.end(request.method === 'HEAD' ? undefined : await readFile(resolve(root, '404.html')));
      }
    } catch {
      response.writeHead(400, headers).end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('El puerto no es válido.');
  const server = createPreviewServer();
  server.listen(port, '127.0.0.1', () => console.log('PSI Estudio: http://127.0.0.1:' + server.address().port));
  server.on('error', error => {console.error('No se pudo iniciar la vista previa: ' + error.message); process.exitCode = 1;});
}
