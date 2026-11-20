import {describe,it,expect} from 'vitest';
import {generateBoard,seededRandom,createSetup,applySetup,startGame,applyGame,chooseSetupAction,chooseBotAction,decisionPlayer,activePlayer,rollDice,RESOURCES,playerScore,VICTORY_TARGET,type Difficulty,type PlayerCount,type GameState} from '@orvane/engine';
import {saveMatch,readLibrary,latestUnfinished,DEFAULT_PREFS,type Store,type SavedMatch} from './persistence';
import {EMPTY_METRICS} from './matchMetrics';
import {newTutorial} from './tutorial';

const levels:Difficulty[]=['easy','normal','hard','expert'];
const store=():Store=>{const values=new Map<string,string>();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);}};};
type Summary={seed:string;players:number;humans:number;actions:number;rounds:number;winner:number;checkpoints:number;humanActions:number;trades:number;specials:number};
function play(seed:string,count:PlayerCount,humans:number,restore:boolean):Summary{
 const board=generateBoard(seed,count<=4?'standard':'extended'),randoms=Array.from({length:count},(_,id)=>seededRandom(seed+':seat:'+id)),dice=seededRandom(seed+':dice'),deck=seededRandom(seed+':deck');
 let setup=createSetup(board,count,(seed.length+count)%count);
 while(setup.phase!=='complete'){
   const id=activePlayer(setup)!,action=chooseSetupAction(board,setup,{difficulty:levels[id%4],random:randoms[id]})!;
   if(action.playerId!==id)throw Error('Incorrect setup actor');
   setup=applySetup(board,setup,action);
 }
 const storage=store(),id='release-'+seed;
 let game=startGame(board,setup,deck),actions=0,checkpoints=0,humanActions=0,trades=0,specials=0,offers=0,lastTurn=game.turn;
 const cap=count<=4?19:24;
 const match=(g:GameState):SavedMatch=>({schema:1,id,profileId:'release-profile',metrics:EMPTY_METRICS,tutorial:newTutorial(true),createdAt:1,updatedAt:2+actions,seed,size:board.size,preferences:{...DEFAULT_PREFS,count,humans,pace:'turbo',difficulty:'hard'},setup,game:g,activity:['Release audit'],attempts:{turn:g.turn,count:offers}});
 const checkpoint=()=>{
   saveMatch(storage,match(game));const loaded=readLibrary(storage).matches[0];
   if(JSON.stringify(loaded.game)!==JSON.stringify(game)||loaded.tutorial?.enabled!==true)throw Error('Snapshot changed during save/reload');
   game=loaded.game!;offers=loaded.attempts.count;checkpoints++;
 };
 if(restore)checkpoint();
 while(game.phase!=='finished'&&game.round<=450&&actions<18000){
   if(game.turn!==lastTurn){lastTurn=game.turn;offers=0;}
   const player=decisionPlayer(game);if(player===null)throw Error('Missing decision player');
   const choice=chooseBotAction(board,game,{difficulty:levels[(player+seed.length)%4],random:randoms[player],offers});
   if(!choice||choice.playerId!==player)throw Error('Invalid turn actor');
   const action=choice.kind==='roll'?{...choice,dice:rollDice(dice)}:choice;
   if(player<humans)humanActions++;
   if(action.kind==='offer'||action.kind==='counter')offers++;
   if(action.kind==='accept'||action.kind==='bankTrade')trades++;
   game=applyGame(board,game,action);actions++;
   if(game.phase==='robber'||game.phase==='discard'||game.phase==='freeRoad'||game.offer)specials++;
   for(const k of RESOURCES){
     if(game.bank[k]<0||game.bank[k]>cap)throw Error('Out of range bank');
     const total=game.players.reduce((n,p)=>n+p.resources[k],0)+game.bank[k];
     if(total!==cap||game.players.some(p=>!Number.isSafeInteger(p.resources[k])||p.resources[k]<0))throw Error('Broken resource conservation');
   }
   for(const p of game.players){
     if(game.roads.filter(r=>r.playerId===p.id).length>15||game.settlements.filter(s=>s.playerId===p.id&&s.kind==='settlement').length>5||game.settlements.filter(s=>s.playerId===p.id&&s.kind==='city').length>4)throw Error('Exceeded piece inventory');
   }
   if(restore&&(actions%37===0||game.phase==='discard'||game.phase==='robber'&&actions%2===0))checkpoint();
 }
 if(game.phase!=='finished'||game.winner===null)throw Error('Match did not finish');
 if(playerScore(game,game.winner,true).total<VICTORY_TARGET)throw Error('Victory without target points');
 if(humanActions===0)throw Error('No scripted human actions');
 if(restore){
   checkpoint();checkpoint();
   const library=readLibrary(storage);
   expect(library.results).toHaveLength(1);expect(library.results[0].id).toBe(id);
   expect(latestUnfinished(library)).toBeUndefined();
   expect(library.matches[0].game).toEqual(game);
 }
 return {seed,players:count,humans,actions,rounds:game.round,winner:game.winner,checkpoints,humanActions,trades,specials};
}
describe('release 0.9.6 complete-match audit',()=>{
 it('finishes deterministic 3–6-player matches with human-seat proxies and safe save/reload',()=>{
   const configs:[PlayerCount,number][]=[[3,1],[3,2],[4,1],[4,2],[5,1],[5,3],[6,1],[6,2],[6,5]];
   const results:Summary[]=[];
   for(const [count,humans] of configs)for(let run=0;run<3;run++){
     const seed='release-'+count+'-'+humans+'-'+run;
     const baseline=play(seed,count,humans,false);
     const restored=play(seed,count,humans,true);
     expect({rounds:restored.rounds,winner:restored.winner,actions:restored.actions,humanActions:restored.humanActions,trades:restored.trades,specials:restored.specials})
       .toEqual({rounds:baseline.rounds,winner:baseline.winner,actions:baseline.actions,humanActions:baseline.humanActions,trades:baseline.trades,specials:baseline.specials});
     results.push(restored);
   }
   expect(results).toHaveLength(configs.length*3);
   expect(results.some(r=>r.trades>0&&r.specials>0)).toBe(true);
   console.log('RELEASE AUDIT '+JSON.stringify({matches:results.length,allFinished:true,checkpoints:results.reduce((n,r)=>n+r.checkpoints,0),humanProxyActions:results.reduce((n,r)=>n+r.humanActions,0),minRounds:Math.min(...results.map(r=>r.rounds)),maxRounds:Math.max(...results.map(r=>r.rounds)),totalTrades:results.reduce((n,r)=>n+r.trades,0)}));
 },210000);
});
