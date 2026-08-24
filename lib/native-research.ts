import { STRATEGIES, runBacktest, type Metrics, type StrategyConfig } from "./engine.ts";
import { SCREENING, makeCrossTickerDataset, type CrossTicker } from "./cross-ticker.ts";
import { fixedOos } from "./research.ts";

export const NATIVE_RESEARCH_VERSION = "native-research-1.0.0";
type Payload={source?:string;retrievedAt?:string;crossSeries?:Record<string,any[]>};
type Family={id:string;name:string;hypothesis:string;config:StrategyConfig;complexity:number;parameter:string;neighbors:StrategyConfig[]};
export type NativeExperiment={ticker:CrossTicker;family:string;name:string;hypothesis:string;parameter:string;complexity:number;full:Metrics;oos:Metrics;stable:boolean;score:number;decision:"CANDIDATE"|"REJECT";reason:string};
export type NativeTickerResult={ticker:CrossTicker;status:"CANDIDATE SELECTED"|"RESEARCH QUEUE"|"EXCLUDED";commonName:string;nativeCandidate:string|null;version:string|null;hypothesis:string;families:number;experiments:NativeExperiment[]};
export type NativeResearchBundle={schemaVersion:1;buildVersion:string;generatedAt:string;source:string;track:"B2";policy:string;forwardCap:string;results:NativeTickerResult[];forwardCandidates:{ticker:CrossTicker;strategy:string;version:string}[];limitations:string[]};

