import type {Result} from './persistence';
export type Goal={id:string;title:string;period:'daily'|'weekly';target:number;xp:number;value:(r:Result)=>number};
export const GOALS:Goal[]=[
 {id:'daily-play',title:'Complete a solo match',period:'daily',target:1,xp:50,value:()=>1},
 {id:'daily-harvest',title:'Produce 20 resources',period:'daily',target:20,xp:50,value:r=>r.metrics?.produced??0},
 {id:'weekly-play',title:'Complete 3 solo matches',period:'weekly',target:3,xp:150,value:()=>1},
 {id:'weekly-wins',title:'Win 2 solo matches',period:'weekly',target:2,xp:200,value:r=>r.winner===0?1:0},
 {id:'weekly-trade',title:'Complete 10 trades',period:'weekly',target:10,xp:150,value:r=>(r.metrics?.trades??0)+(r.metrics?.bankTrades??0)}
];
export function periodKey(time:number,period:Goal['period']){
 const d=new Date(time);
 if(period==='weekly')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 return d.toISOString().slice(0,10);
}
export function challengeLedger(results:readonly Result[]){
 const groups=new Map<string,{goal:Goal;key:string;progress:number}>();
 for(const r of results){if(!r.metrics||r.humans!==1)continue;for(const goal of GOALS){const key=periodKey(r.endedAt,goal.period),id=goal.id+':'+key;const old=groups.get(id);groups.set(id,{goal,key,progress:(old?.progress??0)+goal.value(r)});}}
 return [...groups.entries()].map(([id,g])=>({id,key:g.key,goal:g.goal,progress:g.progress,complete:g.progress>=g.goal.target}));
}
export function currentChallenges(results:readonly Result[],now=Date.now()){
 const ledger=challengeLedger(results);
 return GOALS.map(goal=>{const key=periodKey(now,goal.period);return ledger.find(g=>g.id===goal.id+':'+key)??{id:goal.id+':'+key,key,goal,progress:0,complete:false};});
}
export function aggregateMetrics(results:readonly Result[]){
 return results.reduce((m,r)=>{const s=r.metrics;if(s){m.produced+=s.produced;m.trades+=s.trades+s.bankTrades;m.roads+=s.roads;m.settlements+=s.settlements;m.cities+=s.cities;m.armies+=Number(s.largestArmy);m.longestRoad=Math.max(m.longestRoad,s.longestRoad);m.maxCities=Math.max(m.maxCities,s.cities);m.tracked++;}return m;},{produced:0,trades:0,roads:0,settlements:0,cities:0,armies:0,longestRoad:0,maxCities:0,tracked:0});
}
export function orderedResults(results:readonly Result[]){return [...results].sort((a,b)=>a.endedAt-b.endedAt||a.id.localeCompare(b.id));}
export function winStreak(results:readonly Result[]){let streak=0,best=0;for(const r of orderedResults(results)){streak=r.winner===0?streak+1:0;best=Math.max(best,streak);}return best;}
