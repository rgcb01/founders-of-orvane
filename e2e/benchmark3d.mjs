import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium,devices} from 'playwright';
const url='http://127.0.0.1:4175/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=spawn('pnpm',['--filter','@orvane/web','exec','vite','preview','--host','127.0.0.1','--port','4175','--strictPort'],{stdio:'inherit'});
const quick=process.argv.includes('--quick');
const baselinePath=process.argv.find(a=>a.startsWith('--baseline='))?.slice(11);
const quantile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]:null;};
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await sleep(100);}assert.ok(ready,'preview server ready');
 browser=await chromium.launch({args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const cases=[];
 const device=devices['iPhone 15 Pro Max']??devices['iPhone 13 Pro Max'];
 const profiles=quick?[['desktop',{viewport:{width:1366,height:768},deviceScaleFactor:1}]]:[['desktop',{viewport:{width:1366,height:768},deviceScaleFactor:1}],['phone-portrait',device],['phone-landscape',devices['iPhone 13 Pro Max landscape']]];
 for(const [profile,options] of profiles)for(const players of (quick?[3,6]:[3,4,5,6])){
  const ctx=await browser.newContext(options);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url+'?benchmark3d=1');
   await page.getByRole('button',{name:/New game/}).first().click();
   await page.getByRole('button',{name:players+' players',exact:true}).click();
   await page.getByLabel('Humans').selectOption(String(players));
   await page.getByLabel('Map seed').fill('orvane-benchmark-v1');
   await page.getByRole('button',{name:'Generate',exact:true}).click();
   await page.getByLabel('Bot pace').first().selectOption('normal');
   await page.getByRole('button',{name:'Start setup',exact:true}).click();
   const gate=page.getByRole('dialog',{name:'Pass the device'});
   if(await gate.isVisible())await gate.getByRole('button',{name:/I'm ready/}).click();
   const canvas=page.locator('canvas[data-benchmark3d]');await canvas.waitFor({timeout:30000});
   const coach=page.getByRole('complementary',{name:'Interactive tutorial'});
   if(await coach.isVisible())await coach.getByRole('button',{name:'Hide tutorial'}).click();
   const snap=()=>canvas.evaluate(c=>({stats:JSON.parse(c.dataset.benchmark3d),counts:JSON.parse(c.dataset.renderCounts),ambientState:c.dataset.ambientState,targetFps:Number(c.dataset.targetFps),terrain:c.dataset.terrainBatchMetrics?JSON.parse(c.dataset.terrainBatchMetrics):null}));
   for(const quality of (quick?(players===6?['low','high','auto']:['low','high']):['low','medium','high','auto'])){
    await page.getByLabel('Graphics quality').selectOption(quality);
    await sleep(500);
    const before=await snap(),start=performance.now();
    await sleep(quality==='auto'?4000:quick?1000:3000);
    const after=await snap(),duration=(performance.now()-start)/1000;
    const frameDelta=after.counts.frames-before.counts.frames;
    const ambientDelta=after.counts.ambientFrames-before.counts.ambientFrames;
    assert.ok(frameDelta>=0&&ambientDelta>=0);
    if(quality==='low'){assert.equal(ambientDelta,0,'low quality idle has no ambient frames');assert.equal(after.targetFps,0);}
    else {assert.ok(ambientDelta>0,'ambient animation active');assert.equal(after.targetFps,60,'active quality targets 60 FPS');}
    const sampleCount=Math.min(frameDelta,after.stats.samples.length);
    const ambientSamples=(sampleCount?after.stats.samples.slice(-sampleCount):[]).filter(s=>s.ambient);
    // Warm the camera path before recording, then measure each submission separately.
    const zoomButton=i=>page.getByRole('button',{name:i%2?'Zoom out':'Zoom in',exact:true});
    for(let i=0;i<4;i++)await zoomButton(i).click();
    const interactive=[],eventToRender=[];
    const n=quick?24:40;
    for(let i=0;i<n;i++){
     const result=await zoomButton(i).evaluate(el=>{
      const canvas=document.querySelector('canvas[data-benchmark3d]');
      const before=JSON.parse(canvas.dataset.renderCounts).frames,t=performance.now();
      el.click();
      const end=performance.now(),stats=JSON.parse(canvas.dataset.benchmark3d);
      if(stats.frames!==before+1)throw Error('Expected one synchronous toolbar frame');
      return {sample:stats.samples.at(-1),elapsed:end-t};
     });
     assert.ok(!result.sample.ambient);interactive.push(result.sample);eventToRender.push(result.elapsed);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
    }
    const end=await snap();
    // Separately measure burst input: 20 events in one browser task, one queued frame.
    const burst=await canvas.evaluate(async c=>{
     const before=JSON.parse(c.dataset.renderCounts).frames,start=performance.now();
     for(let i=0;i<20;i++)c.dispatchEvent(new WheelEvent('wheel',{deltaY:i%2?10:-10,bubbles:true,cancelable:true}));
     const synchronousFrames=JSON.parse(c.dataset.renderCounts).frames-before;
     await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
     return {events:20,synchronousFrames,frames:JSON.parse(c.dataset.renderCounts).frames-before,elapsedMs:performance.now()-start};
    });
    assert.equal(burst.synchronousFrames,0,'wheel burst should not render synchronously');
    assert.equal(burst.frames,1,'wheel burst should render once');
    const last=end.stats.samples.at(-1);
    const item={profile,players,quality,targetFps:end.targetFps,tiles:end.stats.tiles,ambientFps:ambientDelta/duration,idleFrames:frameDelta,idleShadowUpdates:after.counts.shadowUpdates-before.counts.shadowUpdates,ambientCpuP50Ms:quantile(ambientSamples.map(s=>s.ms),.5),ambientCpuP95Ms:quantile(ambientSamples.map(s=>s.ms),.95),interactionCpuP50Ms:quantile(interactive.map(s=>s.ms),.5),interactionCpuP95Ms:quantile(interactive.map(s=>s.ms),.95),interactionCpuMaxMs:Math.max(...interactive.map(s=>s.ms)),interactionSamples:interactive.length,eventToRenderP95Ms:quantile(eventToRender,.95),interactionOver50Ms:interactive.filter(s=>s.ms>50).length,burst,interactionRawMs:interactive.map(s=>s.ms),drawCalls:last.drawCalls,triangles:last.triangles,geometries:end.stats.geometries,textures:end.stats.textures,pixelRatio:end.stats.pixelRatio,bufferWidth:end.stats.bufferWidth,bufferHeight:end.stats.bufferHeight,terrain:end.terrain};
    cases.push(item);console.log(JSON.stringify(item));
   }
   assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 }
 const report={schema:2,commit:process.env.GITHUB_SHA??null,renderer:'Chromium SwiftShader software WebGL',browser:browser.version(),platform:process.platform,quick,seed:'orvane-benchmark-v1',notes:'CPU submission times, not GPU timings; geometry and texture counts, not bytes. Phone profiles emulate viewport/DPR, not physical hardware. Initial setup, no long match. Schema 2 uses nearest-rank percentiles and isolated warmed toolbar submissions; not directly comparable to schema 1 latency.',cases};
 if(baselinePath){const baseline=JSON.parse(await readFile(baselinePath,'utf8'));assert.equal(baseline.schema,report.schema);assert.equal(baseline.renderer,report.renderer);assert.equal(baseline.seed,report.seed);const keys=['ambientFps','interactionCpuP95Ms','drawCalls','triangles','geometries','textures'];report.comparison=cases.map(row=>{const old=baseline.cases.find(c=>c.profile===row.profile&&c.players===row.players&&c.quality===row.quality);return {profile:row.profile,players:row.players,quality:row.quality,delta:old?Object.fromEntries(keys.map(k=>[k,Number.isFinite(row[k])&&Number.isFinite(old[k])?row[k]-old[k]:null])):null};});}
 await mkdir('artifacts/benchmark3d',{recursive:true});await writeFile('artifacts/benchmark3d/results.json',JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill();}
