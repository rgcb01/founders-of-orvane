import {decide,type WorkerRequest,type WorkerAnswer} from './botProtocol';
const scope=self as unknown as {onmessage:((e:MessageEvent<WorkerRequest>)=>void)|null;postMessage:(v:WorkerAnswer)=>void};
scope.onmessage=({data})=>{try{scope.postMessage({id:data.id,answer:decide(data.request)});}catch(e){scope.postMessage({id:data.id,error:e instanceof Error?e.message:'Bot decision failed'});}};
