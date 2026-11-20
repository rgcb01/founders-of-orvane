import {resourceEmoji,resourceName} from './resources';
// Lightweight inline resource art; text labels remain the accessible names.
export function ResourceIcon({resource}:{resource:keyof typeof resourceEmoji}){
 const shapes:Record<keyof typeof resourceEmoji,import("react").ReactNode>={
 forest:<><path d="M4 9 15 3 21 7 10 14Z" fill="#ab875e"/><path d="M4 9 10 14 10 21 4 16Z" fill="#76583e"/><path d="M10 14 21 7 21 14 10 21Z" fill="#936b49"/></>,
 pasture:<><path d="M3 10 8 4 17 4 21 10 19 18 7 20 3 15Z" fill="#eee9dd"/><path d="M12 4 17 4 21 10 19 18 12 20 15 12Z" fill="#c8c9bd"/></>,
 field:<><path d="M12 22V3" stroke="#a78442" strokeWidth="2"/><path d="M12 9 5 4 6 10 12 14 18 9 19 3Z M12 16 5 11 6 17 12 21 18 16 19 10Z" fill="#d5af59"/></>,
 hill:<><path d="M3 9 15 4 22 9 10 14Z" fill="#d49a7c"/><path d="M3 9 10 14 10 21 3 16Z" fill="#a2604b"/><path d="M10 14 22 9 22 16 10 21Z" fill="#bd795f"/></>,
 mountain:<><path d="M2 17 7 6 16 3 22 12 18 21 8 22Z" fill="#93a3ab"/><path d="M7 6 13 13 8 22 2 17Z" fill="#687e89"/><path d="M13 13 22 12 18 21 8 22Z" fill="#526b77"/></>
 };
 return <svg width="1.35em" height="1.35em" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{display:'inline-block',verticalAlign:'middle',pointerEvents:'none'}}>{shapes[resource]}</svg>;
}

export function ResourceFace({resource,count}:{resource:keyof typeof resourceEmoji;count:number}){return <span className={'resource-face resource-'+resource}><span className="resource-card-icon"><ResourceIcon resource={resource}/></span><small>{resourceName[resource]}</small><b>{count}</b></span>}
