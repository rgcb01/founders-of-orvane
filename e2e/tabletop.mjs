import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 for(const [width,height,touch] of [[1366,768,false],[900,650,false],[1024,768,true],[390,844,true],[844,390,true]]) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?renderer=2d');
  await page.getByRole('button',{name:/New game/}).first().click();
  await page.getByRole('button',{name:'6 players',exact:true}).click();
  await page.getByRole('button',{name:'Start setup',exact:true}).click();
  const hide=page.getByRole('button',{name:'Hide tutorial'});if(await hide.isVisible())await hide.click();
  const board=await page.locator('.board-panel').boundingBox();
  assert.ok(board.width>=width*.98&&board.height>=height*.98,`full viewport ${width}`);
  const seats=await page.locator('.player-seat').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y}}));
  assert.equal(seats.length,6);assert.ok(seats.every(s=>s.x===seats[0].x),'vertical players');
  await page.getByRole('button',{name:'Open journal',exact:true}).click();
  await page.getByRole('button',{name:'Close game panel',exact:true}).click();
  await page.getByRole('button',{name:'Pause menu',exact:true}).click();
  await page.getByRole('button',{name:'▶ Resume game',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
  await page.screenshot({path:`/tmp/orvane-${width}.png`});
  // Stress the real hand component with more cards than a narrow screen can fit.
  await page.evaluate(async()=>{
   const {default:{createElement}}=await import('/node_modules/.vite/deps/react.js');
   const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
   const {ResourceHand}=await import('/src/GameUI.tsx');
   const host=document.createElement('div');host.id='hand-regression';host.className='in-match';
   host.style.cssText='position:fixed;inset:0;z-index:999;width:100%;';
   host.innerHTML='<nav class="match-dock"></nav>';document.body.append(host);
   createRoot(host.firstChild).render(createElement(ResourceHand,{resources:{forest:12,pasture:9,field:8,hill:7,mountain:6},queue:[],solo:true}));
  });
  await page.locator('#hand-regression .fan-card').last().waitFor();
  await page.waitForFunction(()=>{const e=document.querySelector('#hand-regression .fan-scroll');return e.scrollWidth<=e.clientWidth;});
  await page.locator('#hand-regression .fan-card').last().focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#hand-regression .fan-card[aria-pressed="true"]').count(),1);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}x${height} touch=${touch}: full board, six vertical players, journal, pause, overflow, runtime`);
  await page.close();
 }
} finally {await browser.close();}
