import type {CardKind} from '@orvane/engine';
export const CARD_ART:Record<CardKind,{icon:string;title:string;description:string;color:string}>={
 knight:{icon:'⚔️',title:'Knight',description:'Move the robber and steal a resource.',color:'#bd8261'},
 roads:{icon:'🛤️',title:'Road building',description:'Place up to two free roads.',color:'#cda65b'},
 plenty:{icon:'🌾',title:'Abundance',description:'Take up to two available bank resources.',color:'#94b56d'},
 monopoly:{icon:'💰',title:'Monopoly',description:'Take all opponents’ cards of one resource.',color:'#c4a1e5'},
 victory:{icon:'🏆',title:'Victory point',description:'One hidden victory point.',color:'#e2c16f'}
};
export function CardArt({kind}:{kind:CardKind|null}){
 const art=kind===null?null:CARD_ART[kind];
 return <div className={'dev-art'+(art?'':' dev-back')} style={{borderColor:art?.color??'#d8bf83'}}><span className="dev-icon">{art?.icon??'🃏'}</span><strong>{art?.title??'Development'}</strong>{art&&<small>{art.description}</small>}</div>;
}
