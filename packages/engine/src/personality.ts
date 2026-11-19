// Public and deterministic per board/seat: resuming a saved game retains personality.
export type BotPersonality='builder'|'merchant'|'expansionist'|'warlord';
export const PERSONALITIES={
 builder:{label:'Builder',icon:'🏰',settlement:1.05,city:1.16,road:.95,card:.94,trade:1},
 merchant:{label:'Merchant',icon:'⚓',settlement:1,city:1.02,road:.95,card:.95,trade:.8},
 expansionist:{label:'Expansionist',icon:'🛤️',settlement:1.15,city:.95,road:1.2,card:.92,trade:1},
 warlord:{label:'Warlord',icon:'⚔️',settlement:1,city:1,road:1.02,card:1.2,trade:1.08}
} as const;
const TYPES=Object.keys(PERSONALITIES) as BotPersonality[];
export function botPersonality(seed:string,seat:number):BotPersonality{
 let h=0;for(let i=0;i<seed.length;i++)h=(Math.imul(h,31)+seed.charCodeAt(i))>>>0;
 return TYPES[(h+seat)%TYPES.length];
}
