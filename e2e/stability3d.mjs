import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const url='http://127.0.0.1:4176/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=spawn('pnpm',['--filter','@orvane/web','exec','vite','preview','--host','127.0.0.1','--port','4176','--strictPort'],{stdio:'inherit'});
const cycles=process.argv.includes('--quick')?6:40;
const readMatch=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0]);
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await sleep(100);}assert.ok(ready);
 browser=await chromium.launch({args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({viewport:{width:1366,height:768}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'?benchmark3d=1');
 const button=name=>page.getByRole('button',{name,exact:true}).first();
 await page.getByRole('button',{name:/New game/}).first().click();
 await button('6 players').click();await page.getByLabel('Humans').selectOption('1');
 await page.getByLabel('Map seed').fill('orvane-stability-v1');await button('Generate').click();await page.getByRole('combobox',{name:/^AI\b/}).selectOption('expert');
 await page.getByLabel('Bot pace').first().selectOption('turbo');
 await button('Start setup').click();
 const canvas=page.locator('canvas[data-benchmark3d]');await canvas.waitFor({timeout:30000});
 const coach=page.getByRole('complementary',{name:'Interactive tutorial'});if(await coach.isVisible())await coach.getByRole('button',{name:'Hide tutorial'}).click();
 const snapshots=[];
 await mkdir('artifacts/stability3d',{recursive:true});
 const report=()=>writeFile('artifacts/stability3d/checkpoints.json',JSON.stringify({seed:'orvane-stability-v1',cycles,players:6,snapshots},null,2));
 const sample=async label=>{const data=await canvas.evaluate(c=>({cache:JSON.parse(c.dataset.staticCache),scene:JSON.parse(c.dataset.sceneCache),terrain:JSON.parse(c.dataset.terrainBatchMetrics),stats:JSON.parse(c.dataset.benchmark3d),counts:JSON.parse(c.dataset.renderCounts)}));const record={label,scene:data.scene.scene,firstToken:data.cache.firstToken,firstPick:data.cache.firstPick,firstBatch:data.terrain.firstBatch,roots:data.scene.roots,geometries:data.stats.geometries,textures:data.stats.textures,frames:data.counts.frames};snapshots.push(record);await report();return record;};
 const initial=await sample('initial');
 // Use actual WebGL raycasts for human placement, letting the five bots run.
 for(let i=0;i<30;i++){
  const match=await readMatch(page);if(match.setup.phase==='complete')break;
  await page.waitForFunction(()=>{const m=JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0];const c=document.querySelector('canvas');return m.setup.phase==='complete'||(c&&JSON.parse(c.dataset.legalVertices??'[]').length+JSON.parse(c.dataset.legalEdges??'[]').length>0);},null,{timeout:60000});
  const current=await readMatch(page);if(current.setup.phase==='complete')break;
  const sites=await canvas.evaluate(c=>[...JSON.parse(c.dataset.legalVertices??'[]'),...JSON.parse(c.dataset.legalEdges??'[]')]);
  const rect=await canvas.boundingBox();assert.ok(rect);
  let placed=false;
  for(const site of sites){
   if(site.x<0||site.y<0||site.x>rect.width||site.y>rect.height)continue;
   await page.mouse.click(rect.x+site.x,rect.y+site.y);
   const confirm=button('Confirm placement');if(await confirm.isEnabled()){await confirm.click();placed=true;break;}
  }
  assert.ok(placed,'a legal site is selectable by raycast');
 }
 const setup=await readMatch(page);assert.equal(setup.setup.phase,'complete');
 assert.equal(setup.setup.settlements.length,12);assert.equal(setup.setup.roads.length,12);
 await button('Begin game').click();
 await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].game);
 // Pause bots, so resource comparisons measure a stable board rather than new pieces.
 const pause=button('⏸ Pause bots');if(await pause.isVisible())await pause.click();
 await page.getByLabel('Graphics quality').selectOption('low');await button('Reset view').click();await sleep(800);
 const settled=await sample('setup-complete');
 for(const key of ['scene','firstToken','firstPick','firstBatch'])assert.equal(settled[key],initial[key],'persistent '+key);
 for(let i=0;i<cycles;i++){
  await page.getByLabel('Graphics quality').selectOption('high');
  await button('Zoom in').click();await button('Zoom out').click();
  await page.getByLabel('Graphics quality').selectOption('low');
  await button('Reset view').click();
  const state=await sample('cycle-'+(i+1));
  for(const key of ['scene','firstToken','firstPick','firstBatch'])assert.equal(state[key],settled[key],'persistent '+key);
  assert.equal(state.geometries,settled.geometries,'geometry count stable on unchanged board');
  assert.equal(state.textures,settled.textures,'texture count stable in low quality');
 }
 const saved=await readMatch(page);await button('Save & exit').click();
 await page.getByRole('button',{name:/Continue/}).first().click();await canvas.waitFor({timeout:30000});
 const recovered=await readMatch(page);assert.deepEqual(recovered.game,saved.game,'saved game recovered unchanged');
 assert.deepEqual(errors,[]);
 await mkdir('artifacts/stability3d',{recursive:true});await writeFile('artifacts/stability3d/results.json',JSON.stringify({cycles,players:6,setupSettlements:12,setupRoads:12,snapshots,notes:'Software WebGL; repeated quality/camera changes on stable board after actual setup, not a complete match or physical-device soak.'},null,2));
 console.log('3D stability passed',JSON.stringify({cycles,initial,settled,final:snapshots.at(-1)}));
 await ctx.close();
}finally{await browser?.close();server.kill();}
