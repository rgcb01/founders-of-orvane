// Stable cosmetic IDs are portable to a future account. No engine dependencies.
export const CATEGORIES=['dice','cardBack','board','title'] as const;
export type Category=typeof CATEGORIES[number];
export type Loadout=Record<Category,string>;
export type Progress={level:number;achievements:readonly {id:string;unlocked:boolean}[]};
export const COLLECTIONS=[
 {id:'classic',name:'Orvane Classic',icon:'🏝️',description:'The island where every founder begins.',color:'#d8bf83',level:1},
 {id:'viking',name:'Viking Collection',icon:'🛡️',description:'Runes, timber and northern seas.',color:'#8db7b7',level:2},
 {id:'imperial',name:'Imperial Collection',icon:'🏛️',description:'Marble, laurels and imperial gold.',color:'#e2c16f',level:10},
 {id:'pirate',name:'Pirate Collection',icon:'🏴‍☠️',description:'Black sails and treasures.',color:'#bc946a',level:20},
 {id:'winter',name:'Winter Collection',icon:'❄️',description:'Ice, snow and twilight.',color:'#a6d4ec',level:30},
 {id:'dragon',name:'Dragon Collection',icon:'🐉',description:'Embers and ancient scales.',color:'#ed927b',level:40},
 {id:'celestial',name:'Celestial Collection',icon:'🌌',description:'Starfields and a legendary crown.',color:'#c4a1e5',level:50}
] as const;
const titles=['Founder','Northborn','Imperial Architect','Corsair','Frostwarden','Dragonlord','Starbound Legend'];
const dice=['Ivory','Rune stone','Marble gold','Black pearl','Frost crystal','Ember','Starlight'];
const backs=['Island seal','Runic shield','Laurel seal','Black sail','Snowflake','Dragon scale','Constellation'];
const boards=['Classic coast','Northern waters','Imperial harbor','Corsair waters','Frozen sea','Ember coast','Astral sea'];
export interface Cosmetic {id:string;collection:string;category:Category;name:string;icon:string;color:string;level:number;achievement?:string}
export const COSMETICS:Cosmetic[]=COLLECTIONS.flatMap((c,i)=>CATEGORIES.map((category,j)=>({id:c.id+'-'+category,collection:c.id,category,name:[dice[i],backs[i],boards[i],titles[i]][j],icon:category==='dice'?'🎲':category==='cardBack'?'🃏':category==='board'?'🗺️':c.icon,color:c.color,level:c.level})));
COSMETICS.push({id:'first-crown-title',collection:'achievements',category:'title',name:'Crown Bearer',icon:'🏆',color:'#e2c16f',level:1,achievement:'first-win'},{id:'challenger-dice',collection:'achievements',category:'dice',name:'Challenger dice',icon:'⚔️',color:'#bd8261',level:1,achievement:'hard-win'},{id:'master-cardBack',collection:'achievements',category:'cardBack',name:'Strategist seal',icon:'🌟',color:'#c4a1e5',level:1,achievement:'expert-win'},{id:'landfall-board',collection:'achievements',category:'board',name:'Landfall coast',icon:'🏝️',color:'#94b56d',level:1,achievement:'first-match'});
export const DEFAULT_LOADOUT:Loadout={dice:'classic-dice',cardBack:'classic-cardBack',board:'classic-board',title:'classic-title'};
export function unlocked(c:Cosmetic,p:Progress){return p.level>=c.level&&(!c.achievement||p.achievements.some(a=>a.id===c.achievement&&a.unlocked));}
export function validLoadout(value:unknown):value is Loadout{
 if(!value||typeof value!=='object')return false;const v=value as Partial<Loadout>;
 return CATEGORIES.every(k=>COSMETICS.some(c=>c.category===k&&c.id===v[k]));
}
export function effectiveLoadout(value:Loadout|undefined,p:Progress):Loadout{
 const result={...DEFAULT_LOADOUT};if(value)for(const k of CATEGORIES){const c=COSMETICS.find(c=>c.category===k&&c.id===value[k]);if(c&&unlocked(c,p))result[k]=c.id;}return result;
}
export function equip(value:Loadout|undefined,id:string,p:Progress):Loadout{
 const item=COSMETICS.find(c=>c.id===id);if(!item||!unlocked(item,p))throw new Error('Cosmetic is locked or unknown.');
 return {...effectiveLoadout(value,p),[item.category]:item.id};
}
export function cosmetic(id:string){return COSMETICS.find(c=>c.id===id)!;}
export const CATEGORY_NAMES:Record<Category,string>={dice:'Dice',cardBack:'Card backs',board:'Board themes',title:'Titles'};
