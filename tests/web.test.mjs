import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash, createCipheriv, randomBytes, webcrypto} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
import {createPreviewServer} from '../scripts/preview.mjs';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const code = await readFile(new URL('../public/assets/app.js', import.meta.url), 'utf8');
const bank = JSON.parse(html.match(/<script id="embedded-bank" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const config = JSON.parse(html.match(/<script id="client-config" type="application\/json">([\s\S]*?)<\/script>/)[1]);
// Permisos y banco sintéticos: no se incluyen contraseñas ni claves del banco real.
const source = "<!doctype html><html lang='es'><body>Prueba de apertura<script>const KEY='psi-egel-v1';</script></body></html>";
const id = createHash('sha256').update(source).digest('hex');
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(Buffer.from(id));
const encrypted = Buffer.concat([cipher.update(gzipSync(source)), cipher.final(), cipher.getAuthTag()]);
const fixture = {version:1,id,algorithm:'AES-GCM',compression:'gzip',iv:iv.toString('base64'),data:encrypted.toString('base64'),total:4500};
const origin = 'https://n-prueba-script.googleusercontent.com';

function runtime({store=new Map(),storageBlocked=false,secure=true,payload=fixture}={}) {
  const nodes = new Map(), events = new Map(), docEvents = new Map(), sent = [], timers = new Map();
  let now=0, serial=0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {textContent:'',classList:{hidden:false,add(){this.hidden=true;},remove(){this.hidden=false;}},removeAttribute(name){delete this[name];}});
    return nodes.get(id);
  };
  node('client-config').textContent=JSON.stringify({...config,bundleId:payload.id});
  node('embedded-bank').textContent=JSON.stringify(payload);
  const document = {getElementById:node,visibilityState:'visible',addEventListener:(name,fn)=>docEvents.set(name,fn)};
  const bridge = {postMessage:(message,target)=>sent.push({message,target})};
  const context = {document,URL,crypto:webcrypto,isSecureContext:secure,navigator:{userAgent:'Navegador web'},localStorage:{getItem(name){if(storageBlocked)throw Error('Bloqueado');return store.get(name)||null;},setItem:(name,value)=>store.set(name,value)},TextEncoder,TextDecoder,Uint8Array,Blob,Response,DecompressionStream,atob,JSON,Error,Number,performance:{timeOrigin:0,now:()=>now},setTimeout:(fn,delay)=>{timers.set(++serial,{fn,at:now+delay});return serial;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>events.set(name,fn)};
  context.window=context;
  vm.runInNewContext(code,context);
  const service=node('service-frame').src ? new URL(node('service-frame').src) : null;
  const channel=service?.searchParams.get('canal');
  function emit(type,data={},options={}) {
    events.get('message')({origin:options.origin||origin,source:options.source||bridge,data:{protocol:'psi-cliente-integrado-v1',channel,bundleId:payload.id,type,...data}});
  }
  function connect() {emit('ready');emit('connected');}
  return {node,events,docEvents,document,service,sent,emit,connect,store,access:{key:key.toString('base64'),name:'Prueba web',storageKey:'psi-egel-cliente-v1-cuenta-equipo-demo',leaseSeconds:180,clientLeaseUntil:180000},advance(ms,flush=true){now+=ms;if(flush)for(const [timer,value]of [...timers])if(value.at<=now){timers.delete(timer);value.fn();}}};
}
async function opened(r) {
  for(let i=0;i<100;i++){if(r.node('study-frame').srcdoc)return;await new Promise(resolve=>setTimeout(resolve,5));}
  assert.fail('El banco de prueba no abrió.');
}

test('la web conserva el banco cifrado y solicita el perfil z al servicio configurado',()=>{
  assert.equal(bank.total,4500);assert.equal(config.bankCount,4500);assert.equal(bank.id,config.bundleId);
  assert.equal(bank.algorithm,'AES-GCM');assert.equal(bank.compression,'gzip');assert(Buffer.from(bank.data,'base64').length>1000000);
  const r=runtime();assert.equal(r.service.origin,'https://script.google.com');assert.equal(r.service.searchParams.get('perfil'),'z');assert.equal(r.service.searchParams.get('cliente'),'integrado-v1');assert.match(r.service.searchParams.get('canal'),/^[a-f0-9]{32}$/);
});
test('un permiso válido abre el banco y utiliza el progreso por cuenta o equipo recibido del servidor',async()=>{
  const r=runtime();r.connect();r.emit('access',r.access);await opened(r);
  assert(r.node('study-frame').srcdoc.includes('const KEY="psi-egel-cliente-v1-cuenta-equipo-demo";'));
  assert(!r.node('study-frame').srcdoc.includes("const KEY='psi-egel-v1';"));
});
test('mensajes de otro origen, otro canal u otra ventana no conceden ni renuevan acceso',async()=>{
  const r=runtime();r.emit('ready',{}, {origin:'https://ejemplo.invalid'});assert.equal(r.sent.length,0);
  r.connect();r.emit('access',{...r.access,channel:'canal-ajeno'});r.emit('access',r.access,{source:{}});assert.equal(r.node('study-frame').srcdoc,undefined);
  r.emit('access',r.access);await opened(r);r.advance(120000);r.emit('lease',{leaseSeconds:180,clientLeaseUntil:300000},{source:{}});r.advance(60000);assert.equal(r.node('study-frame').srcdoc,undefined);
});
test('la web no abre con una reserva ausente, vencida o superior al máximo del servicio',()=>{
  for(const leaseSeconds of [undefined,0,181,'180']){const r=runtime();r.connect();r.emit('access',{...r.access,leaseSeconds});assert.equal(r.node('study-frame').srcdoc,undefined);assert(r.sent.some(s=>s.message.type==='logout'));}
  const r=runtime();r.connect();r.advance(180001);r.emit('access',r.access);assert.equal(r.node('study-frame').srcdoc,undefined);
});
test('cerrar sesión o dejar vencer el permiso oculta y elimina el estudio',async()=>{
  for(const close of [r=>r.node('logout-button').onclick(),r=>r.advance(180000)]){const r=runtime();r.connect();r.emit('access',r.access);await opened(r);close(r);assert.equal(r.node('study-frame').srcdoc,undefined);assert(r.node('study-page').classList.hidden);}
});
test('la renovación auténtica mantiene el acceso y una respuesta tardía no revive la sesión',async()=>{
  const r=runtime();r.connect();r.emit('access',r.access);await opened(r);r.advance(120000);r.emit('lease',{leaseSeconds:180,clientLeaseUntil:300000});r.advance(100000);assert(r.node('study-frame').srcdoc);r.advance(80000);assert.equal(r.node('study-frame').srcdoc,undefined);r.emit('lease',{leaseSeconds:180,clientLeaseUntil:480000});assert.equal(r.node('study-frame').srcdoc,undefined);
});
test('al volver del segundo plano se bloquea un permiso vencido incluso con temporizadores suspendidos',async()=>{
  const r=runtime();r.connect();r.emit('access',r.access);await opened(r);r.advance(180001,false);r.events.get('focus')();assert.equal(r.node('study-frame').srcdoc,undefined);
});
test('el equipo persiste en el navegador y su secreto no se envía en la URL',()=>{
  const store=new Map(),a=runtime({store});a.connect();const device=a.sent.find(s=>s.message.type==='connect').message;assert.match(device.deviceKey,/^[a-f0-9]{64}$/);assert.equal(device.deviceKind,'browser');assert(!a.service.href.includes(device.deviceKey));const b=runtime({store});b.connect();assert.equal(b.sent[0].message.deviceKey,device.deviceKey);
});
test('el almacenamiento bloqueado o una página sin contexto seguro no habilitan el estudio',()=>{
  const a=runtime({storageBlocked:true});a.emit('ready');assert.equal(a.sent.length,0);assert.match(a.node('message').textContent,/registro de este dispositivo/);
  const b=runtime({secure:false});assert.equal(b.service,null);assert.match(b.node('message').textContent,/HTTPS/);
});
test('una conexión sin respuesta muestra un reintento y no expone controles de administrador',()=>{
  const r=runtime();r.advance(45000);assert.match(r.node('message').textContent,/conexión/);assert(r.node('service-frame').classList.hidden);const first=r.service.href;r.node('retry-setup').onclick();assert.notEqual(r.node('service-frame').src,first);assert(!html.includes('id="service-url"'));assert(!code.includes('save-client'));
});
test('el enlace confirmado cancela la espera inicial y el banco alterado se rechaza',async()=>{
  const r=runtime();r.connect();r.advance(45001);assert.equal(r.node('message').textContent,'');
  const changed=Buffer.from(encrypted);changed[0]^=1;const s=runtime({payload:{...fixture,data:changed.toString('base64')}});s.connect();s.emit('access',s.access);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(s.node('study-frame').srcdoc,undefined);assert.match(s.node('message').textContent,/No se pudo abrir/);
});
test('Netlify publica únicamente public y los recursos locales existen',async()=>{
  const toml=await readFile(new URL('../netlify.toml',import.meta.url),'utf8');assert.match(toml,/publish\s*=\s*"public"/);assert(!toml.includes('functions'));
  for(const asset of ['assets/app.js','assets/app.css','favicon.svg','404.html','_headers'])assert((await readFile(new URL('../public/'+asset,import.meta.url))).length>0);
  const names=await readdir(new URL('../',import.meta.url));for(const name of names)assert(!/^(?:Code\.gs|\.env|.*\.(?:p12|jks|apk|pem))$/.test(name));
});
test('la vista previa sirve la aplicación y sus recursos y rechaza archivos fuera de public',async()=>{
  const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/PSI Estudio/);
    const js=await fetch(base+'/assets/app.js');assert.equal(js.status,200);assert.match(js.headers.get('Content-Type'),/javascript/);
    for(const url of ['/README.md','/.env','/Code.gs','/..%5cpackage.json'])assert.equal((await fetch(base+url)).status,404);
    const missing=await fetch(base+'/ruta-inexistente');assert.equal(missing.status,404);assert.match(await missing.text(),/Volvamos/);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
