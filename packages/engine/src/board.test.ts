import {describe,expect,it} from 'vitest';
import {adjacent,generateBoard,islandCoordinates,vertexPosition,type BoardSize} from './index';

describe('seeded island topology',()=>{
  it.each([['standard',19,54,72,1],['extended',30,80,109,2]] as const)(
    '%s has the expected topology',(size,count,vertices,edges,deserts)=>{
      const board=generateBoard('orvane',size);
      expect(board.tiles).toHaveLength(count);
      expect(board.vertices).toHaveLength(vertices);
      expect(board.edges).toHaveLength(edges);
      expect(board.tiles.filter(t=>t.terrain==='desert')).toHaveLength(deserts);
      expect(board.vertices.length-board.edges.length+board.tiles.length).toBe(1);
      expect(board.edges.every(e=>e.tiles.length===1||e.tiles.length===2)).toBe(true);
      expect(board.vertices.every(v=>v.tiles.length>=1&&v.tiles.length<=3)).toBe(true);
      for(const t of board.tiles){
        expect(new Set(t.vertices).size).toBe(6);
        expect(new Set(t.edges).size).toBe(6);
        expect(t.number===null).toBe(t.terrain==='desert');
        for(const v of t.vertices)expect(board.vertices.find(x=>x.id===v)?.tiles).toContain(t.id);
        for(const e of t.edges)expect(board.edges.find(x=>x.id===e)?.tiles).toContain(t.id);
      }
      const coords=islandCoordinates(size);
      expect(new Set(coords.map(t=>t.q+','+t.r)).size).toBe(count);
    });
  it('is repeatable and seed-sensitive',()=>{
    expect(generateBoard('same')).toEqual(generateBoard('same'));
    expect(generateBoard('same').tiles).not.toEqual(generateBoard('different').tiles);
  });
  for(const size of ['standard','extended'] as BoardSize[]){
    it(size+' preserves inventories and separates red tokens over 100 seeds',()=>{
      for(let i=0;i<100;i++){
        const b=generateBoard('seed-'+i,size);
        const counts=Object.fromEntries(['forest','pasture','field','hill','mountain','desert'].map(k=>[k,b.tiles.filter(t=>t.terrain===k).length]));
        expect(counts).toEqual(size==='standard'?{forest:4,pasture:4,field:4,hill:3,mountain:3,desert:1}:{forest:6,pasture:6,field:6,hill:5,mountain:5,desert:2});
        const nums=b.tiles.flatMap(t=>t.number===null?[]:[t.number]).sort((a,b)=>a-b);
        const expected=[2,...(size==='extended'?[2]:[]),...[3,4,5,6,8,9,10,11].flatMap(n=>Array(size==='extended'?3:2).fill(n)),12,...(size==='extended'?[12]:[])];
        expect(nums).toEqual(expected);
        const reds=b.tiles.filter(t=>t.number===6||t.number===8);
        for(const a of reds)for(const c of reds)if(a!==c)expect(adjacent(a,c)).toBe(false);
      }
    });
  }
  it('shared edges have unit length',()=>{
    const b=generateBoard('geometry','extended');
    const vertices=new Map(b.vertices.map(v=>[v.id,vertexPosition(v)]));
    for(const e of b.edges){
      const a=vertices.get(e.a)!,c=vertices.get(e.b)!;
      expect(Math.hypot(a.x-c.x,a.y-c.y)).toBeCloseTo(1);
    }
  });
});
