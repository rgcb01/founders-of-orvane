// Run with the Vite development server on port 4173.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 for(const mode of (process.argv.slice(2).length?process.argv.slice(2):['human','bot','legacy','panels','panels-desktop'])) {
  const page=await browser.newPage({viewport:{width:mode==='panels'?390:1366,height:mode==='panels'?844:768},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?renderer=2d');
  await page.evaluate(async ({mode,engineUrl})=>{
   const e=await import(engineUrl);
   const {saveMatch,DEFAULT_PREFS}=await import('/src/persistence.ts');
   const seed='automatic-start',board=e.generateBoard(seed,'standard');
   let setup=e.createSetup(board,3,mode==='bot'?1:0);
   while(setup.phase!=='complete'){
    if((mode==='human'||mode==='bot')&&setup.step===setup.order.length-1&&setup.phase==='road')break;
    const playerId=e.activePlayer(setup),road=setup.phase==='road';
    setup=e.applySetup(board,setup,{playerId,kind:road?'road':'settlement',id:(road?e.legalRoads(board,setup):e.legalSettlements(board,setup))[0]});
   }
   let game=null;
   if(mode.startsWith('panels')){
    game=e.applyGame(board,e.startGame(board,setup,()=>.5),{kind:'roll',playerId:0,dice:[1,1]});
    for(const k of e.RESOURCES){game.bank[k]+=game.players[0].resources[k]-5;game.players[0].resources[k]=5;}
   }
   localStorage.removeItem('orvane.library.v1');
   saveMatch(localStorage,{schema:1,id:'auto-start',createdAt:1,updatedAt:2,seed,size:'standard',preferences:{...DEFAULT_PREFS,count:3,humans:1,pace:'turbo'},setup,game,activity:[],tutorial:{version:1,enabled:false,done:[]},attempts:{turn:0,count:0}});
  },{mode,engineUrl:'/@fs'+process.cwd()+'/packages/engine/src/index.ts'});
  await page.reload();await page.getByRole('button',{name:/Continue journey/}).click();
  if(mode==='human'){
   const road=page.locator('g.edge.legal-site').first();await road.focus();await road.press('Enter');
   await page.getByRole('button',{name:'✓ Place',exact:true}).click();
  }
  if(mode==='bot'){
   await page.getByRole('button',{name:'Pause menu',exact:true}).click();
   await page.getByRole('button',{name:'▶ Resume bots',exact:true}).click();
   await page.getByRole('button',{name:'▶ Resume game',exact:true}).click();
  }
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].game!==null);
  assert.equal(await page.getByRole('button',{name:/Begin game/}).count(),0);
  if(mode.startsWith('panels')){
   assert.equal(await page.locator('.fan-card').count(),25,'individual resource cards by default');
   await page.getByRole('button',{name:'Build',exact:true}).click();
   assert.equal(await page.locator('.build-option').count(),3);
   const hand=await page.locator('.resource-hand').boundingBox(),build=await page.locator('.build-menu').boundingBox();
   assert.ok(build.y+build.height<hand.y,'construction leaves the hand free');
   await page.screenshot({path:`/tmp/orvane-construction-${mode}.png`});
   await page.getByRole('button',{name:'Close construction',exact:true}).click();
   const road=page.locator('g.edge.legal-site').first();await road.focus();await road.press('Enter');
   await page.getByRole('button',{name:'✓ Build road',exact:true}).click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].game.roads.length===7);
   await page.getByRole('button',{name:'Trade',exact:true}).click();
   const panel=await page.locator('.game-sidebar').boundingBox();assert.ok(panel.y+panel.height<hand.y,'trade leaves the hand free');
   await page.getByRole('button',{name:'Bank give Lumber',exact:true}).click();
   await page.getByRole('button',{name:'Bank receive Brick',exact:true}).click();
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].game.players[0].resources);
   await page.getByRole('button',{name:/Exchange \d for 1/}).click();
   await page.waitForFunction(before=>{const r=JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].game.players[0].resources;return r.forest<before.forest&&r.hill===before.hill+1;},before);
   await page.getByRole('button',{name:'Players',exact:true}).click();
   await page.getByRole('button',{name:'Add give Wool',exact:true}).click();
   await page.getByRole('button',{name:'Add want Grain',exact:true}).click();
   assert.ok(await page.getByRole('button',{name:'Send offer',exact:true}).isEnabled());
   await page.locator('.game-sidebar').evaluate(el=>el.scrollTop=0);
   await page.screenshot({path:`/tmp/orvane-trade-${mode}.png`});
   await page.getByRole('button',{name:'Close game panel',exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  } else if(mode!=='bot') {
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0]);
   assert.equal(saved.game.turn,1);assert.equal(saved.game.phase,'roll');
   assert.equal(saved.game.roads.length,6);assert.equal(saved.game.settlements.length,6);
   await page.reload();await page.getByRole('button',{name:/Continue journey/}).click();
   const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('orvane.library.v1')).matches[0].game);
   assert.deepEqual(restored.development.deck,saved.game.development.deck,'resume never restarts the game');
  }
  assert.deepEqual(errors,[]);console.log('PASS',mode);await page.close();
 }
} finally {await browser.close();}
