import {describe,it,expect} from 'vitest';
import {requiredPanel,BUILD_ART} from './GameUI';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,COSTS} from '@orvane/engine';
function fixture(){const board=generateBoard('ui');let s=createSetup(board,4);while(s.phase!=='complete'){const playerId=activePlayer(s)!;s=applySetup(board,s,{kind:'settlement',playerId,id:legalSettlements(board,s)[0]});s=applySetup(board,s,{kind:'road',playerId,id:legalRoads(board,s)[0]});}return {board,game:startGame(board,s,()=>.5)};}
describe('match navigation',()=>{
 it('forces required human prompts and otherwise leaves panel choice free',()=>{const {board,game}=fixture();expect(requiredPanel(null,true)).toBeNull();expect(requiredPanel(game,true)).toBeNull();const seven=applyGame(board,game,{kind:'roll',playerId:0,dice:[3,4]});expect(requiredPanel(seven,true)).toBe('cards');expect(requiredPanel(seven,false)).toBeNull();expect(requiredPanel({...game,offer:{from:0,to:1,give:{...COSTS.road},want:{...COSTS.city}}},true)).toBe('trade');});
 it('exposes all three construction kinds',()=>{expect(Object.keys(BUILD_ART).sort()).toEqual(Object.keys(COSTS).sort());});
});
