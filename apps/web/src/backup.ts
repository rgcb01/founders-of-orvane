import {readLibrary,readPreferences,isPreferences,SAVE_KEY,PREF_KEY,type Library,type Preferences,type Store} from './persistence';
import {readProfile,validateProfile,PROFILE_KEY,type LocalProfile} from './progression';
export const MAX_BACKUP_BYTES=10*1024*1024;
export interface Backup {format:'orvane-backup';schema:1;exportedAt:number;profile:LocalProfile|null;library:Library;preferences:Preferences}
type WritableStore=Store&Pick<Storage,'removeItem'>;
const fail=()=>new Error('Invalid or unsupported Orvane backup. Nothing was changed.');
export function parseBackup(raw:string):Backup{
 if(raw.length>MAX_BACKUP_BYTES)throw fail();
 let b:Backup;try{b=JSON.parse(raw);}catch{throw fail();}
 if(!b||b.format!=='orvane-backup'||b.schema!==1||!Number.isSafeInteger(b.exportedAt)||b.exportedAt<0||b.exportedAt>8640000000000000||!(b.profile===null||validateProfile(b.profile))||!isPreferences(b.preferences))throw fail();
 if(!b.library||typeof b.library!=='object')throw fail();
 let library:Library;try{library=readLibrary({getItem:()=>JSON.stringify(b.library),setItem:()=>{throw fail();}});}catch{throw fail();}
 if(new Set(library.matches.map(m=>m.id)).size!==library.matches.length||new Set(library.results.map(r=>r.id)).size!==library.results.length||library.results.some(r=>r.endedAt>8640000000000000))throw fail();
 return {...b,library};
}
export function exportBackup(store:Store,now=Date.now()):Backup{
 return {format:'orvane-backup',schema:1,exportedAt:now,profile:readProfile(store),library:readLibrary(store),preferences:readPreferences(store)};
}
export function restoreBackup(store:WritableStore,raw:string):Backup{
 const b=parseBackup(raw);
 const keys=[SAVE_KEY,PROFILE_KEY,PREF_KEY],before=keys.map(k=>store.getItem(k));
 const values=[JSON.stringify(b.library),b.profile?JSON.stringify(b.profile):null,JSON.stringify(b.preferences)];
 try{for(let i=0;i<keys.length;i++){const v=values[i];if(v===null)store.removeItem(keys[i]);else store.setItem(keys[i],v);}}
 catch(e){let rollbackFailed=false;for(let i=0;i<keys.length;i++){try{const v=before[i];if(v===null)store.removeItem(keys[i]);else store.setItem(keys[i],v);}catch{rollbackFailed=true;}}throw new Error(rollbackFailed?'Restore failed and storage rollback was incomplete. Keep your backup.':'Restore failed; previous local data was restored.');}
 return b;
}
