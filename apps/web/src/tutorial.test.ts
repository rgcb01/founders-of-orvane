import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,activePlayer,applySetup,legalSettlements,legalRoads,startGame,applyGame,emptyResources,type GameState} from '@orvane/engine';
import {advanceTutorial,currentLesson,newTutorial,validTutorial,setTutorialEnabled,MILESTONES} from './tutorial';
function buildSetup(){
 const board=generateBoard('tutorial-tests','standard');let setup=createSetup(board,3,0),first:null|ReturnType<typeof createSetup>=null;
 while(setup.phase!=='complete'){const playerId=activePlayer(setup)!;if(first===null)first=setup;setup=applySetup(board,setup,{kind:'settlement',playerId,id:legalSettlements(board,setup)[0]});setup=applySetup(board,setup,{kind:'road',playerId,id:legalRoads(board,setup)[0]});}
 return {board,setup,first:first!};
}
describe('guided play',()=>{
 it('validates optional versioned state and only changes enabled state on request',()=>{
  const p=newTutorial(true);expect(validTutorial(p)).toBe(true);expect(validTutorial({...p,done:['road','road']})).toBe(false);
  expect(validTutorial({...p,done:['invented']})).toBe(false);expect(validTutorial({...p,version:2})).toBe(false);
  expect(setTutorialEnabled(p,false)).toEqual({...p,enabled:false});expect(advanceTutorial(newTutorial(false),null,null,null,null,1)).toEqual(newTutorial(false));
 });
 it('counts human placements, not bot placements, and tracks the real begin/roll transitions',()=>{
  const {board}=buildSetup();let s=createSetup(board,3,0),p=newTutorial(true);
  const botSettled=applySetup(board,{...s,order:[1,0,2,2,0,1]}, {kind:'settlement',playerId:1,id:legalSettlements(board,{...s,order:[1,0,2,2,0,1]})[0]});
  expect(advanceTutorial(p,{...s,order:[1,0,2,2,0,1]},botSettled,null,null,1)).toBe(p);
  const s1=applySetup(board,s,{kind:'settlement',playerId:0,id:legalSettlements(board,s)[0]});
  p=advanceTutorial(p,s,s1,null,null,1);expect(p.done).toEqual(['settlement']);
  const s2=applySetup(board,s1,{kind:'road',playerId:0,id:legalRoads(board,s1)[0]});
  p=advanceTutorial(p,s1,s2,null,null,1);expect(p.done).toEqual(['settlement','road']);
  expect(currentLesson(p,s2,null,true)?.id).toBe('settlement');
  let full=s2;while(full.phase!=='complete'){const id=activePlayer(full)!;full=applySetup(board,full,{kind:'settlement',playerId:id,id:legalSettlements(board,full)[0]});full=applySetup(board,full,{kind:'road',playerId:id,id:legalRoads(board,full)[0]});}
  expect(currentLesson(p,full,null,true)?.id).toBe('begin');
  const g=startGame(board,full,()=>.5);
  p=advanceTutorial(p,full,full,null,g,1);expect(p.done).toContain('begin');expect(currentLesson(p,full,g,true)?.id).toBe('roll');
  const rolled=applyGame(board,g,{kind:'roll',playerId:0,dice:[1,1]});
  p=advanceTutorial(p,full,full,g,rolled,1);expect(p.done).toContain('roll');
  expect(advanceTutorial(p,full,full,g,rolled,1)).toBe(p);
 });
 it('tracks actual bank trades, rejects canceled offers, and never marks other bots actions',()=>{
  const {board,setup}=buildSetup(),g=startGame(board,setup,()=>.5);
  const p=newTutorial(true),rolled=applyGame(board,g,{kind:'roll',playerId:0,dice:[1,1]});
  const actor=rolled.players[0],bank={...rolled.bank},hand={...actor.resources,forest:4,hill:0};
  for(const k of ['forest','hill'] as const)bank[k]+=actor.resources[k]-hand[k];
  const rich:GameState={...rolled,bank,players:rolled.players.map(pl=>pl.id===0?{...pl,resources:hand}:pl)};
  const traded=applyGame(board,rich,{kind:'bankTrade',playerId:0,give:'forest',want:'hill'});
  expect(advanceTutorial(p,setup,setup,rich,traded,1).done).toContain('trade');
  expect(advanceTutorial(p,setup,setup,rich,traded,0).done).not.toContain('trade');
  expect(MILESTONES).toHaveLength(9);
 });
 it('shows situational robber instructions without changing game state',()=>{
  const {board,setup}=buildSetup(),g=startGame(board,setup,()=>.5);
  const seven=applyGame(board,g,{kind:'roll',playerId:0,dice:[3,4]});
  expect(['discard','robber']).toContain(seven.phase);
  expect(currentLesson(newTutorial(true),setup,seven,true)?.id).toBe('robber');
  expect(currentLesson(newTutorial(false),setup,seven,true)).toBeNull();
  expect(currentLesson(newTutorial(true),setup,seven,false)?.id).toBe('watch');
 });
});
