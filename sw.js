const BUILD='36';
const CACHE=`quintal-clean-release-${BUILD}`;
const BASE=new URL('./',self.location.href);
const url=path=>new URL(path,BASE).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const response=await fetch(url('release.json'),{cache:'no-store'});
  if(!response.ok)throw new Error('Manifesto da versao indisponivel');
  const release=await response.json();
  if(release.build!==BUILD)throw new Error('Versao inconsistente');
  const cache=await caches.open(CACHE);
  await cache.addAll(release.files.map(file=>new Request(url(file),{cache:'reload'})));
  const entry=await fetch(url('index.html'),{cache:'no-store'});
  if(!entry.ok)throw new Error('Entrada indisponivel');
  await cache.put(url('index.html'),entry);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('quintal-clean-')&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const target=new URL(event.request.url);
  if(target.origin!==BASE.origin||!target.pathname.startsWith(BASE.pathname))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(url('index.html'))));return;
  }
  if(target.pathname.includes(`/releases/${BUILD}/`)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE),cached=await cache.match(event.request);
      if(cached)return cached;
      const response=await fetch(event.request);
      if(response.ok)await cache.put(event.request,response.clone());
      return response;
    })());
  }
});
