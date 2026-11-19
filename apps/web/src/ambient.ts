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
export function scheduleAmbientBar(ctx:AudioContext,out:GainNode,index:number,id='classic-music'){
 const now=ctx.currentTime+.02,{notes:bar,type}=ambientBar(id,index);
 const nodes:OscillatorNode[]=[];
 for(const [i,f] of bar.entries()){
   const osc=ctx.createOscillator(),g=ctx.createGain(),t=now+i*.56;
   osc.type=type;osc.frequency.value=f;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.055,t+.025);g.gain.exponentialRampToValueAtTime(.001,t+.48);
   osc.connect(g);g.connect(out);osc.onended=()=>{osc.disconnect();g.disconnect();};osc.start(t);osc.stop(t+.5);nodes.push(osc);
 }
 return ()=>{for(const n of nodes)try{n.stop();}catch{}};
}
