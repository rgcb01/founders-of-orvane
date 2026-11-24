import {chromium,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const url='http://127.0.0.1:4174/';
const server=spawn('pnpm',['--filter','@orvane/web','exec','vite','preview','--host','127.0.0.1','--port','4174','--strictPort'],{stdio:'inherit'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 await mkdir('artifacts/preview3d',{recursive:true});
 for(const [name,options] of [['desktop',{viewport:{width:1440,height:900}}],['phone-portrait',{...devices['iPhone 13 Pro Max']}],['phone-landscape',{...devices['iPhone 13 Pro Max landscape']}]]){
 const page=await browser.newPage(options);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'?preview=3d');const canvas=page.locator('canvas');await canvas.waitFor({timeout:15000});await page.waitForTimeout(500);
 await page.screenshot({path:'artifacts/preview3d/'+name+'.png'});
 // A tap should select a graph location, while a drag must not accidentally select.
 const bounds=await canvas.boundingBox();if(!bounds)throw Error('3D canvas has no bounds');
 const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
 await page.mouse.click(x,y);
 await page.getByText(/^Selected (tile|edge|vertex):/).waitFor({timeout:5000});
 const label=await page.getByText(/^Selected (tile|edge|vertex):/).textContent();
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+55,y+12,{steps:8});await page.mouse.up();
 if(await page.getByText(/^Selected (tile|edge|vertex):/).textContent()!==label)throw Error('Dragging unexpectedly changed selection');
 if(errors.length)throw Error(errors.join('\n'));await page.close();
 }
 // Live match smoke: default WebGL board during setup, then verify technical SVG fallback.
 const live=await browser.newPage({viewport:{width:1280,height:800}});
 const liveErrors=[];live.on('pageerror',e=>liveErrors.push(e.message));
 await live.goto(url);
 await live.getByRole('button',{name:/New game/}).click();
 await live.getByLabel('Bot pace').first().selectOption('turbo');
 await live.getByRole('button',{name:'Start setup'}).click();
 await live.locator('canvas').waitFor({timeout:15000});
 await live.screenshot({path:'artifacts/preview3d/live-setup.png'});
 // Find a legal settlement by actual WebGL raycasting; confirm it through the live engine.
 const coach=live.getByRole('complementary',{name:'Interactive tutorial'});
 if(await coach.isVisible())await coach.getByRole('button',{name:'Hide tutorial'}).click();
 await live.waitForFunction(()=>{const el=document.querySelector('canvas');return el&&JSON.parse(el.dataset.legalVertices??'[]').length>0;},null,{timeout:30000});
 const initialCanvas=live.locator('canvas');
 const cameraBounds=await initialCanvas.boundingBox();
 if(!cameraBounds)throw Error('Missing camera canvas');
 await live.mouse.move(cameraBounds.x+cameraBounds.width/2,cameraBounds.y+cameraBounds.height/2);
 await live.mouse.down();await live.mouse.move(cameraBounds.x+cameraBounds.width/2+45,cameraBounds.y+cameraBounds.height/2,{steps:5});await live.mouse.up();
 await live.mouse.wheel(0,-150);
 await live.waitForFunction(()=>{const c=document.querySelector('canvas');const p=JSON.parse(c?.dataset.cameraPose??'{}');return p.zoom>1&&Math.abs(p.azimuth)>0;});
 const pose=await initialCanvas.getAttribute('data-camera-pose');
 const before=await live.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].setup.settlements.length);
 const turnBefore=await live.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].setup.step);
 const confirm=live.getByRole('button',{name:'Confirm placement'}).first();
 const rect=await live.locator('canvas').boundingBox();
 if(!rect)throw Error('Live 3D board has no canvas bounds');

 const sites=await live.locator('canvas').evaluate(el=>JSON.parse(el.dataset.legalVertices??'[]'));
 if(!sites.length)throw Error('No projected legal settlement sites available');
 let found=false;
 for(const site of sites){
   await live.mouse.click(rect.x+site.x,rect.y+site.y);
   if(await confirm.isEnabled()){found=true;await confirm.click();break;}
 }
 if(!found)throw Error('Could not select any legal settlement through the 3D canvas');
 await live.waitForFunction(count=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].setup.settlements.length>count,before,{timeout:10000});
 await live.getByText(/Place its road/).first().waitFor({timeout:5000});
 // Finish the same setup turn by placing its road through the 3D canvas.
 await live.waitForFunction(()=>{const el=document.querySelector('canvas');return el&&JSON.parse(el.dataset.legalEdges??'[]').length>0;},null,{timeout:10000});
 const roadsBefore=await live.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].setup.roads.length);
 const roadSites=await live.locator('canvas').evaluate(el=>JSON.parse(el.dataset.legalEdges??'[]'));
 const roadRect=await live.locator('canvas').boundingBox();
 if(!roadRect)throw Error('3D road canvas has no bounds');
 let roadPlaced=false;
 for(const site of roadSites){
   await live.mouse.click(roadRect.x+site.x,roadRect.y+site.y);
   if(await confirm.isEnabled()){await confirm.click();roadPlaced=true;break;}
 }
 if(!roadPlaced)throw Error('Could not place a legal road through the 3D canvas');
 await live.waitForFunction(count=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].setup.roads.length>count,roadsBefore,{timeout:10000});
 await live.waitForFunction(step=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].setup.step>step,turnBefore,{timeout:10000});
 await live.waitForFunction(expected=>document.querySelector('canvas')?.dataset.cameraPose===expected,pose,{timeout:10000});
 await live.screenshot({path:'artifacts/preview3d/live-after-placement.png'});
 await live.evaluate(()=>{const gl=document.querySelector('canvas')?.getContext('webgl2');gl?.getExtension('WEBGL_lose_context')?.loseContext();});
 await live.locator('[data-board-root="true"]').waitFor({timeout:5000});
 if(liveErrors.length)throw Error(liveErrors.join('\\n'));
 await live.close();
}finally{await browser?.close();server.kill();}
