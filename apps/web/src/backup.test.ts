import {describe,it,expect} from 'vitest';
import {createProfile,writeProfile,readProfile,progression,PROFILE_KEY} from './progression';
import {exportBackup,parseBackup,restoreBackup} from './backup';
import {readLibrary,SAVE_KEY,PREF_KEY,DEFAULT_PREFS,type Library} from './persistence';
function storage(){const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);}};}
describe('portable backup',()=>{
 it('restores profile, history, preferences and XP without duplicating results',()=>{
  const source=storage(),target=storage(),profile=createProfile('p',1);
  writeProfile(source,profile);const lib:Library={schema:1,matches:[],results:[{id:'r',profileId:'p',endedAt:2,players:4,humans:1,winner:0,winnerName:'Founder',rounds:10,difficulty:'hard'}]};
  source.setItem(SAVE_KEY,JSON.stringify(lib));source.setItem(PREF_KEY,JSON.stringify({...DEFAULT_PREFS,pace:'turbo'}));writeProfile(target,createProfile('other',1));
  const raw=JSON.stringify(exportBackup(source,3));restoreBackup(target,raw);restoreBackup(target,raw);
  expect(readProfile(target)).toEqual(profile);expect(readLibrary(target)).toEqual(lib);expect(progression(readLibrary(target).results,'p').xp).toBe(progression(lib.results,'p').xp);expect(exportBackup(target,3)).toEqual(exportBackup(source,3));
 });
 it('rejects malformed or duplicated data before writing',()=>{const s=storage();writeProfile(s,createProfile('p',1));const before=s.getItem(PROFILE_KEY);expect(()=>restoreBackup(s,'{}')).toThrow();expect(()=>restoreBackup(s,'{"format":"orvane-backup","schema":2}')).toThrow();expect(s.getItem(PROFILE_KEY)).toBe(before);const b=exportBackup(s,2);expect(()=>parseBackup(JSON.stringify({...b,library:{schema:1,matches:[{}],results:[]}}))).toThrow();});
 it('rolls back previous values if a later write fails',()=>{const s=storage();writeProfile(s,createProfile('p',1));const b=exportBackup(s,2),other={...b,profile:createProfile('q',2)};let once=true;const fail={...s,setItem:(k:string,v:string)=>{if(k===PREF_KEY&&once){once=false;throw Error('quota');}s.setItem(k,v);}};expect(()=>restoreBackup(fail,JSON.stringify(other))).toThrow('previous local data');expect(readProfile(s)?.id).toBe('p');expect(s.getItem(SAVE_KEY)).toBeNull();});
});