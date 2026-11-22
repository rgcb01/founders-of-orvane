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
 if(errors.length)throw Error(errors.join('\n'));await page.close();
 }
}finally{await browser?.close();server.kill();}
