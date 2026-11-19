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
  const backup=await readFile(await download.path(),'utf8');const parsed=JSON.parse(backup);assert.equal(parsed.format,'orvane-backup');assert.equal(parsed.library.matches.length,1);assert.ok(parsed.profile.id);
  await ctx.setOffline(true);await page.reload();await page.getByRole('button',{name:/Continue/}).first().click();await page.getByRole('button',{name:'▶ Resume bots'}).waitFor();await button(page,'Save & exit').click();
  assert.deepEqual(errors,[]);await ctx.close();
  const target=await browser.newContext(),p=await target.newPage();await p.goto(url);await p.getByRole('button',{name:/Saved games & statistics/}).click();
  await p.getByLabel('Backup JSON file').setInputFiles({name:'orvane.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await button(p,'Replace local data').click();await p.getByText('Backup restored.',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('orvane.profile.v1')).id),parsed.profile.id);
  await button(p,'← Main menu').click();await p.getByRole('button',{name:/Continue/}).first().click();await p.getByRole('button',{name:'▶ Resume bots'}).waitFor();
  await target.close();console.log('Chromium desktop: worker, offline cache, save/resume, backup export/import passed');
 }finally{await browser.close();}
 const mobile=await webkit.launch();
 try{
  const ctx=await mobile.newContext({...devices['iPhone 13']});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await exerciseWorker(page);await page.getByRole('button',{name:/Continue/}).first().click();await page.getByRole('button',{name:'▶ Resume bots'}).waitFor();
  assert.deepEqual(errors,[]);await ctx.close();console.log('WebKit iPhone viewport: worker and save/resume passed');
 }finally{await mobile.close();}
}
try{await run();}finally{server.kill();}
