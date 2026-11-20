import type {Terrain} from '@orvane/engine';

// Original matte vector geometry, in board units. Only the top half of a tile
// contains art; the number, probability pips and shared junctions stay clear.
export const TERRAIN_COLORS:Record<Terrain,string>={
 forest:'#728e69',pasture:'#a6b97d',field:'#d3b46f',
 hill:'#bd876c',mountain:'#8d9aa3',desert:'#d8bd93'
};

type Facet=readonly [string,string];
const motifs:Record<Terrain,readonly Facet[]>={
 forest:[
 ['M-26 -14 L-16 -38 L-6 -14 Z','#45634f'],
 ['M-16 -38 L-16 -14 L-6 -14 Z','#365343'],
 ['M-8 -7 L4 -35 L16 -7 Z','#52765a'],
 ['M4 -35 L4 -7 L16 -7 Z','#385946'],
 ['M10 -16 L20 -35 L30 -16 Z','#68876a'],
 ['M20 -35 L20 -16 L30 -16 Z','#47674f'],
 ['M-18 -14 H-14 V-9 H-18 Z M2 -7 H6 V-3 H2 Z','#795f46']
 ],
 pasture:[
 ['M-28 -11 Q-16 -28 1 -14 L13 -9 H-28 Z','#8ba56b'],
 ['M-5 -10 Q10 -31 29 -13 L31 -9 H-5 Z','#bdcb94'],
 ['M-19 -19 L-12 -22 L-5 -19 V-13 L-13 -10 L-20 -13 Z','#f2eee1'],
 ['M-5 -19 L0 -18 L1 -13 L-5 -12 Z','#67716a'],
 ['M10 -27 L16 -30 L23 -27 V-21 L16 -18 L10 -21 Z','#f2eee1'],
 ['M23 -27 L28 -25 L28 -21 L23 -20 Z','#67716a']
 ],
 field:[
 ['M-29 -12 L-12 -33 L28 -29 L20 -9 Z','#b08e4b'],
 ['M-26 -13 L-11 -30 L-5 -29 L-20 -12 Z M-14 -12 L1 -29 L7 -28 L-8 -11 Z M-2 -11 L13 -28 L19 -27 L5 -10 Z M10 -10 L25 -26 L28 -25 L19 -9 Z','#eed092'],
 ['M-24 -17 L24 -15 L21 -12 L-27 -14 Z','#c19a50']
 ],
 hill:[
 ['M-30 -10 L-17 -31 L-5 -25 L8 -9 Z','#a9684e'],
 ['M-17 -31 L-12 -12 L8 -9 L-5 -25 Z','#965b49'],
 ['M-3 -10 L11 -34 L26 -24 L32 -10 Z','#d3a082'],
 ['M11 -34 L14 -12 L32 -10 L26 -24 Z','#a76b54'],
 ['M-22 -16 L-10 -16 L-14 -11 L-26 -11 Z','#e2b39a']
 ],
 mountain:[
 ['M-32 -10 L-16 -37 L1 -9 Z','#b4bec2'],
 ['M-16 -37 L-16 -10 L1 -9 Z','#657983'],
 ['M-10 -9 L7 -44 L28 -9 Z','#c0cbd0'],
 ['M7 -44 L9 -9 L28 -9 Z','#61747e'],
 ['M-1 -26 L7 -44 L17 -27 L8 -31 L3 -26 Z','#e7eceb'],
 ['M17 -9 L23 -28 L32 -9 Z','#788b93']
 ],
 desert:[
 ['M-31 -11 Q-18 -31 -1 -17 Q8 -25 28 -12 L28 -8 H-31 Z','#c6a16c'],
 ['M-27 -12 Q-13 -26 -1 -17 Q12 -21 27 -12 Q8 -16 -2 -12 Z','#f0d8a8'],
 ['M-8 -30 L-4 -35 L1 -30 V-23 H-8 Z','#b39770'],
 ['M1 -30 L6 -28 V-23 H1 Z','#937b60']
 ]
};
export function TerrainArt({terrain,p,harvesting=false,duration=0}:{terrain:Terrain;p:{x:number;y:number};harvesting?:boolean;duration?:number}){
 return <g className="terrain-art" transform={`translate(${p.x} ${p.y})`} pointerEvents="none" aria-hidden="true">
  <ellipse cx="0" cy="-10" rx="30" ry="6" fill="#203b30" opacity=".10"/>
  <g className={harvesting?'terrain-harvesting':''} style={{animationDuration:duration+'ms'}}>{motifs[terrain].map(([d,fill],i)=><path key={i} d={d} fill={fill}/>)}</g>
 </g>;
}
