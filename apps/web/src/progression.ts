import {validLoadout,DEFAULT_LOADOUT,equip,type Loadout} from './cosmetics';
import type {Difficulty} from '@orvane/engine';
import type {Result,Store} from './persistence';
export const PROFILE_KEY='orvane.profile.v1';
export interface LocalProfile {schema:1;id:string;createdAt:number;updatedAt:number;name:string;avatar:string;loadout?:Loadout}
export const AVATARS=[
 {id:'founder',icon:'👤',name:'Founder',level:1},
 {id:'settler',icon:'🌱',name:'Settler',level:2},
 {id:'builder',icon:'🛠️',name:'Builder',level:10},
 {id:'merchant',icon:'⚓',name:'Merchant',level:20},
 {id:'lord',icon:'🏰',name:'Lord',level:30},
 {id:'king',icon:'👑',name:'King',level:40},
 {id:'legend',icon:'🌟',name:'Legend',level:50},
] as const;
export const XP_PER_LEVEL=1000;
export const WIN_XP:Record<Difficulty,number>={easy:50,normal:100,hard:200,expert:350};
export function matchXP(r:Result){return r.humans===1?100+(r.winner===0&&r.difficulty?WIN_XP[r.difficulty]:0):0;}
const ACHIEVEMENTS=[
 {id:'first-match',icon:'🏝️',name:'Landfall',description:'Complete your first solo match.',xp:50,earned:(rs:Result[])=>rs.length>=1},
 {id:'first-win',icon:'🏆',name:'First crown',description:'Win your first solo match.',xp:100,earned:(rs:Result[])=>rs.some(r=>r.winner===0)},
 {id:'five-matches',icon:'📜',name:'Experienced founder',description:'Complete five solo matches.',xp:100,earned:(rs:Result[])=>rs.length>=5},
 {id:'ten-wins',icon:'👑',name:'Ten crowns',description:'Win ten solo matches.',xp:300,earned:(rs:Result[])=>rs.filter(r=>r.winner===0).length>=10},
 {id:'hard-win',icon:'⚔️',name:'Challenger',description:'Win against hard bots.',xp:200,earned:(rs:Result[])=>rs.some(r=>r.winner===0&&r.difficulty==='hard')},
 {id:'expert-win',icon:'🌟',name:'Master strategist',description:'Win against expert bots.',xp:350,earned:(rs:Result[])=>rs.some(r=>r.winner===0&&r.difficulty==='expert')},
 {id:'six-win',icon:'🏰',name:'Ruler of the island',description:'Win a six-player solo match.',xp:150,earned:(rs:Result[])=>rs.some(r=>r.winner===0&&r.players===6)},
] as const;
export function rankFor(level:number){return level>=50?'Legend of Orvane':level>=40?'King':level>=30?'Lord':level>=20?'Merchant':level>=10?'Builder':'Settler';}
export function progression(results:readonly Result[],profileId:string){
 const seen=new Set<string>();
 const solo=results.filter(r=>{if(r.humans!==1||(r.profileId&&r.profileId!==profileId)||seen.has(r.id))return false;seen.add(r.id);return true;});
 const achievements=ACHIEVEMENTS.map(({earned,...a})=>({...a,unlocked:earned(solo)}));
 const matchExperience=solo.reduce((n,r)=>n+matchXP(r),0);
 const achievementExperience=achievements.reduce((n,a)=>n+(a.unlocked?a.xp:0),0);
 const xp=matchExperience+achievementExperience,level=1+Math.floor(xp/XP_PER_LEVEL);
 return {xp,matchExperience,achievementExperience,level,levelXP:xp%XP_PER_LEVEL,nextXP:XP_PER_LEVEL,rank:rankFor(level),played:solo.length,wins:solo.filter(r=>r.winner===0).length,losses:solo.filter(r=>r.winner!==0).length,achievements,avatars:AVATARS.map(a=>({...a,unlocked:level>=a.level}))};
}
export function validateProfile(value:unknown):value is LocalProfile{
 if(!value||typeof value!=='object')return false;
 const p=value as Partial<LocalProfile>;
 return p.schema===1&&typeof p.id==='string'&&p.id.length>0&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=24&&typeof p.createdAt==='number'&&Number.isSafeInteger(p.createdAt)&&p.createdAt>=0&&typeof p.updatedAt==='number'&&Number.isSafeInteger(p.updatedAt)&&p.updatedAt>=p.createdAt&&AVATARS.some(a=>a.id===p.avatar)&&(p.loadout===undefined||validLoadout(p.loadout));
}
export function readProfile(store:Store):LocalProfile|null{
 const raw=store.getItem(PROFILE_KEY);if(raw===null)return null;
 const p:unknown=JSON.parse(raw);if(!validateProfile(p))throw new Error('Profile data is incompatible or damaged. It has not been overwritten.');return p;
}
export function writeProfile(store:Store,profile:LocalProfile):LocalProfile{
 if(!validateProfile(profile))throw new Error('Invalid local profile');
 const old=readProfile(store);if(old&&old.id!==profile.id)throw new Error('Local profile identity changed; reload before editing.');
 store.setItem(PROFILE_KEY,JSON.stringify(profile));return profile;
}
export function createProfile(id:string,now:number):LocalProfile{return {schema:1,id,createdAt:now,updatedAt:now,name:'Founder',avatar:'founder',loadout:{...DEFAULT_LOADOUT}};}
export function avatarIcon(id:string,level:number){return AVATARS.find(a=>a.id===id&&a.level<=level)?.icon??'👤';}
export function editProfile(profile:LocalProfile,changes:{name:string;avatar:string},results:readonly Result[],now:number):LocalProfile{
 const name=changes.name.trim();if(!name||name.length>24)throw new Error('Name must contain 1–24 characters.');
 const progress=progression(results,profile.id);if(!progress.avatars.some(a=>a.id===changes.avatar&&a.unlocked))throw new Error('Avatar is locked.');
 return {...profile,name,avatar:changes.avatar,updatedAt:Math.max(profile.updatedAt,now)};
}

export function equipProfile(profile:LocalProfile,id:string,results:readonly Result[],now:number):LocalProfile{return {...profile,loadout:equip(profile.loadout,id,progression(results,profile.id)),updatedAt:Math.max(now,profile.updatedAt)};}
