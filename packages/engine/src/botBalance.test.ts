import {describe,it,expect} from 'vitest';
import {generateBoard,seededRandom,createSetup,applySetup,startGame,applyGame,decisionPlayer,RESOURCES,chooseSetupAction,chooseBotAction,rollDice,type Difficulty,type GameState,type PlayerCount} from './index';
import {chooseSetupAction as legacySetup,chooseBotAction as legacyAction} from '../benchmarks/bot091';
type Seat={difficulty:Difficulty;legacy?:boolean};
function simulate(seed:string,seats:Seat[],first:number){
 const count=seats.length as PlayerCount,board=generateBoard(seed,count<=4?'standard':'extended'),randoms=seats.map((_,i)=>seededRandom(seed+':seat:'+i)),dice=seededRandom(seed+':dice'),deck=seededRandom(seed+':deck');
 let setup=createSetup(board,count,first);
 while(setup.phase!=='complete'){
  const id=setup.order[setup.step],policy=seats[id];setup=applySetup(board,setup,(policy.legacy?legacySetup:chooseSetupAction)(board,setup,{difficulty:policy.difficulty,random:randoms[id]})!);
 }
 let state=startGame(board,setup,deck),turn=state.turn,offers=0,actions=0,builds=0,trades=0;
 while(state.phase!=='finished'&&state.round<=450&&actions<18000){
  if(state.turn!==turn){turn=state.turn;offers=0;}
  const id=decisionPlayer(state)!,policy=seats[id];
  let a=(policy.legacy?legacyAction:chooseBotAction)(board,state,{difficulty:policy.difficulty,random:randoms[id],offers})!;
  if(a.kind==='roll')a={...a,dice:rollDice(dice)};
  if(a.playerId!==id)throw Error('Wrong actor');
  if(a.kind==='offer'||a.kind==='counter')offers++;
  if(a.kind==='build'||a.kind==='freeRoad')builds++;
  if(a.kind==='accept'||a.kind==='bankTrade')trades++;
  state=applyGame(board,state,a);actions++;
  for(const k of RESOURCES)if(state.bank[k]+state.players.reduce((n,p)=>n+p.resources[k],0)!==(count<=4?19:24))throw Error('Resource conservation');
 }
 return {seed,first,winner:state.winner===null?null:(seats[state.winner].legacy?'legacy-'+seats[state.winner].difficulty:seats[state.winner].difficulty),round:state.round,actions,builds,trades};
}
function summarize(rows:ReturnType<typeof simulate>[]){
 const wins:Record<string,number>={};for(const r of rows)if(r.winner)wins[r.winner]=(wins[r.winner]??0)+1;
 return {matches:rows.length,finished:rows.filter(r=>r.winner!==null).length,wins,meanRounds:Math.round(rows.reduce((n,r)=>n+r.round,0)/rows.length*10)/10,actions:rows.reduce((n,r)=>n+r.actions,0),builds:rows.reduce((n,r)=>n+r.builds,0),trades:rows.reduce((n,r)=>n+r.trades,0)};
}
describe('seeded AI balance benchmark',()=>{
 it('runs rotating mixed-difficulty seats and old/new policy head to head',()=>{
  const tiers:Difficulty[]=['easy','normal','hard','expert'];
  const mixed=Array.from({length:80},(_,i)=>simulate('mixed-091-'+Math.floor(i/4),tiers.map((_,j)=>({difficulty:tiers[(j+i%4)%4]})),Math.floor(i/4)%4));
  const versus=Array.from({length:80},(_,i)=>simulate('versus-091-'+Math.floor(i/2),Array.from({length:4},(_,j)=>({difficulty:'expert',legacy:(j+i%2)%2===0})),Math.floor(i/2)%4));
  const extended=Array.from({length:40},(_,i)=>simulate('extended-091-'+Math.floor(i/2),Array.from({length:6},(_,j)=>({difficulty:'expert',legacy:(j+i%2)%2===0})),Math.floor(i/2)%6));
  console.log('AI PLANNER '+JSON.stringify({mixed:summarize(mixed),versus:summarize(versus),extended:summarize(extended)}));
  expect(mixed.every(r=>r.winner!==null&&r.builds>0)).toBe(true);
  expect(versus.every(r=>r.winner!==null&&r.trades>0)).toBe(true);
  expect(extended.every(r=>r.winner!==null&&r.trades>0)).toBe(true);
 },240000);
});
