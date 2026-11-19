// Original, quiet modal arpeggio. No recorded assets or external requests.
export const AMBIENT_BARS:readonly (readonly number[])[]=[
 [220,330,440,392,330,262,330,392],
 [196,294,392,349,294,247,294,330],
 [174.61,261.63,349.23,330,261.63,220,261.63,330],
 [196,294,392,440,392,294,247,220]
];
export function scheduleAmbientBar(ctx:AudioContext,out:GainNode,index:number){
 const now=ctx.currentTime+.02,bar=AMBIENT_BARS[index%AMBIENT_BARS.length];
 const nodes:OscillatorNode[]=[];
 for(const [i,f] of bar.entries()){
   const osc=ctx.createOscillator(),g=ctx.createGain(),t=now+i*.56;
   osc.type='sine';osc.frequency.value=f;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.055,t+.025);g.gain.exponentialRampToValueAtTime(.001,t+.48);
   osc.connect(g);g.connect(out);osc.onended=()=>{osc.disconnect();g.disconnect();};osc.start(t);osc.stop(t+.5);nodes.push(osc);
 }
 return ()=>{for(const n of nodes)try{n.stop();}catch{}};
}
