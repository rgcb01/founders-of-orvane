import {useState} from 'react';
import {COLLECTIONS,COSMETICS,CATEGORIES,CATEGORY_NAMES,unlocked,effectiveLoadout,cosmetic,type Category,type Loadout,type Progress,type Cosmetic} from './cosmetics';
function Preview({item}:{item:Cosmetic}){
 return <div className="cosmetic-preview" data-preview={item.id}>
 {item.category==='dice'?<span className="preview-die">⚄</span>:item.category==='cardBack'?<span className="preview-back">{COLLECTIONS.find(c=>c.id===item.collection)?.icon??item.icon}</span>:item.category==='board'?<span className="preview-board"><i>🌲</i><i>🌾</i><i>⛰️</i></span>:<span className="preview-title" style={{color:item.color}}>{item.icon}</span>}
 </div>;
}
export function Wardrobe({loadout,progress,onEquip}:{loadout:Loadout|undefined;progress:Progress;onEquip:(id:string)=>void}){
 const [filter,setFilter]=useState<Category|'all'>('all'),[error,setError]=useState('');
 const active=effectiveLoadout(loadout,progress);
 const count=COSMETICS.filter(c=>unlocked(c,progress)).length;
 const collections=[...COLLECTIONS,{id:'achievements',name:'Achievement rewards',icon:'🏅',description:'Earn these through specific accomplishments.',color:'#e2c16f',level:1}];
 return <section className="wardrobe"><h2>🎁 Collections · {count}/{COSMETICS.length} unlocked</h2>
 <div className="equipped-row">{CATEGORIES.map(k=><div key={k}><small>{CATEGORY_NAMES[k]}</small><strong>{cosmetic(active[k]).name}</strong></div>)}</div>
 <div className="sizes collection-filters">{(['all',...CATEGORIES] as const).map(k=><button key={k} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{k==='all'?'All':CATEGORY_NAMES[k]}</button>)}</div>
 {collections.map(collection=>{const items=COSMETICS.filter(c=>c.collection===collection.id&&(filter==='all'||c.category===filter));return <section className="collection-group" key={collection.id}><div className="collection-heading" style={{borderColor:collection.color}}><span>{collection.icon}</span><div><strong>{collection.name}</strong><p>{collection.description}</p></div><small>{items.filter(c=>unlocked(c,progress)).length}/{items.length}</small></div>
 <div className="collection-items">{items.map(item=>{const available=unlocked(item,progress),equipped=active[item.category]===item.id;return <article className="collection-item" key={item.id}><Preview item={item}/><strong>{item.name}</strong><small>{CATEGORY_NAMES[item.category]}</small><button disabled={!available||equipped} aria-pressed={equipped} onClick={()=>{try{onEquip(item.id);setError('');}catch(e){setError(e instanceof Error?e.message:'Cannot equip');}}}>{equipped?'✓ Equipped':available?'Equip':item.achievement?'🔒 Achievement':'🔒 Level '+item.level}</button></article>;})}</div></section>;})}
 {error&&<p role="alert">{error}</p>}<p className="muted">Cosmetics never change dice, costs, resource production, player colors or rules. Everything is earned locally.</p></section>;
}
