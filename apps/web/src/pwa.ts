/// <reference types="vite/client" />
import {useEffect,useState} from 'react';
interface InstallPrompt extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>}
export function usePwa(){
 const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[offline,setOffline]=useState(!navigator.onLine),[ready,setReady]=useState(false),[error,setError]=useState(false),[installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
 useEffect(()=>{
   const before=(e:Event)=>{e.preventDefault();setPrompt(e as InstallPrompt);};
   const done=()=>{setInstalled(true);setPrompt(null);};
   const status=()=>setOffline(!navigator.onLine);
   window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);window.addEventListener('online',status);window.addEventListener('offline',status);
   if('serviceWorker' in navigator&&import.meta.env.PROD){
     navigator.serviceWorker.register(new URL('./sw.js',document.baseURI)).then(()=>navigator.serviceWorker.ready).then(()=>setReady(true)).catch(()=>setError(true));
   }
   return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);window.removeEventListener('online',status);window.removeEventListener('offline',status);};
 },[]);
 return {ready,offline,error,installed,canInstall:!!prompt,install:async()=>{if(!prompt)return;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setInstalled(true);}finally{setPrompt(null);}}};
}
