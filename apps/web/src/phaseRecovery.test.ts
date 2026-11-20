import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,freeRoadSites,robberVictims,emptyResources,RESOURCES,type Board,type GameState,type Resource} from '@orvane/engine';
import {saveMatch,readLibrary,DEFAULT_PREFS,type SavedMatch,type Store} from './persistence';
import {newTutorial} from './tutorial';
const storage=():Store=>{const m=new Map<string,string>();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>{m.set(k,v);}};};
function fixture(){
 const board=generateBoard('special-phase-097','extended');let setup=createSetup(board,6);
 while(setup.phase!=='complete'){
  const id=activePlayer(setup)!;setup=applySetup(board,setup,{kind:'settlement',playerId:id,id:legalSettlements(board,setup)[0]});
  setup=applySetup(board,setup,{kind:'road',playerId:id,id:legalRoads(board,setup)[0]});
 }
 const game=startGame(board,setup,()=>.5),store=storage();
 const checkpoint=(s:GameState)=>{
  const saved:SavedMatch={schema:1,id:'phase-097',createdAt:1,updatedAt:2,seed:board.seed,size:board.size,preferences:{...DEFAULT_PREFS,count:6,humans:2},setup,game:s,tutorial:newTutorial(true),activity:[],attempts:{turn:s.turn,count:0}};
  saveMatch(store,saved);const after=readLibrary(store).matches[0];expect(after.tutorial).toEqual(newTutorial(true));expect(after.game).toEqual(s);
  return after.game!;
 };
 return {board,game,checkpoint};
}
function fund(s:GameState,seat:number,k:Resource,n:number):GameState{
 if(s.bank[k]<n)throw Error('bank shortage in fixture');
 return {...s,bank:{...s.bank,[k]:s.bank[k]-n},players:s.players.map(p=>p.id===seat?{...p,resources:{...p.resources,[k]:p.resources[k]+n}}:p)};
}
function match(s:GameState,board:Board,a:Parameters<typeof applyGame>[2],checkpoint:(s:GameState)=>GameState){
 const expected=applyGame(board,s,a);const restored=applyGame(board,checkpoint(s),a);expect(restored).toEqual(expected);return restored;
}
describe('release special-phase resume',()=>{
 it('resumes seven discard and robber theft without changing the outcome',()=>{
  const {board,game,checkpoint}=fixture();
  let s=game;const target=1;
  for(const k of RESOURCES){const needed=Math.max(0,9-RESOURCES.reduce((n,k)=>n+s.players[target].resources[k],0));if(!needed)break;s=fund(s,target,k,Math.min(needed,s.bank[k]));}
  const seven=applyGame(board,s,{kind:'roll',playerId:s.active,dice:[3,4]});
  expect(seven.phase).toBe('discard');
  let next=checkpoint(seven);
  while(next.phase==='discard'){
    const id=Number(Object.keys(next.development.discards)[0]),required=next.development.discards[id],discard=emptyResources();let left=required;
    for(const k of RESOURCES){discard[k]=Math.min(left,next.players[id].resources[k]);left-=discard[k];}
    expect(left).toBe(0);
    next=match(next,board,{kind:'discard',playerId:id,resources:discard},checkpoint);
  }
  expect(next.phase).toBe('robber');
  const tile=board.tiles.find(t=>t.id!==next.development.robber)!;
  const victims=robberVictims(board,next,tile.id);
  next=match(next,board,{kind:'moveRobber',playerId:next.active,tileId:tile.id,victim:victims[0]??null,random:.5},checkpoint);
  expect(next.phase).toBe('action');
 });
 it('resumes a pending human offer and its acceptance atomically',()=>{
  const {board,game,checkpoint}=fixture();let s=applyGame(board,game,{kind:'roll',playerId:game.active,dice:[1,1]});
  s=fund(s,0,'forest',2);s=fund(s,1,'hill',2);
  const give={...emptyResources(),forest:1},want={...emptyResources(),hill:1};
  const offer=applyGame(board,s,{kind:'offer',playerId:0,to:1,give,want});
  expect(offer.offer?.to).toBe(1);
  const accepted=match(offer,board,{kind:'accept',playerId:1},checkpoint);
  expect(accepted.offer).toBeNull();expect(accepted.players[0].resources.hill).toBeGreaterThan(s.players[0].resources.hill);
 });
 it('resumes a development road card and two no-cost road placements',()=>{
  const {board,game,checkpoint}=fixture();const d=game.development,index=d.deck.indexOf('roads');expect(index).toBeGreaterThanOrEqual(0);
  const prepared:GameState={...game,development:{...d,deck:d.deck.filter((_,i)=>i!==index),hands:{...d.hands,[game.active]:[{id:99,kind:'roads',boughtTurn:0}]}}};
  let s=applyGame(board,prepared,{kind:'playCard',playerId:prepared.active,cardId:99});
  expect(s.phase).toBe('freeRoad');
  const oldRoads=s.roads.length,oldBank={...s.bank};
  while(s.phase==='freeRoad')s=match(s,board,{kind:'freeRoad',playerId:s.active,edgeId:freeRoadSites(board,s)[0]},checkpoint);
  expect(s.roads.length).toBeGreaterThan(oldRoads);expect(s.bank).toEqual(oldBank);
 });
 it('recovers the second action window for six players without an extra roll',()=>{
  const {board,game,checkpoint}=fixture();
  const rolled=applyGame(board,game,{kind:'roll',playerId:game.active,dice:[1,1]});
  const paired=applyGame(board,rolled,{kind:'end',playerId:game.active});expect(paired.paired).toBe(true);
  const next=match(paired,board,{kind:'end',playerId:paired.active},checkpoint);
  expect(next.paired).toBe(false);expect(next.phase).toBe('roll');
 });
});
