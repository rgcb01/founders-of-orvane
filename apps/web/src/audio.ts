import {useEffect,useRef,useState} from 'react';
import {scheduleAmbientBar} from './ambient';
import type {Cue} from './soundEvents';

type Note=[frequency:number,start:number,duration:number,type?:OscillatorType,volume?:number];
const tones:Record<Cue,Note[]>={
 spend:[[294,0,.08,'triangle'],[220,.08,.12,'triangle']],
 steal:[[330,0,.09,'triangle'],[196,.1,.16,'triangle']],
 select:[[520,0,.055,'sine',.12]],
 production:[[523,0,.12,'sine'],[659,.12,.15,'sine'],[784,.24,.2,'sine']],
 dice:[[145,0,.055,'triangle'],[220,.065,.055,'triangle'],[175,.13,.055,'triangle'],[330,.20,.10,'triangle']],
 road:[[190,0,.10,'triangle'],[290,.09,.10,'triangle']],
 settlement:[[262,0,.14,'triangle'],[392,.09,.16,'sine'],[523,.18,.20,'sine']],
 city:[[262,0,.18,'triangle'],[330,.09,.18,'triangle'],[392,.18,.18,'triangle'],[523,.27,.25,'sine']],
 trade:[[660,0,.10,'sine'],[880,.10,.16,'sine']],
 offer:[[440,0,.12,'sine'],[554,.14,.20,'sine']],
 card:[[330,0,.08,'triangle'],[660,.08,.14,'sine']],
 robber:[[196,0,.18,'triangle'],[147,.16,.23,'triangle']],
 discard:[[220,0,.07,'triangle'],[165,.08,.13,'triangle']],
 turn:[[392,0,.10,'sine'],[523,.10,.18,'sine']],
 award:[[392,0,.15,'triangle'],[523,.12,.16,'triangle'],[659,.24,.25,'sine']],
 start:[[262,0,.16,'triangle'],[330,.12,.17,'triangle'],[392,.24,.22,'sine']],
 victory:[[262,0,.18,'triangle'],[330,.12,.18,'triangle'],[392,.24,.20,'triangle'],[523,.36,.30,'sine'],[659,.48,.32,'sine'],[784,.60,.40,'sine']],
 defeat:[[392,0,.2,'sine'],[330,.18,.2,'sine'],[262,.36,.35,'triangle']]
};
const key='orvane.audio.v1';
function load():{enabled:boolean;volume:number;bots:boolean;music:boolean;musicVolume:number;haptic:boolean}{
 try{const saved=JSON.parse(localStorage.getItem(key)??'null');if(saved&&typeof saved.enabled==='boolean'&&typeof saved.bots==='boolean'&&typeof saved.volume==='number'&&Number.isFinite(saved.volume))return {enabled:saved.enabled,bots:saved.bots,volume:Math.max(0,Math.min(1,saved.volume)),music:saved.music===true,musicVolume:typeof saved.musicVolume==='number'&&Number.isFinite(saved.musicVolume)?Math.max(0,Math.min(1,saved.musicVolume)):.25,haptic:saved.haptic===true};}catch{}
 return {enabled:true,volume:.45,bots:false,music:false,musicVolume:.25,haptic:false};
}
export function useGameAudio(musicId='classic-music'){
 const [settings,setSettings]=useState(load);
 const [ready,setReady]=useState(false);
 const context=useRef<AudioContext|null>(null),master=useRef<GainNode|null>(null),musicGain=useRef<GainNode|null>(null),last=useRef(-Infinity);
 const config=useRef(settings);config.current=settings;
 async function unlock(){
   if(!config.current.enabled)return;
   try{
     if(!context.current){
       const Audio=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
       if(!Audio)return;
       context.current=new Audio();master.current=context.current.createGain();master.current.gain.value=config.current.volume;master.current.connect(context.current.destination);musicGain.current=context.current.createGain();musicGain.current.gain.value=config.current.musicVolume;musicGain.current.connect(context.current.destination);
     }
     const ctx=context.current;
     if(ctx.state==='running')setReady(true);
     else {await ctx.resume();setReady(true);}
   }catch{}
 }
 useEffect(()=>{
   const onGesture=()=>{void unlock();};
   window.addEventListener('pointerdown',onGesture);window.addEventListener('keydown',onGesture);
   return ()=>{window.removeEventListener('pointerdown',onGesture);window.removeEventListener('keydown',onGesture);};
 },[]);
 useEffect(()=>{
   try{localStorage.setItem(key,JSON.stringify(settings));}catch{}
   if(master.current&&context.current)master.current.gain.setValueAtTime(settings.enabled?settings.volume:0,context.current.currentTime);
 },[settings]);
 useEffect(()=>{
   const ctx=context.current,out=musicGain.current;
   if(!ctx||!out||!ready)return;
   out.gain.setValueAtTime(settings.enabled&&settings.music?settings.musicVolume:0,ctx.currentTime);
 },[settings.enabled,settings.music,settings.musicVolume,ready]);
 useEffect(()=>{
   if(!ready||!settings.enabled||!settings.music)return;
   let cancelBar:(()=>void)|undefined,index=0;
   const playBar=()=>{const ctx=context.current,out=musicGain.current;if(!document.hidden&&ctx&&out&&ctx.state==='running'){cancelBar?.();cancelBar=scheduleAmbientBar(ctx,out,index++,musicId);}};
   const visibility=()=>{if(document.hidden){cancelBar?.();cancelBar=undefined;}else playBar();};
   playBar();const timer=window.setInterval(playBar,4480);document.addEventListener('visibilitychange',visibility);
   return()=>{window.clearInterval(timer);cancelBar?.();document.removeEventListener('visibilitychange',visibility);};
 },[ready,settings.enabled,settings.music,musicId]);
 function play(cue:Cue,bot=false){
   const ctx=context.current,out=master.current,s=config.current;
   if(!s.enabled||!ctx||!out||ctx.state!=='running'||(bot&&!s.bots))return;
   const urgent=['victory','defeat','offer','turn','robber','award'].includes(cue)&&!bot;
   const now=ctx.currentTime;
   if(!urgent&&now-last.current<.16)return;
   last.current=now;
   for(const [frequency,start,duration,type='sine',volume=.20] of tones[cue]){
     const t=now+start,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.value=frequency;
     gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
     osc.connect(gain);gain.connect(out);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.015);
   }
 }
 function toggle(){
   const enabled=!config.current.enabled;
   config.current={...config.current,enabled};setSettings(config.current);
   if(enabled)void unlock();
 }
 return {settings,ready,unlock,play,toggle,toggleMusic:()=>setSettings(s=>({...s,music:!s.music})),setMusicVolume:(musicVolume:number)=>setSettings(s=>({...s,musicVolume})),toggleHaptic:()=>setSettings(s=>({...s,haptic:!s.haptic})),setVolume:(volume:number)=>setSettings(s=>({...s,volume})),toggleBots:()=>setSettings(s=>({...s,bots:!s.bots}))};
}
