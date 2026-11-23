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
 // Live match smoke: opt in during setup, verify WebGL canvas, then return to SVG.
 const live=await browser.newPage({viewport:{width:1280,height:800}});
 const liveErrors=[];live.on('pageerror',e=>liveErrors.push(e.message));
 await live.goto(url);
 await live.getByRole('button',{name:/New game/}).click();
 await live.getByRole('button',{name:'Start setup'}).click();
 const toggle=live.getByRole('button',{name:'Toggle experimental 3D board'});
 await toggle.click();
 await live.locator('canvas').waitFor({timeout:15000});
 if(await toggle.getAttribute('aria-pressed')!=='true')throw Error('3D toggle failed to activate');
 await live.screenshot({path:'artifacts/preview3d/live-setup.png'});
 await toggle.click();
 await live.locator('[data-board-root="true"]').waitFor({timeout:5000});
 if(await toggle.getAttribute('aria-pressed')!=='false')throw Error('SVG fallback toggle failed');
 if(liveErrors.length)throw Error(liveErrors.join('\\n'));
 await live.close();
}finally{await browser?.close();server.kill();}
