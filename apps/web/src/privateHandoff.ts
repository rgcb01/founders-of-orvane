// Presentation-only privacy gate for local pass-and-play (not cryptographic).
export function needsHandoff(humans:number,decision:number|null,readySeat:number|null):boolean{
 return humans>1&&decision!==null&&decision<humans&&readySeat!==decision;
}
export function privateHandSeat(humans:number,decision:number|null,readySeat:number|null):number|null{
 return humans===1?0:decision!==null&&decision<humans&&readySeat===decision?decision:null;
}
