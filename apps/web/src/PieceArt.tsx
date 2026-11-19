import {COLLECTIONS,cosmetic} from './cosmetics';
type Point={x:number;y:number};
const housePaths:Record<string,string>={
 classic:'M-8 -1 L0 -9 L8 -1 V8 H-8 Z',
 viking:'M-11 -2 L-8 -3 L0 -13 L8 -3 L11 -2 L9 0 V8 H-9 V0 Z',
 imperial:'M-10 -4 L0 -11 L10 -4 H8 V8 H-8 V-4 Z',
 pirate:'M-10 -2 L-8 -9 H5 L11 -2 V8 H-10 Z',
 winter:'M-12 0 L0 -14 L12 0 H9 V8 H-9 V0 Z',
 dragon:'M-10 0 L-12 -9 L-5 -5 L0 -14 L5 -5 L12 -9 L10 0 V8 H-10 Z',
 celestial:'M-10 -1 L-6 -8 L0 -14 L6 -8 L10 -1 V8 H-10 Z'
};
const cityPaths:Record<string,string>={
 classic:'M-12 9 V-7 H-8 V-13 H-3 V-7 H3 V-13 H8 V-7 H12 V9 Z',
 viking:'M-14 9 V-1 L-10 -4 L-10 -11 L0 -17 L10 -11 V-4 L14 -1 V9 Z',
 imperial:'M-13 9 V-8 H-9 V-12 L0 -17 L9 -12 V-8 H13 V9 Z',
 pirate:'M-14 9 V-9 H-9 V-14 H-5 V-9 H5 V-14 H9 V-9 H14 V9 Z',
 winter:'M-14 9 V-6 L-9 -14 L-4 -6 L0 -19 L4 -6 L9 -14 L14 -6 V9 Z',
 dragon:'M-14 9 V-8 L-12 -16 L-7 -8 L0 -19 L7 -8 L12 -16 L14 -8 V9 Z',
 celestial:'M-14 9 V-4 L-8 -13 L-4 -7 L0 -20 L4 -7 L8 -13 L14 -4 V9 Z'
};
export function themeFor(id:string){return cosmetic(id)?.collection??'classic';}
export function BuildingArt({p,city,color,styleId}:{p:Point;city:boolean;color:string;styleId:string}){
 const theme=themeFor(styleId),d=(city?cityPaths:housePaths)[theme]??(city?cityPaths.classic:housePaths.classic);
 return <g transform={'translate('+p.x+' '+p.y+')'} pointerEvents="none"><path d={d} fill={color} stroke="#15292e" strokeWidth={2} strokeLinejoin="round"/>{theme!=='classic'&&<path d={city?'M-9 -2 H9 M-9 1 H9':'M-5 -1 H5'} stroke="#fff4c9" strokeWidth="1.2" opacity=".85"/>}{city?<text x="0" y="7" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#15292e" stroke="#fff4c9" strokeWidth=".4">II</text>:theme!=='classic'&&<path d="M-2 8 V3 H2 V8" stroke="#15292e" strokeWidth="1.5" fill="none"/>}</g>;
}
export function RoadArt({a,b,color,styleId}:{a:Point;b:Point;color:string;styleId:string}){
 const theme=themeFor(styleId),dash:Record<string,string>={viking:'3 4',imperial:'1 5',pirate:'6 3',winter:'2 3',dragon:'4 2',celestial:'1 6'};
 return <g pointerEvents="none"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#15292e" strokeWidth="9" strokeLinecap="round"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="6.5" strokeLinecap="round"/>{theme!=='classic'&&<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff4c9" strokeWidth="1.6" strokeDasharray={dash[theme]} strokeLinecap="round"/>}</g>;
}
export function robberSymbol(id:string){return ({classic:'🥷',viking:'🪓',imperial:'🛡️',pirate:'🏴‍☠️',winter:'🐺',dragon:'🐉',celestial:'🌘'} as Record<string,string>)[themeFor(id)]??'🥷';}
export function RobberArt({p,styleId}:{p:Point;styleId:string}){
 return <g pointerEvents="none" aria-label="Robber blocks production"><circle cx={p.x} cy={p.y} r="15" fill="#15292e" stroke="#ffe39b" strokeWidth="1.5"/><text x={p.x} y={p.y+6} textAnchor="middle" fontSize="20">{robberSymbol(styleId)}</text><text x={p.x+12} y={p.y-10} fontSize="12" textAnchor="middle">🚫</text></g>;
}
export function effectColor(id:string){return COLLECTIONS.find(c=>c.id===themeFor(id))?.color??'#d8bf83';}
export function effectPalette(id:string){const color=effectColor(id);return [color,'#fff4c9',color,'#89bca4'];}