const base=STRATEGIES.defensive;
const vt=(target:number):StrategyConfig=>({...base,sizing:"volTarget",targetPortfolioVol:target});
const stop=(x:number):StrategyConfig=>({...base,trailStop:x});
const families=(ticker:CrossTicker):Family[]=>{
  if(ticker==="TQQQ")return[
    {id:"shield",name:"Volatility Shield",hypothesis:"NASDAQ-100の上昇持続性を取り込み、急落だけを固定Stopと市場Filterで抑える。",config:base,complexity:0,parameter:"13% stop",neighbors:[stop(.12),stop(.14)]},
    {id:"voltarget",name:"Volatility Targeting",hypothesis:"3倍ETFの変動集中時にExposureを落とすとDD効率が改善する。",config:vt(.30),complexity:1,parameter:"30% target",neighbors:[vt(.27),vt(.33)]},
    {id:"trend",name:"Trend Confirmation",hypothesis:"NASDAQの長期Trend確認を強めればWhipsawを抑えられる。",config:STRATEGIES.trend,complexity:0,parameter:"pre-registered",neighbors:[]},
  ];
  if(ticker==="UPRO")return[
    {id:"shield",name:"Broad-Market Shield",hypothesis:"S&P 500は分散度が高く、共通VS13でもTrend persistenceを十分捉えられる。",config:base,complexity:0,parameter:"13% stop",neighbors:[stop(.12),stop(.14)]},
    {id:"voltarget",name:"Broad Volatility Target",hypothesis:"S&P 500では極端なMomentumより市場全体の変動抑制がRisk-adjusted returnへ寄与する。",config:vt(.25),complexity:1,parameter:"25% target",neighbors:[vt(.225),vt(.275)]},
    {id:"trend",name:"Broad Trend Confirmation",hypothesis:"広い市場の中長期Trend確認はセクター集中ETFより信頼性が高い。",config:STRATEGIES.trend,complexity:0,parameter:"pre-registered",neighbors:[]},
  ];
  return[
    {id:"shield",name:"Sector Volatility Shield",hypothesis:"集中セクターの高Betaを取り込みつつ、固定StopでCrash時の残存Exposureを抑える。",config:base,complexity:0,parameter:"13% stop",neighbors:[stop(.12),stop(.14)]},
    {id:"voltarget",name:"Sector Volatility Target",hypothesis:"集中度とgap riskが高いため、固定ExposureよりVolatility scalingが有効である。",config:vt(.25),complexity:1,parameter:"25% target",neighbors:[vt(.225),vt(.275)]},
    {id:"trend",name:"Sector Trend Confirmation",hypothesis:"セクターTrendの確認を強めることで大幅下落の滞在時間を減らす。",config:STRATEGIES.trend,complexity:0,parameter:"pre-registered",neighbors:[]},
  ];
};
const boundedScore=(m:Metrics,complexity:number)=>.30*m.calmar+.25*m.sortino+.20*m.sharpe+.20*m.cagr-.15*Math.abs(m.maxDd)-.05*complexity;
export function nativeResearchBundle(payload:Payload):NativeResearchBundle{
  const focus:CrossTicker[]=["TQQQ","UPRO","TECL"];
  const results=focus.map(ticker=>{
    const row=SCREENING.find(x=>x.ticker===ticker)!,ds=makeCrossTickerDataset(payload,row);
    if(!ds)return{ticker,status:"RESEARCH QUEUE" as const,commonName:"VS13 Common",nativeCandidate:null,version:null,hypothesis:"実データ不足",families:0,experiments:[]};
    const definitions=families(ticker),experiments=definitions.map(f=>{
      const full=runBacktest(ds,f.config).metrics,oos=fixedOos(ds,f.config).metrics;
      return{ticker,family:f.id,name:f.name,hypothesis:f.hypothesis,parameter:f.parameter,complexity:f.complexity,full,oos,stable:true,score:boundedScore(oos,f.complexity),decision:"REJECT" as const,reason:"候補比較中"};
    }).sort((a,b)=>b.score-a.score);
    let best:NativeExperiment|undefined;
    for(const candidate of experiments){
      const definition=definitions.find(x=>x.id===candidate.family)!;
      candidate.stable=!definition.neighbors.length||definition.neighbors.every(n=>{const m=fixedOos(ds,n).metrics;return m.calmar>=candidate.oos.calmar*.80&&m.cagr>=candidate.oos.cagr*.80&&m.maxDd>=candidate.oos.maxDd-.07});
      if(candidate.stable&&candidate.oos.ordersPerYear>=3&&candidate.oos.ordersPerYear<=20){best=candidate;break}
    }
    const common=experiments.find(x=>x.family==="shield")!;
    if(best){best.decision="CANDIDATE";best.reason=best.family===common.family?"専用複雑化は共通戦略を明確に上回らず、単純な共通系をNative候補として維持":"OOS複合Score、近傍安定性、注文数、複雑性を通過"}
    for(const x of experiments)if(x!==best)x.reason=!x.stable?"Parameter plateau不合格":x.complexity>0&&x.score<=common.score?"複雑性に見合うOOS改善なし":"複合Scoreで選抜候補に届かず";
    const selected=ticker==="TECL"?null:best;
    return{ticker,status:selected?"CANDIDATE SELECTED" as const:"RESEARCH QUEUE" as const,commonName:"VS13 Common",nativeCandidate:selected?.name||null,version:selected?`${ticker}-Native-v1.0`:null,hypothesis:experiments.map(x=>x.hypothesis).join(" "),families:experiments.length,experiments};
  });
  return{schemaVersion:1,buildVersion:NATIVE_RESEARCH_VERSION,generatedAt:new Date().toISOString(),source:payload.source||"Nasdaq Historical + Cboe VIX",track:"B2",policy:"Hypothesis-first; 3 families/ticker; one frozen candidate maximum; OOS multi-objective score with complexity penalty; parameter plateau required; no holdout-driven retuning.",forwardCap:"Common and Native combined maximum 6 live systems. New Native Forward requires human approval.",results,forwardCandidates:results.filter(x=>x.version&&x.ticker==="UPRO").map(x=>({ticker:x.ticker,strategy:x.nativeCandidate!,version:x.version!})),limitations:["Native候補の同じHistorical/OOS期間を研究に使用したため、優位性の最終判断は新しいForwardが必要。","TECLはOperational QualityとCommon-period DDの懸念が残り、Native候補をForwardへ送らない。","現存ETFを対象とするSurvivorship/Selection Biasは除去できず、Decision Logへ明記する。"]};
}
