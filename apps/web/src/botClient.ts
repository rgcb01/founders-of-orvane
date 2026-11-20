import {decide,publicRequest,type BotRequest,type BotAnswer,type WorkerAnswer} from './botProtocol';
type Port=Pick<Worker,'postMessage'|'terminate'|'onmessage'|'onerror'|'onmessageerror'>;
export class BotClient{
 private worker:Port|null=null;
 private sequence=0;
 private pending:{id:number;resolve:(a:BotAnswer)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}|null=null;
 private fallback=false;
 constructor(private readonly factory:()=>Port=()=>new Worker(new URL('./bot.worker.ts',import.meta.url),{type:'module'})){}
 private close(){this.worker?.terminate();this.worker=null;}
 cancel(){
   const p=this.pending;this.pending=null;if(p){clearTimeout(p.timer);this.close();p.reject(new Error('Bot request cancelled'));}
 }
 dispose(){this.cancel();this.close();}
 private start(){
   if(this.worker||this.fallback)return;
   try{
     const w=this.factory();this.worker=w;
     w.onmessage=(e:MessageEvent<WorkerAnswer>)=>{const p=this.pending;if(!p||e.data.id!==p.id||this.worker!==w)return;clearTimeout(p.timer);this.pending=null;if('error' in e.data)p.reject(new Error(e.data.error));else p.resolve(e.data.answer);};
     const failed=()=>{if(this.worker!==w)return;const p=this.pending;this.pending=null;this.close();this.fallback=true;if(p){clearTimeout(p.timer);p.reject(new Error('Background AI unavailable; retry to use compatibility mode.'));}};
     w.onerror=failed;w.onmessageerror=failed;
   }catch{this.fallback=true;}
 }
 request(raw:BotRequest):Promise<BotAnswer>{
   this.cancel();this.start();const request=publicRequest(raw);
   if(this.fallback)return Promise.resolve().then(()=>decide(request));
   const w=this.worker!,id=++this.sequence;
   return new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{if(this.pending?.id!==id)return;this.pending=null;this.close();reject(new Error('Bot decision timed out. Retry.'));},15000);
     this.pending={id,resolve,reject,timer};
     try{w.postMessage({id,request});}catch(e){clearTimeout(timer);this.pending=null;this.close();reject(e instanceof Error?e:new Error('Bot transport failed'));}
   });
 }
}
