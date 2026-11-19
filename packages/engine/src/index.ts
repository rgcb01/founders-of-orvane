import {generateHarbors,type Harbor} from './trade';
export type Terrain = 'forest' | 'pasture' | 'field' | 'hill' | 'mountain' | 'desert';
export type BoardSize = 'standard' | 'extended';
export interface Axial { q: number; r: number }
export interface Vertex { id: string; x: number; y: number; tiles: string[] }
export interface Edge { id: string; a: string; b: string; tiles: string[] }
export interface Tile extends Axial { id: string; terrain: Terrain; number: number | null; vertices: string[]; edges: string[] }
export interface Board { seed: string; size: BoardSize; tiles: Tile[]; vertices: Vertex[]; edges: Edge[]; harbors:Harbor[] }

const corners = [[0,-2],[1,-1],[1,1],[0,2],[-1,1],[-1,-1]] as const;
const directions = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]] as const;
const key = (x:number,y:number) => x + ',' + y;
export const tileId = (q:number,r:number) => key(q,r);
export function seededRandom(seed:string):()=>number {
  let state = 2166136261;
  for (let i=0;i<seed.length;i++) state = Math.imul(state ^ seed.charCodeAt(i),16777619);
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ state >>> 15,1 | state);
    t ^= t + Math.imul(t ^ t >>> 7,61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle<T>(items:readonly T[], random:()=>number):T[] {
  const a = [...items];
  for(let i=a.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
export function islandCoordinates(size:BoardSize):Axial[] {
  const radius = size === 'standard' ? 2 : 3;
  const high = size === 'standard' ? 2 : 2;
  const coords:Axial[]=[];
  for(let r=-radius;r<=radius;r++)
    for(let q=Math.max(-radius,-r-radius);q<=Math.min(high,-r+high);q++) coords.push({q,r});
  return coords;
}
export function adjacent(a:Axial,b:Axial):boolean {
  return directions.some(([q,r])=>a.q+q===b.q && a.r+r===b.r);
}
export function vertexPosition(v:Pick<Vertex,'x'|'y'>, radius=1) {
  return {x:v.x*Math.sqrt(3)/2*radius,y:v.y/2*radius};
}
export function tilePosition(t:Axial,radius=1) {
  return vertexPosition({x:2*t.q+t.r,y:3*t.r},radius);
}
function repeat<T>(item:T,n:number):T[]{return Array.from({length:n},()=>item);}
function terrainBag(size:BoardSize):Terrain[]{
  const large=size==='extended';
  return [...repeat<Terrain>('forest',large?6:4),...repeat<Terrain>('pasture',large?6:4),
    ...repeat<Terrain>('field',large?6:4),...repeat<Terrain>('hill',large?5:3),
    ...repeat<Terrain>('mountain',large?5:3),...repeat<Terrain>('desert',large?2:1)];
}
function numberBag(size:BoardSize):number[]{
  const large=size==='extended';
  return [2,...(large?[2]:[]),...[3,4,5,6,8,9,10,11].flatMap(n=>repeat(n,large?3:2)),12,...(large?[12]:[])];
}
// Choose nonadjacent red tokens by deterministic backtracking, then shuffle remaining tokens.
function redLocations(candidates:Tile[],needed:number):Tile[] {
  const chosen:Tile[]=[];
  function visit(start:number):boolean {
    if(chosen.length===needed)return true;
    if(candidates.length-start<needed-chosen.length)return false;
    for(let i=start;i<candidates.length;i++){
      const t=candidates[i];
      if(chosen.some(c=>adjacent(c,t)))continue;
      chosen.push(t);
      if(visit(i+1))return true;
      chosen.pop();
    }
    return false;
  }
  if(!visit(0))throw new Error('Unable to place red tokens');
  return chosen;
}
export function generateBoard(seed:string,size:BoardSize='standard'):Board {
  const random=seededRandom(seed);
  const terrains=shuffle(terrainBag(size),random);
  const vertices=new Map<string,Vertex>(),edges=new Map<string,Edge>();
  const tiles=islandCoordinates(size).map(({q,r},i):Tile=>{
    const id=tileId(q,r);
    const ids=corners.map(([dx,dy])=>{
      const x=2*q+r+dx,y=3*r+dy,vid=key(x,y);
      if(!vertices.has(vid))vertices.set(vid,{id:vid,x,y,tiles:[]});
      vertices.get(vid)!.tiles.push(id);
      return vid;
    });
    const eids=ids.map((a,i)=>{
      const pair=[a,ids[(i+1)%6]].sort(),eid=pair.join('|');
      if(!edges.has(eid))edges.set(eid,{id:eid,a:pair[0],b:pair[1],tiles:[]});
      edges.get(eid)!.tiles.push(id);
      return eid;
    });
    return {id,q,r,terrain:terrains[i],number:null,vertices:ids,edges:eids};
  });
  const tokens=numberBag(size), red=shuffle(tokens.filter(n=>n===6||n===8),random);
  const productive=shuffle(tiles.filter(t=>t.terrain!=='desert'),random);
  const redTiles=redLocations(productive,red.length);
  redTiles.forEach((t,i)=>t.number=red[i]);
  const rest=shuffle(tokens.filter(n=>n!==6&&n!==8),random);
  productive.filter(t=>t.number===null).forEach((t,i)=>t.number=rest[i]);
  return {seed,size,tiles,vertices:[...vertices.values()],edges:[...edges.values()],harbors:generateHarbors([...edges.values()],[...vertices.values()],size==='extended',random)};
}

export * from './setup';

export * from './economy';

export * from './trade';

export * from './development';

export * from './victory';
