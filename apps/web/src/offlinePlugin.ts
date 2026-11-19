import type {Plugin} from 'vite';
// Generated icon PNGs, no binary dependencies. PNG uses stored DEFLATE blocks.
function icon(n:number):Uint8Array{
 const raw=new Uint8Array(n*(1+3*n));const rgb=(hex:number)=>[hex>>16&255,hex>>8&255,hex&255];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=x/n*192,b=y/n*192,dx=Math.abs(a-96),dy=Math.abs(b-96);
 let color=0x102932;
 if(dx<=70&&dy<=80-dx*4/7)color=0xd8bf83;
 if(dx<=64&&dy<=73-dx*4/7)color=0x214b59;
 if(a>=59&&a<=133&&b>=70&&b<=130||b>=58&&b<70&&(a>=69&&a<=82||a>=110&&a<=123))color=0xd8bf83;
 if(a>=86&&a<=106&&b>=106&&b<=130||b>=96&&b<106&&Math.abs(a-96)<=b-96)color=0x102932;
 raw.set(rgb(color),y*(1+3*n)+1+x*3);
 }
 const u32=(v:number)=>[v>>>24,v>>>16&255,v>>>8&255,v&255];
 const chunk=(name:string,data:number[])=>{const bytes=[...Array.from(name,x=>x.charCodeAt(0)),...data];let crc=-1;for(const v of bytes){crc^=v;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return [...u32(data.length),...bytes,...u32((crc^-1)>>>0)];};
 const z=[0x78,0x01];let a=1,b=0;
 for(let i=0;i<raw.length;i+=65535){const block=raw.subarray(i,i+65535),len=block.length;z.push(i+len===raw.length?1:0,len&255,len>>>8,~len&255,(~len>>>8)&255);for(const v of block){z.push(v);a=(a+v)%65521;b=(b+a)%65521;}}
 z.push(...u32((b<<16|a)>>>0));
 return Uint8Array.from([137,80,78,71,13,10,26,10,...chunk('IHDR',[...u32(n),...u32(n),8,2,0,0,0]),...chunk('IDAT',z),...chunk('IEND',[])]);
}
export function offlinePlugin():Plugin{return {
 name:'orvane-offline',apply:'build',enforce:'post',
 generateBundle(_options,bundle){
 const icons=['icon-192.png','icon-512.png'];
 for(const n of [192,512])this.emitFile({type:'asset',fileName:'icon-'+n+'.png',source:icon(n)});
 const manifest={name:'Founders of Orvane',short_name:'Orvane',id:'./',start_url:'./',scope:'./',display:'standalone',background_color:'#102932',theme_color:'#102932',icons:icons.map((src,i)=>({src,sizes:i===0?'192x192':'512x512',type:'image/png',purpose:'any'}))};
 this.emitFile({type:'asset',fileName:'manifest.webmanifest',source:JSON.stringify(manifest)});
 const assets=[...new Set(['./','index.html',...Object.keys(bundle).filter(n=>!n.endsWith('.map')),...icons,'manifest.webmanifest'])];
 const version=Object.keys(bundle).filter(n=>n.startsWith('assets/')).sort().join('|')+'|0.8.4';
 const sw=`const ROOT=self.registration.scope;
const PREFIX='orvane:'+ROOT+':';
const CACHE=PREFIX+${JSON.stringify(version)};
const FILES=${JSON.stringify(assets)}.map(p=>new URL(p,ROOT).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const r=event.request,u=new URL(r.url);if(r.method!=='GET'||!u.href.startsWith(ROOT))return;
if(r.mode==='navigate'&&(u.pathname===new URL(ROOT).pathname||u.pathname===new URL('index.html',ROOT).pathname)){event.respondWith(caches.open(CACHE).then(c=>c.match(new URL('index.html',ROOT).href)).then(x=>x||fetch(r)));return;}
if(FILES.includes(u.href))event.respondWith(caches.open(CACHE).then(c=>c.match(r)).then(x=>x||fetch(r)));
});`;
 this.emitFile({type:'asset',fileName:'sw.js',source:sw});
 }
};}
