import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium,webkit,devices} from 'playwright';
const url='http://127.0.0.1:4173/';
const server=spawn('pnpm',['--filter','@orvane/web','exec','vite','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw Error('Preview did not start');}
const button=(page,name)=>page.getByRole('button',{name,exact:true}).first();
async function onPhone(page){return !(await button(page,'Confirm placement').isVisible());}
async function confirmSite(page){
 if(await onPhone(page))await page.getByRole('button',{name:'✓ Place'}).click();
 else await button(page,'Confirm placement').click();
}
async function tutorialToggle(page){
 if(await page.getByRole('button',{name:'Guided tutorial',exact:true}).first().isVisible()){
  await page.getByRole('button',{name:'Guided tutorial',exact:true}).first().click();
 }else{
  await page.getByRole('button',{name:'Pause menu'}).click();
  const menu=page.getByRole('dialog',{name:'Pause menu'});
  await menu.getByRole('button',{name:'🧭 Guided tutorial'}).click();
 }
}
async function saveAndExit(page){
 if(await button(page,'Save & exit').isVisible())await button(page,'Save & exit').click();
 else{
  await page.getByRole('button',{name:'Pause menu'}).click();
  await page.getByRole('dialog',{name:'Pause menu'}).getByRole('button',{name:'💾 Save & exit to menu'}).click();
 }
}
async function botsResumeControl(page){
 if(await button(page,'▶ Resume bots').isVisible())return;
 await page.getByRole('button',{name:'Pause menu'}).click();
 await page.getByRole('dialog',{name:'Pause menu'}).getByRole('button',{name:'▶ Resume bots'}).waitFor();
 await page.getByRole('dialog',{name:'Pause menu'}).getByRole('button',{name:'▶ Resume game'}).click();
}

async function start(page){
 await page.getByRole('button',{name:/New game/}).first().click();
 await page.getByLabel('Bot pace').first().selectOption('turbo');
 await button(page,'Start setup').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orvane.library.v1')??'{"matches":[]}').matches.length>0);
}
async function exerciseWorker(page){
 const workers=[];page.on('worker',w=>workers.push(w.url()));
 await start(page);
 // Optional guided play is visible in a first-time match, but never blocks
 // toggling or real game actions.
 const coach=page.getByRole('complementary',{name:'Interactive tutorial'});
 await coach.waitFor();
 assert.ok(await coach.getByRole('button',{name:'Hide tutorial'}).isVisible());
 await coach.getByRole('button',{name:'Hide tutorial'}).click();
 await coach.waitFor({state:'detached',timeout:5000});
 await tutorialToggle(page);
 await coach.waitFor();
 await coach.getByRole('button',{name:'Hide tutorial'}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].tutorial);
 assert.equal(saved.version,1);assert.equal(saved.enabled,true);
 const stage=await page.locator('main.in-match').boundingBox(),map=await page.locator('.board-panel').boundingBox(),viewport=page.viewportSize();
 assert.ok(stage&&viewport&&Math.abs(stage.height-viewport.height)<8,'match uses the complete viewport');
 assert.ok(map&&map.height>175,'interactive board remains substantial');
 assert.equal(await page.locator('.game-sidebar').isVisible(),false,'journal hidden until opened');
 await page.getByRole('button',{name:'Open journal'}).click();
 await page.getByRole('button',{name:'Close game panel'}).waitFor();
 await page.getByRole('button',{name:'Close game panel'}).click();
 await page.getByRole('button',{name:'Pause menu'}).click();
 await page.getByRole('dialog',{name:'Pause menu'}).waitFor();
 await page.getByRole('button',{name:'▶ Resume game'}).click();
 assert.equal(await page.getByRole('dialog',{name:'Pause menu'}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no horizontal page overflow');
 // If the human starts, place the first settlement and its road via keyboard.
 for(let i=0;i<12&&!workers.length;i++){
  await sleep(100);
  if(workers.length)break;
  const legal=page.locator('g.vertex.legal-site, g.edge.legal-site').first();
  if(await legal.count()){
    await legal.focus();await legal.press('Enter');await confirmSite(page);
  }
 }
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].setup.step>=1);
 assert.ok(workers.length,'real module worker should start');
 assert.ok(workers.some(x=>/bot\.worker|bot-worker/.test(x)),workers.join(','));
 await saveAndExit(page);
 return workers[0];
}
async function iphoneTouch(browser){
 const device=devices['iPhone 15 Pro Max']??devices['iPhone 13'];
 const ctx=await browser.newContext({...device}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url+'?renderer=2d');await start(page);
  const coach=page.getByRole('complementary',{name:'Interactive tutorial'});
  if(await coach.isVisible())await coach.getByRole('button',{name:'Hide tutorial'}).click();
  const svg=page.locator('.board-panel [data-board-root]'),box=await page.locator('.board-panel').boundingBox();
  assert.ok(box&&box.height>280,'portrait island must have ample playing space');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'portrait has no horizontal document overflow');
  const initial=Number((await svg.getAttribute('viewBox')).split(' ')[2]);
  // Real app PointerEvent handlers: two simultaneous pointers for zoom,
  // then single-pointer movement to pan without scrolling the document.
  await page.evaluate(()=>{
   const el=document.querySelector('.board-panel [data-board-root]'),r=el.getBoundingClientRect();
   const cx=r.left+r.width/2,cy=r.top+r.height/2;
   const ptr=(type,id,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===11,button:0,buttons:1,clientX:x,clientY:y}));
   ptr('pointerdown',11,cx-60,cy);ptr('pointerdown',12,cx+60,cy);
   ptr('pointermove',11,cx-115,cy);ptr('pointermove',12,cx+115,cy);
   ptr('pointerup',11,cx-115,cy);ptr('pointerup',12,cx+115,cy);
  });
  await page.waitForFunction(initial=>Number(document.querySelector('.board-panel [data-board-root]').getAttribute('viewBox').split(' ')[2])<initial*.8,initial);
  const before=(await svg.getAttribute('viewBox')).split(' ').map(Number);
  await page.evaluate(()=>{
   const el=document.querySelector('.board-panel [data-board-root]'),r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
   const ptr=(type,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:33,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:x,clientY:y}));
   ptr('pointerdown',cx,cy);ptr('pointermove',cx+60,cy+16);ptr('pointerup',cx+60,cy+16);
  });
  await page.waitForFunction(before=>Math.abs(Number(document.querySelector('.board-panel [data-board-root]').getAttribute('viewBox').split(' ')[0])-before)>5,before[0]);
  await page.getByRole('button',{name:'Reset view'}).click();
  await page.waitForTimeout(400);
  const site=page.locator('g.vertex.legal-site, g.edge.legal-site').first();
  await site.waitFor({timeout:30000});
  await site.tap();
  assert.ok(await page.getByRole('button',{name:/✓ Place|Confirm placement/}).filter({visible:true}).first().isEnabled(),'real touchscreen tap selects a legal site');
  await page.setViewportSize({width:932,height:430});
  const landscape=await page.locator('.board-panel').boundingBox();
  assert.ok(landscape&&landscape.height>=130,'landscape keeps the board usable');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'landscape has no horizontal overflow');
  assert.deepEqual(errors,[]);
  console.log('WebKit iPhone 15 Pro Max: portrait HUD, pinch, pan, touch selection and landscape layout passed');
 }finally{await ctx.close();}
}
async function passAndPlay(browser,mobile=false){
 const ctx=await browser.newContext(mobile?{...devices['iPhone 13']}:{viewport:{width:1366,height:768}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url+'?renderer=2d');
  await page.getByRole('button',{name:/New game/}).first().click();
  await page.getByRole('button',{name:'6 players',exact:true}).click();
  await page.getByLabel('Humans').selectOption('2');
  await page.getByLabel('Bot pace').first().selectOption('turbo');
  await button(page,'Start setup').click();
  const gate=page.getByRole('dialog',{name:'Pass the device'});
  await gate.waitFor({timeout:30000});
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0]);
  assert.equal(await page.getByLabel('Your resources').count(),0,'no private hand before ready');
  assert.ok(before.setup.phase!=='complete');
  await gate.getByRole('button',{name:/I'm ready/}).click();
  await gate.waitFor({state:'hidden'});
  const vertex=page.locator('g.vertex.legal-site').first();await vertex.waitFor({timeout:30000});await vertex.focus();await vertex.press('Enter');await confirmSite(page);
  const edge=page.locator('g.edge.legal-site').first();await edge.waitFor({timeout:10000});await edge.focus();await edge.press('Enter');await confirmSite(page);
  // Another human must explicitly accept the next device handoff.
  await gate.waitFor({timeout:30000});
  assert.equal(await page.getByLabel('Your resources').count(),0,'next human hand hidden until confirmed');
  await page.waitForFunction(()=>{
   const r=JSON.parse(localStorage.getItem('orvane.library.v1')??'{"matches":[]}');
   return r.matches[0]?.setup.roads.some(p=>p.playerId<2);
  });
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0]);
  assert.equal(saved.preferences.humans,2);assert.equal(saved.preferences.count,6);
  assert.ok(saved.setup.settlements.some(p=>p.playerId<2));
  assert.ok(saved.tutorial.done.includes('settlement')&&saved.tutorial.done.includes('road'),'tutorial counts human setup moves');
  assert.deepEqual(errors,[]);console.log((mobile?'WebKit iPhone':'Chromium desktop')+' six-player pass-and-play: private seat handoff, legal placement and tutorial checkpoints passed');
 }finally{await ctx.close();}
}
async function run(){
 await ready();
 const browser=await chromium.launch();
 try{
  const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1366,height:768}});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?renderer=2d');
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  const workerUrl=await exerciseWorker(page);
  assert.ok(await page.evaluate(async u=>!!(await caches.match(u)),workerUrl),'worker included in offline cache');
  await page.getByRole('button',{name:/Saved games & statistics/}).click();
  const downloadPromise=page.waitForEvent('download');await button(page,'⬇ Export backup').click();const download=await downloadPromise;
  const backup=await readFile(await download.path(),'utf8');const parsed=JSON.parse(backup);assert.equal(parsed.format,'orvane-backup');assert.equal(parsed.library.matches.length,1);assert.ok(parsed.profile.id);assert.equal(parsed.library.matches[0].tutorial.version,1);
  await ctx.setOffline(true);await page.reload();await page.getByRole('button',{name:/Continue/}).first().click();await botsResumeControl(page);await saveAndExit(page);
  assert.deepEqual(errors,[]);await ctx.close();
  const target=await browser.newContext(),p=await target.newPage();await p.goto(url+'?renderer=2d');await p.getByRole('button',{name:/Saved games & statistics/}).click();
  await p.getByLabel('Backup JSON file').setInputFiles({name:'orvane.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await button(p,'Replace local data').click();await p.getByText('Backup restored.',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('orvane.profile.v1')).id),parsed.profile.id);
  await button(p,'← Main menu').click();await p.getByRole('button',{name:/Continue/}).first().click();await botsResumeControl(p);
  await target.close();console.log('Chromium desktop: full-viewport HUD, drawers, pause, worker, offline, save/resume and backups passed');
 await passAndPlay(browser);
 }finally{await browser.close();}
 const mobile=await webkit.launch();
 try{
  const ctx=await mobile.newContext({...devices['iPhone 13']});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'?renderer=2d');
  await exerciseWorker(page);await page.getByRole('button',{name:/Continue/}).first().click();await botsResumeControl(page);
  assert.deepEqual(errors,[]);await ctx.close();await passAndPlay(mobile,true);await iphoneTouch(mobile);console.log('WebKit iPhone viewport: HUD, touch gestures, handoff, drawer, pause, worker and save/resume passed');
 }finally{await mobile.close();}
}
try{await run();}finally{server.kill();}
