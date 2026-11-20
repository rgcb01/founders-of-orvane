import {chooseBotAction,chooseSetupAction,botView,decisionPlayer,type Board,type GameState,type SetupState,type GameAction,type SetupAction,type Difficulty} from '@orvane/engine';
export type BotRequest={kind:'game';board:Board;state:GameState;difficulty:Difficulty;offers:number}|{kind:'setup';board:Board;state:SetupState;difficulty:Difficulty};
export type BotAnswer={kind:'game';action:GameAction|null}|{kind:'setup';action:SetupAction|null};
export type WorkerRequest={id:number;request:BotRequest};
export type WorkerAnswer={id:number;answer:BotAnswer}|{id:number;error:string};
// The transport itself contains only the policy's information set.
export function publicRequest(r:BotRequest):BotRequest{
 if(r.kind==='setup')return r;
 const id=decisionPlayer(r.state);return id===null?r:{...r,state:botView(r.state,id)};
}
export function decide(r:BotRequest):BotAnswer{
 return r.kind==='game'?{kind:'game',action:chooseBotAction(r.board,r.state,{difficulty:r.difficulty,offers:r.offers})}:{kind:'setup',action:chooseSetupAction(r.board,r.state,{difficulty:r.difficulty})};
}
