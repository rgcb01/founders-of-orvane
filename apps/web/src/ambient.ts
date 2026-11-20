// Original, quiet modal arpeggio. No recorded assets or external requests.
export const AMBIENT_BARS:readonly (readonly number[])[]=[
 [220,330,440,392,330,262,330,392],
 [196,294,392,349,294,247,294,330],
 [174.61,261.63,349.23,330,261.63,220,261.63,330],
 [196,294,392,440,392,294,247,220]
];
const THEMES:Record<string,{notes:number[][];type:OscillatorType}>={
 viking:{notes:[[196,294,392,349,294,220,262,294],[174.61,262,349,392,349,262,196,220]],type:'triangle'},
 imperial:{notes:[[262,330,392,523,392,330,294,392],[220,330,440,523,440,330,262,330]],type:'sine'},
 pirate:{notes:[[220,262,330,440,392,330,262,294],[196,247,294,392,349,294,247,220]],type:'triangle'},
 winter:{notes:[[262,392,523,587,523,392,330,294],[220,330,440,494,440,330,294,262]],type:'sine'},
 dragon:{notes:[[146.83,220,294,349,294,220,196,220],[130.81,196,262,311,262,196,174.61,196]],type:'triangle'},
 celestial:{notes:[[262,392,494,659,587,494,392,330],[220,330,440,587,523,440,330,294]],type:'sine'}
};
export function ambientBar(id:string,index:number){const theme=THEMES[id.replace(/-music$/,'')];const bars=theme?.notes??AMBIENT_BARS;return {notes:bars[index%bars.length],type:theme?.type??'sine'};}
export const AMBIENT_BAR_MS=4480;
export function scheduleAmbientBar(ctx:AudioContext,out:GainNode,index:number,id='classic-music'){
 const now=ctx.currentTime+.025,{notes:bar,type}=ambientBar(id,Math.floor(index/2));
 const nodes:OscillatorNode[]=[];
 function voice(f:number,t:number,d:number,amp:number,wave:OscillatorType,attack:number){
  const osc=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter();osc.type=wave;osc.frequency.value=f;filter.type='lowpass';filter.frequency.value=wave==='triangle'?1350:2100;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  osc.connect(filter);filter.connect(g);g.connect(out);osc.onended=()=>{osc.disconnect();filter.disconnect();g.disconnect();};osc.start(t);osc.stop(t+d+.015);nodes.push(osc);
 }
 // Alternating plucked phrases, a soft bass and breathing upper harmony.
 const root=bar[0]/2;
 voice(root,now,4.36,.035,'sine',.8);
 voice(bar[2]/2,now,4.36,.018,'triangle',1);
 voice(bar[1],now,4.36,.012,'sine',1.2);
 const order=index%2===0?[0,1,2,3,4,5,6,7]:[0,2,1,3,5,4,7,6];
 for(const [i,k] of order.entries()){
  if(index%4===3&&i===7)continue;
  const t=now+i*.56,f=bar[k];
  voice(f,t,.49,.044,type,.018);
  voice(f*2,t,.24,.009,'sine',.012);
 }
 for(const i of [0,4]){const f=bar[order[i]]*2;voice(f,now+i*.56,1.95,.013,'sine',.27);}
 return ()=>{for(const n of nodes)try{n.stop();}catch{}};
}
