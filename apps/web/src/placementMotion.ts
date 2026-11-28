// A rigid miniature falls onto the board, gives a small contact bounce and settles.
export function placementPose(progress:number):{lift:number;scaleY:number}{
 const t=Math.max(0,Math.min(1,progress));
 if(t<.62){const u=t/.62;return {lift:.68*(1-u*u),scaleY:1};}
 const u=(t-.62)/.38;
 return {lift:.075*Math.sin(Math.PI*u)*(1-u),scaleY:1-.035*Math.sin(Math.PI*u)*(1-u)};
}
