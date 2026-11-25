import {resourceEmoji,resourceName} from './resources';
// Lightweight inline resource art; text labels remain the accessible names.
export function ResourceIcon({resource,size="1.35em"}:{resource:keyof typeof resourceEmoji;size?:number|string}){
 const shapes:Record<keyof typeof resourceEmoji,import("react").ReactNode>={
 forest:<><path d="M4 9 15 3 21 7 10 14Z" fill="#ab875e"/><path d="M4 9 10 14 10 21 4 16Z" fill="#76583e"/><path d="M10 14 21 7 21 14 10 21Z" fill="#936b49"/></>,
 pasture:<><path d="M3 10 8 4 17 4 21 10 19 18 7 20 3 15Z" fill="#eee9dd"/><path d="M12 4 17 4 21 10 19 18 12 20 15 12Z" fill="#c8c9bd"/></>,
 field:<><path d="M12 22V3" stroke="#a78442" strokeWidth="2"/><path d="M12 9 5 4 6 10 12 14 18 9 19 3Z M12 16 5 11 6 17 12 21 18 16 19 10Z" fill="#d5af59"/></>,
 hill:<><path d="M3 9 15 4 22 9 10 14Z" fill="#d49a7c"/><path d="M3 9 10 14 10 21 3 16Z" fill="#a2604b"/><path d="M10 14 22 9 22 16 10 21Z" fill="#bd795f"/></>,
 mountain:<><path d="M2 17 7 6 16 3 22 12 18 21 8 22Z" fill="#93a3ab"/><path d="M7 6 13 13 8 22 2 17Z" fill="#687e89"/><path d="M13 13 22 12 18 21 8 22Z" fill="#526b77"/></>
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{display:'inline-block',verticalAlign:'middle',pointerEvents:'none'}}>{shapes[resource]}</svg>;
}


// Original vector vignettes, with a common engraved-card composition.
// No external textures or network requests; shared by hand, trade and discard.
const palette={forest:['#273f32','#a7b98a','#d8c18a'],pasture:['#52614a','#d6d8bd','#f0e3be'],field:['#79582d','#d9b354','#f5df99'],hill:['#784735','#cc8b67','#f1c69a'],mountain:['#394f60','#9fbbc3','#e3e3cc']} as const;
export function ResourceFace({resource}:{resource:keyof typeof resourceEmoji}){
 const [dark,mid,light]=palette[resource];
 const scene={
 forest:<><path d="M8 72 24 38 40 72M34 73 51 24 69 73M60 74 76 42 92 74" fill={dark} stroke={light} strokeWidth="1.2"/><path d="M21 72v10M51 72v12M76 72v9" stroke="#6a4730" strokeWidth="4"/><path d="M17 91 64 75 82 85 36 102Z" fill="#8e6240" stroke="#352d22" strokeWidth="2"/><ellipse cx="76" cy="81" rx="8" ry="6" fill="#e2bd83" stroke="#5e442c" strokeWidth="2"/><ellipse cx="76" cy="81" rx="4" ry="3" fill="none" stroke="#9b7346"/></>,
 pasture:<><path d="M5 80Q28 58 52 77T95 70V105H5Z" fill={dark}/><g fill="#ede3c7" stroke="#6b6b54" strokeWidth="1.5"><circle cx="35" cy="68" r="13"/><circle cx="49" cy="64" r="15"/><circle cx="63" cy="70" r="13"/><ellipse cx="48" cy="81" rx="22" ry="12"/></g><path d="M32 88v10M60 88v10" stroke="#4b4639" strokeWidth="4"/><ellipse cx="73" cy="78" rx="9" ry="11" fill="#625e4a"/><path d="M68 70 60 66 62 76M77 70 86 66 84 76" fill="#625e4a"/><circle cx="76" cy="77" r="1.5" fill="#fff1ce"/></>,
 field:<><path d="M6 83Q50 65 94 83V106H6Z" fill={dark}/>{[27,40,53,66,79].map((x,i)=><g key={x} transform={'translate('+x+' '+(i%2?4:0)+')'}><path d="M0 97Q-4 66 0 34" fill="none" stroke="#e9cc75" strokeWidth="2"/>{[40,49,58,67].map(y=><path key={y} d={'M0 '+(y+8)+'Q-12 '+y+' -9 '+(y-4)+'Q0 '+(y-3)+' 0 '+(y+8)+'Q12 '+y+' 9 '+(y-4)+'Q0 '+(y-3)+' 0 '+(y+8)} fill={light} stroke={dark} strokeWidth=".7"/>)}</g>)}</>,
 hill:<><path d="M4 79 31 51 54 65 75 37 96 72V107H4Z" fill={dark}/><path d="M16 72 50 62 83 75 49 85Z" fill={light} stroke={dark}/><path d="M16 72v18l33 11V85Z" fill="#9c5140" stroke={dark}/><path d="M49 85 83 75v18l-34 8Z" fill={mid} stroke={dark}/><path d="M16 81 49 92 83 83M33 77v9M65 80v9M32 86v9" fill="none" stroke="#784735" strokeWidth="1.4"/></>,
 mountain:<><path d="M4 91 29 45 48 67 67 25 96 91Z" fill={dark}/><path d="M67 25 54 52 67 47 78 56Z" fill={light}/><path d="M29 45 20 62 29 58 38 63Z" fill={light}/><path d="M14 94 33 74 51 78 65 69 88 92 72 105 25 105Z" fill={mid} stroke={dark} strokeWidth="2"/><path d="M33 74 40 91 25 105M40 91 65 69M40 91 72 105M65 69 62 91 88 92" fill="none" stroke={dark} strokeWidth="1.5"/></>
 }[resource];
 return <span className={'resource-face resource-'+resource}><svg className="resource-illustration" viewBox="0 0 100 138" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect width="100" height="138" rx="6" fill="#e9d6ab"/><rect x="4" y="4" width="92" height="130" rx="4" fill={dark} stroke="#8d7852"/><rect x="8" y="8" width="84" height="122" rx="2" fill={mid}/><circle cx="50" cy="52" r="31" fill={light} opacity=".7"/><path d="M9 91Q50 80 91 91V111H9Z" fill={dark}/>{scene}<rect x="8" y="111" width="84" height="19" fill="#e9d6ab"/><path d="M13 115h74M13 126h74" stroke="#9b8357" strokeWidth=".6"/><text x="50" y="123" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="bold" fontSize="10" fill="#332d24">{resourceName[resource].toUpperCase()}</text><path d="M12 12h10M12 12v10M88 12H78M88 12v10" stroke={light} fill="none" strokeWidth="1.4"/></svg></span>
}
