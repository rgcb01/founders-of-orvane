export const TARGET_FPS=60;
export const FRAME_MS=1000/TARGET_FPS;
// A 120 Hz display submits at most 60 ambient frames; slower displays are not forced to catch up.
export function nextFrameDeadline(now:number,due:number):number|null{
 if(now+1<due)return null;
 return Math.max(due+FRAME_MS,now+FRAME_MS-1);
}
export type ResolutionState={cap:number;ratio:number;slow:number;fast:number};
export function resolutionCap(deviceRatio:number,tier:'low'|'medium'|'high'):number{
 const device=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
 return Math.min(device,tier==='high'?2:tier==='medium'?1.5:1);
}
export function resolutionStart(cap:number,previous?:ResolutionState):ResolutionState{
 const floor=Math.min(.75,cap);
 return {cap,ratio:previous?Math.max(floor,Math.min(cap,previous.ratio)):cap,slow:0,fast:0};
}
// Ambient cadence is an end-to-end pressure proxy, not GPU execution timing.
// Hysteresis avoids repeated buffer resizing when performance is near a threshold.
export function adaptResolution(state:ResolutionState,meanMs:number,fps:number,targetFps:number):ResolutionState{
 if(!Number.isFinite(meanMs)||!Number.isFinite(fps)||!Number.isFinite(targetFps)||meanMs<0||fps<=0||targetFps<=0)return {...state,slow:0,fast:0};
 const budget=1000/targetFps;
 const slow=meanMs>budget*.75||fps<targetFps*.85;
 const fast=meanMs<budget*.45&&fps>=targetFps*.92;
 const next={...state,slow:slow?state.slow+1:0,fast:fast?state.fast+1:0};
 if(next.slow>=2){next.ratio=Math.max(Math.min(.75,state.cap),state.ratio-.25);next.slow=0;next.fast=0;}
 else if(next.fast>=4){next.ratio=Math.min(state.cap,state.ratio+.25);next.slow=0;next.fast=0;}
 return next;
}
