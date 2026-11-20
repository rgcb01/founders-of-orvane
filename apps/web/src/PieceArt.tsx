import {ResourceIcon} from './ResourceArt';
import type {Resource} from '@orvane/engine';
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
 return <g transform={'translate('+p.x+' '+p.y+')'} pointerEvents="none"><ellipse cx="1" cy="9" rx={city?15:11} ry="4" fill="#142c32" opacity=".25"/><path d={d} fill={color} stroke="#20363a" strokeWidth={1.6} strokeLinejoin="round"/>{theme==="classic"&&<path d={city?"M0 9 V-7 H3 V-13 H8 V-7 H12 V9 Z":"M0 -9 L8 -1 V8 H0 Z"} fill="#15292e" opacity=".20"/>}{theme==="classic"&&<path d={city?"M-12 -7 H-8 V-13 H-3 V-7":"M-8 -1 L0 -9"} fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".55"/>}{theme!=='classic'&&<path d={city?'M-9 -2 H9 M-9 1 H9':'M-5 -1 H5'} stroke="#fff4c9" strokeWidth="1.2" opacity=".85"/>}{city?<text x="0" y="7" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#15292e" stroke="#fff4c9" strokeWidth=".4">II</text>:theme!=='classic'&&<path d="M-2 8 V3 H2 V8" stroke="#15292e" strokeWidth="1.5" fill="none"/>}</g>;
}
export function RoadArt({a,b,color,styleId}:{a:Point;b:Point;color:string;styleId:string}){
 const theme=themeFor(styleId),dash:Record<string,string>={viking:'3 4',imperial:'1 5',pirate:'6 3',winter:'2 3',dragon:'4 2',celestial:'1 6'};
 return <g pointerEvents="none"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#20363a" strokeWidth="8.5" strokeLinecap="round"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="6" strokeLinecap="round"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" opacity=".20" strokeWidth="1.2" strokeLinecap="round"/>{theme!=='classic'&&<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff4c9" strokeWidth="1.6" strokeDasharray={dash[theme]} strokeLinecap="round"/>}</g>;
}
export function robberSymbol(id:string){return ({classic:'🥷',viking:'🪓',imperial:'🛡️',pirate:'🏴‍☠️',winter:'🐺',dragon:'🐉',celestial:'🌘'} as Record<string,string>)[themeFor(id)]??'🥷';}
export function RobberArt({p,styleId}:{p:Point;styleId:string}){
 const theme=themeFor(styleId),accent=COLLECTIONS.find(c=>c.id===theme)?.color??'#c3a56c';
 return <g transform={`translate(${p.x} ${p.y})`} pointerEvents="none" aria-label="Robber blocks production"><ellipse cy="9" rx="12" ry="5" fill="#15292e" opacity=".35"/><path d="M-10 8 L-7 -5 L0 -10 L7 -5 L10 8 L0 12Z" fill="#293a40" stroke="#15292e" strokeWidth="1.2"/><path d="M0 -10 L7 -5 L10 8 L0 12Z" fill="#14282e"/><path d="M-7 -5 L-6 -14 L0 -19 L6 -14 L7 -5 L0 -1Z" fill="#405159"/><path d="M-4 -10 L4 -10 L3 -5 H-3Z" fill="#b8a58b"/><path d="M-5 1 L5 4" stroke={accent} strokeWidth="2"/><circle cx="11" cy="-12" r="5" fill="#8d5147" stroke="#ead7bb"/><path d="M8 -12 H14" stroke="#fff0d8" strokeWidth="1.5"/></g>;
}
export function HarborArt({a,b,p,angle,resource,rate}:{a:Point;b:Point;p:Point;angle:number;resource?:Resource|null;rate:number}){
 return <g pointerEvents="none"><path d={`M${a.x} ${a.y} L${p.x} ${p.y} L${b.x} ${b.y}`} fill="none" stroke="#b6a27c" strokeWidth="2"/><g transform={`translate(${p.x} ${p.y})`}><g transform={`rotate(${angle})`}><path d="M-9 -6 H9 V6 H-9Z" fill="#957456" stroke="#594c3c"/><path d="M-5 -6 V6 M0 -6 V6 M5 -6 V6" stroke="#d2b28b" strokeWidth="1"/><path d="M-9 6 H9" stroke="#634d38" strokeWidth="2"/></g><g transform="translate(0 -16)"><g className="harbor-boat"><path d="M-12 2 L-8 8 H8 L12 2Z" fill="#725641"/><path d="M0 2 V-13" stroke="#dac6a0" strokeWidth="1.5"/><path d="M0 -12 L9 0 H0Z" fill="#e8dfca"/><path d="M-1 -10 L-7 0 H-1Z" fill="#b9c9bd"/></g></g><rect x="-19" y="4" width="38" height="15" rx="4" fill="#e8d5aa" stroke="#806e56"/>{resource?<svg x="-16" y="5" width="12" height="12" viewBox="0 0 24 24"><ResourceIcon resource={resource} size={24}/></svg>:<path d="M-12 6 V16 M-16 12 Q-12 19 -8 12 M-15 8 H-9" stroke="#45636b" fill="none" strokeWidth="1.4"/>}<text x="6" y="15" textAnchor="middle" fontSize="10" fill="#183a3e" fontWeight="bold">{rate}:1</text></g></g>;
}
export function effectColor(id:string){return COLLECTIONS.find(c=>c.id===themeFor(id))?.color??'#d8bf83';}
export function effectPalette(id:string){const color=effectColor(id);return [color,'#fff4c9',color,'#89bca4'];}
