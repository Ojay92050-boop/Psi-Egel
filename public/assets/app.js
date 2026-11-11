
(()=>{'use strict';
const $=id=>document.getElementById(id),PROTOCOL='psi-cliente-integrado-v1';
const cfg=JSON.parse($('client-config').textContent),payload=JSON.parse($('embedded-bank').textContent);
let configured='',channel='',bridgeWindow=null,bridgeOrigin='',opening=false,generation=0,leaseDeadline=0,leaseTimer=null,connectTimer=null;
function validUrl(value){try{const u=new URL(value.trim());if(u.protocol!=='https:'||u.hostname!=='script.google.com'||u.search||u.hash||!/^\/macros\/s\/[a-zA-Z0-9_-]{25,}\/exec$/.test(u.pathname))return '';return u.href;}catch{return '';}}
function bridgeOriginAllowed(origin){try{const u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='script.google.com'||/^(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(u.hostname));}catch{return false;}}
// Se guarda un secreto aleatorio en este navegador o instalación, nunca en el HTML exportado.
function zDeviceInfo(){
  try{
    const storageKey='psi-z-device-v1';let key=localStorage.getItem(storageKey);
    if(key&&!/^[a-f0-9]{64}$/.test(key))throw Error('Registro inválido');
    if(!key){key=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(storageKey,key);if(localStorage.getItem(storageKey)!==key)throw Error('No se pudo guardar');}
    return {deviceKey:key,deviceKind:navigator.userAgent.includes('PSI-Z-Android')?'android':'browser'};
  }catch{fail('No se pudo guardar el registro de este dispositivo. Permite el almacenamiento de la aplicación y vuelve a intentar.');return null;}
}

function send(type){if(!bridgeWindow)return;const device=type==='connect'?zDeviceInfo():{};if(!device)return;bridgeWindow.postMessage({protocol:PROTOCOL,channel,bundleId:payload.id,type,...device},bridgeOrigin);}
function lock(){clearTimeout(connectTimer);clearTimeout(leaseTimer);leaseDeadline=0;generation++;opening=false;$('study-frame').removeAttribute('srcdoc');$('study-page').classList.add('hide');$('service-frame').classList.remove('hide');$('connection').classList.add('hide');}
function fail(message){lock();$('service-frame').classList.add('hide');$('setup').classList.remove('hide');$('message').textContent=message;}
function bytes(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}

function validLease(seconds){return Number.isInteger(seconds)&&seconds>=1&&seconds<=180;}
function leaseAlive(){return leaseDeadline>performance.now();}
function expireLease(){send('logout');lock();}
function grantLease(data){const remaining=Math.min(data.leaseSeconds*1000,data.clientLeaseUntil-(performance.timeOrigin+performance.now()));if(!validLease(data.leaseSeconds)||!Number.isFinite(data.clientLeaseUntil)||!Number.isFinite(remaining)||remaining<=0){expireLease();return false;}clearTimeout(leaseTimer);leaseDeadline=performance.now()+remaining;leaseTimer=setTimeout(expireLease,remaining);return true;}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&leaseDeadline&&!leaseAlive())expireLease();});
window.addEventListener('focus',()=>{if(leaseDeadline&&!leaseAlive())expireLease();});

async function openStudy(data){
 if(!validLease(data.leaseSeconds)){expireLease();return;}
 if(opening)return;opening=true;const current=++generation;
 try{
  if(!/^[A-Za-z0-9+/]{43}=$/.test(data.key)||typeof data.storageKey!=='string'||!/^psi-egel-cliente-v1-[a-zA-Z0-9_-]{1,100}$/.test(data.storageKey))throw Error('No se pudo validar el permiso de estudio.');
  if(!grantLease(data))return;
  $('connection-message').textContent='Preparando tus 4,500 preguntas de práctica…';$('connection').classList.remove('hide');
  const key=await crypto.subtle.importKey('raw',bytes(data.key),'AES-GCM',false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(payload.iv),additionalData:new TextEncoder().encode(payload.id)},key,bytes(payload.data));
  const sourceBytes=new Uint8Array(await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',sourceBytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(digest!==payload.id)throw Error('El banco incluido no pasó la comprobación de integridad.');
  const source=new TextDecoder().decode(sourceBytes);
  if(source.split("const KEY='psi-egel-v1';").length!==2)throw Error('No se pudo preparar el progreso de esta cuenta.');
  if(current!==generation||!leaseAlive())return;
  $('study-frame').srcdoc=source.replace("const KEY='psi-egel-v1';",'const KEY='+JSON.stringify(data.storageKey)+';');
  $('account-name').textContent=(typeof data.name==='string'?data.name.slice(0,120):'Tu cuenta')+' · PSI cliente z';
  $('setup').classList.add('hide');$('service-frame').classList.add('hide');$('connection').classList.add('hide');$('study-page').classList.remove('hide');
 }catch(error){if(current===generation){send('logout');fail('No se pudo abrir el banco incluido. '+(error.message||'Vuelve a intentar.'));}}finally{opening=false;}
}
window.addEventListener('message',event=>{
 const data=event.data;if(!data||data.protocol!==PROTOCOL||data.channel!==channel||data.bundleId!==payload.id||!bridgeOriginAllowed(event.origin))return;
 if(data.type==='ready'){
  if(bridgeWindow&&bridgeWindow!==event.source)return;
  bridgeWindow=event.source;bridgeOrigin=event.origin;send('connect');return;
 }
 if(event.source!==bridgeWindow||event.origin!==bridgeOrigin)return;
 if(data.type==='connected'){clearTimeout(connectTimer);$('connection').classList.add('hide');return;}
 if(data.type==='lease'){if(!leaseDeadline)return;if(!leaseAlive()){expireLease();return;}grantLease(data);return;}
 if(data.type==='access'){void openStudy(data);return;}
 if(data.type==='locked')lock();
});
function start(url){
 configured=url;clearTimeout(connectTimer);clearTimeout(leaseTimer);leaseDeadline=0;generation++;bridgeWindow=null;bridgeOrigin='';opening=false;
 if(window.isSecureContext===false||!crypto.subtle||typeof DecompressionStream==='undefined'){fail('Abre esta página mediante HTTPS en un navegador actualizado para entrar a estudiar.');return;}
 channel=crypto.randomUUID().replace(/-/g,'');const service=new URL(url);service.searchParams.set('cliente','integrado-v1');service.searchParams.set('perfil','z');service.searchParams.set('paquete',payload.id);service.searchParams.set('canal',channel);
 $('setup').classList.add('hide');$('study-page').classList.add('hide');$('study-frame').removeAttribute('srcdoc');$('connection').classList.remove('hide');$('service-frame').classList.remove('hide');$('service-frame').src=service.href;
 connectTimer=setTimeout(()=>{fail('La conexión está tardando más de lo esperado. Comprueba tu conexión a internet y vuelve a intentar.');},45000);
}
$('service-frame').onerror=()=>fail('No se pudo cargar el acceso. Comprueba tu conexión a internet y vuelve a intentar.');
$('logout-button').onclick=()=>{send('logout');lock();};
function retry(){const url=validUrl(configured||cfg.serviceUrl||'');if(url)start(url);}
$('retry-client').onclick=retry;
$('retry-setup').onclick=retry;
const url=validUrl(cfg.serviceUrl||'');if(url)start(url);else{fail('No se pudo preparar tu acceso. Comunícate con tu administrador.');}
})();
