import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium,webkit,devices} from 'playwright';
const url='http://127.0.0.1:4173/';
const server=spawn('pnpm',['--filter','@orvane/web','exec','vite','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw Error('Preview did not start');}
const button=(page,name)=>page.getByRole('button',{name,exact:true}).first();
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
 assert.equal(await coach.count(),0);
 await page.getByRole('button',{name:'Guided tutorial'}).click();
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
    await legal.focus();await legal.press('Enter');await button(page,'Confirm placement').click();
  }
 }
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].setup.step>=1);
 assert.ok(workers.length,'real module worker should start');
 assert.ok(workers.some(x=>/bot\.worker|bot-worker/.test(x)),workers.join(','));
 await button(page,'Save & exit').click();
 return workers[0];
}
async function passAndPlay(browser){
 const ctx=await browser.newContext({viewport:{width:1366,height:768}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url);
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
  const vertex=page.locator('g.vertex.legal-site').first();await vertex.waitFor({timeout:30000});await vertex.focus();await vertex.press('Enter');await button(page,'Confirm placement').click();
  const edge=page.locator('g.edge.legal-site').first();await edge.waitFor({timeout:10000});await edge.focus();await edge.press('Enter');await button(page,'Confirm placement').click();
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
  assert.deepEqual(errors,[]);console.log('Chromium six-player pass-and-play: private seat handoff, legal placement and tutorial checkpoints passed');
 }finally{await ctx.close();}
}
async function run(){
 await ready();
 const browser=await chromium.launch();
 try{
  const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1366,height:768}});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  const workerUrl=await exerciseWorker(page);
  assert.ok(await page.evaluate(async u=>!!(await caches.match(u)),workerUrl),'worker included in offline cache');
  await page.getByRole('button',{name:/Saved games & statistics/}).click();
  const downloadPromise=page.waitForEvent('download');await button(page,'⬇ Export backup').click();const download=await downloadPromise;
  const backup=await readFile(await download.path(),'utf8');const parsed=JSON.parse(backup);assert.equal(parsed.format,'orvane-backup');assert.equal(parsed.library.matches.length,1);assert.ok(parsed.profile.id);assert.equal(parsed.library.matches[0].tutorial.version,1);
  await ctx.setOffline(true);await page.reload();await page.getByRole('button',{name:/Continue/}).first().click();await page.getByRole('button',{name:'▶ Resume bots'}).waitFor();await button(page,'Save & exit').click();
  assert.deepEqual(errors,[]);await ctx.close();
  const target=await browser.newContext(),p=await target.newPage();await p.goto(url);await p.getByRole('button',{name:/Saved games & statistics/}).click();
  await p.getByLabel('Backup JSON file').setInputFiles({name:'orvane.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await button(p,'Replace local data').click();await p.getByText('Backup restored.',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('orvane.profile.v1')).id),parsed.profile.id);
  await button(p,'← Main menu').click();await p.getByRole('button',{name:/Continue/}).first().click();await p.getByRole('button',{name:'▶ Resume bots'}).waitFor();
  await target.close();console.log('Chromium desktop: full-viewport HUD, drawers, pause, worker, offline, save/resume and backups passed');
 await passAndPlay(browser);
 }finally{await browser.close();}
 const mobile=await webkit.launch();
 try{
  const ctx=await mobile.newContext({...devices['iPhone 13']});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await exerciseWorker(page);await page.getByRole('button',{name:/Continue/}).first().click();await page.getByRole('button',{name:'▶ Resume bots'}).waitFor();
  assert.deepEqual(errors,[]);await ctx.close();console.log('WebKit iPhone viewport: HUD, drawer, pause, worker and save/resume passed');
 }finally{await mobile.close();}
}
try{await run();}finally{server.kill();}
