import {
  STRATEGIES,
  benchmark,
  holdoutForConfig,
  oosComparison,
  robustness,
  runBacktest,
  walkForward,
  type Dataset,
  type StrategyKey,
} from "./engine";
import {researchBundle} from "./research";

type Request={id:number;tab:string;dataset:Dataset;key:StrategyKey};
type Response={id:number;result?:unknown;error?:string};

const worker=self as unknown as {
  onmessage:((event:MessageEvent<Request>)=>void)|null;
  postMessage:(message:Response)=>void;
};

worker.onmessage=(event)=>{
  const {id,tab,dataset,key}=event.data;
  try{
    const config=STRATEGIES[key];
    let result:unknown=null;
    if(tab==="compare"){
      const bt=runBacktest(dataset,config);
      result={bt,comparison:oosComparison(dataset),holdout:holdoutForConfig(dataset,config),tqqq:benchmark(dataset,"tqqq"),qqq:benchmark(dataset,"qqq")};
    }else if(tab==="walk")result={wf:walkForward(dataset)};
    else if(tab==="robust")result={rob:robustness(dataset,config)};
    else if(tab==="research")result={research:researchBundle(dataset,config)};
    else if(tab==="year"||tab==="trades")result={bt:runBacktest(dataset,config)};
    worker.postMessage({id,result});
  }catch(error){worker.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
