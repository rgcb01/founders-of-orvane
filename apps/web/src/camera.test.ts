import {describe,it,expect} from 'vitest';
import {cameraTarget} from './camera';
describe('camera focus',()=>{
 const bounds={x:0,y:0,w:800,h:600};
 it('does not move for visible or empty focus',()=>{expect(cameraTarget(bounds,2,{x:0,y:0},[{x:400,y:300}])).toBeNull();expect(cameraTarget(bounds,2,{x:0,y:0},[])).toBeNull();});
 it('pans toward offscreen construction and zooms out for distant actions',()=>{const a=cameraTarget(bounds,2,{x:0,y:0},[{x:680,y:300}])!;expect(a.pan.x).toBeGreaterThan(0);expect(a.zoom).toBe(2);const b=cameraTarget(bounds,2,{x:0,y:0},[{x:80,y:80},{x:720,y:520}])!;expect(b.zoom).toBeLessThan(2);});
});