import {describe,it,expect} from 'vitest';
import {generateBoard,seededRandom,createSetup,applySetup,startGame,applyGame,chooseSetupAction,chooseBotAction,decisionPlayer,RESOURCES,botView,type PlayerCount,type GameState,type Difficulty} from './index';
function simulate(seed:string,count:PlayerCount,difficulty:Difficulty,limit=450){
 const random=seededRandom(seed),board=generateBoard(seed,count<=4?'standard':'extended');
 let setup=createSetup(board,count);
 while(setup.phase!=='complete')setup=applySetup(board,setup,chooseSetupAction(board,setup,{difficulty,random})!);
 let s=startGame(board,setup,random),offers=0,turn=s.turn,actions=0,builds=0,trades=0;
 while(s.phase!=='finished'&&s.round<=limit&&actions<18000){
   if(s.turn!==turn){turn=s.turn;offers=0;}
   const a=chooseBotAction(board,s,{difficulty,random,offers})!;
   expect(a.playerId).toBe(decisionPlayer(s));
   if(a.kind==='offer'||a.kind==='counter')offers++;
   if(a.kind==='build')builds++;
   if(a.kind==='accept'||a.kind==='bankTrade')trades++;
   s=applyGame(board,s,a);actions++;
   for(const k of RESOURCES)expect(s.bank[k]+s.players.reduce((n,p)=>n+p.resources[k],0)).toBe(count<=4?19:24);
 }
 return {board,s,actions,builds,trades};
}
describe('local bots',()=>{
 it('uses only own hand and public counts, not deck order or opponent composition',()=>{
   const {board,s}=simulate('privacy',4,'normal',1);
   const actor=decisionPlayer(s)!;
   const modified:GameState={...s,players:s.players.map(p=>p.id===actor?p:{...p,resources:{forest:0,pasture:0,field:0,hill:0,mountain:Object.values(p.resources).reduce((a,b)=>a+b,0)}}),development:{...s.development,deck:s.development.deck.slice().reverse(),hands:Object.fromEntries(s.players.map(p=>[p.id,p.id===actor?s.development.hands[p.id]:[{id:999,kind:'victory' as const,boughtTurn:0}]]))}};
   expect(botView(s,actor)).toEqual(botView(modified,actor));
   expect(chooseBotAction(board,s,{difficulty:'hard',random:seededRandom('same')})).toEqual(chooseBotAction(board,modified,{difficulty:'hard',random:seededRandom('same')}));
 });
 it('completes full games across 3–6 seats without illegal actions',()=>{
   const results=[3,4,5,6].flatMap(n=>[0,1].map(i=>simulate('match-'+n+'-'+i,n as PlayerCount,'hard')));
   console.log('Bot match results',JSON.stringify(results.map(({s,actions,builds,trades})=>({players:s.players.length,winner:s.winner,round:s.round,actions,builds,trades}))));
   expect(results.every(r=>r.actions<18000&&r.builds>0&&r.trades>0)).toBe(true);
   expect(results.filter(r=>r.s.winner!==null).length).toBeGreaterThanOrEqual(6);
 },60000);
 it('all four difficulties produce legal initial and game actions',()=>{
   for(const d of ['easy','normal','hard','expert'] as Difficulty[]){const r=simulate('difficulty-'+d,3,d,12);expect(r.actions).toBeGreaterThan(0);}
 },30000);
});
