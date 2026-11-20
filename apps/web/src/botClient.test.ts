import {describe,it,expect,vi} from 'vitest';
import {BotClient} from './botClient';
import {decide,publicRequest,type WorkerRequest,type WorkerAnswer} from './botProtocol';
import {generateBoard,createSetup,activePlayer,legalSettlements} from '@orvane/engine';
function fake(){
 const port={postMessage:vi.fn(),terminate:vi.fn(),onmessage:null as ((e:MessageEvent<WorkerAnswer>)=>void)|null,onerror:null,onmessageerror:null};
 return {port,reply:(data:WorkerAnswer)=>port.onmessage?.({data} as MessageEvent<WorkerAnswer>)};
}
const board=generateBoard('worker'),state=createSetup(board,4),request={kind:'setup' as const,board,state,difficulty:'hard' as const};
describe('background AI transport',()=>{
 it('returns a legal action and reuses the worker',async()=>{const f=fake(),factory=vi.fn(()=>f.port),client=new BotClient(factory);const p=client.request(request);const q=f.port.postMessage.mock.calls[0][0] as WorkerRequest;const answer=decide(q.request);f.reply({id:q.id,answer});expect(await p).toEqual(answer);expect(answer.action?.playerId).toBe(activePlayer(state));expect(legalSettlements(board,state)).toContain((answer.action as {id:string}).id);const p2=client.request(request);const q2=f.port.postMessage.mock.calls[1][0] as WorkerRequest;f.reply({id:q2.id,answer});await p2;expect(factory).toHaveBeenCalledTimes(1);client.dispose();});
 it('cancels in-flight requests and ignores old worker messages',async()=>{const a=fake(),b=fake(),factory=vi.fn().mockReturnValueOnce(a.port).mockReturnValueOnce(b.port),client=new BotClient(factory);const first=client.request(request);const rejected=expect(first).rejects.toThrow('cancelled');client.cancel();await rejected;const second=client.request(request);const old=a.port.postMessage.mock.calls[0][0] as WorkerRequest,next=b.port.postMessage.mock.calls[0][0] as WorkerRequest;const answer=decide(next.request);a.reply({id:old.id,answer});b.reply({id:next.id,answer});expect(await second).toEqual(answer);expect(a.port.terminate).toHaveBeenCalled();client.dispose();});
 it('uses the same legal policy if Worker is unsupported',async()=>{const client=new BotClient(()=>{throw Error('unsupported');});const answer=await client.request(request);expect(answer.kind).toBe('setup');expect(legalSettlements(board,state)).toContain((answer.action as {id:string}).id);client.dispose();});
});