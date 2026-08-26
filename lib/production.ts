import {STRATEGIES,type StrategyConfig} from "./engine.ts";

export type PlatformMode="RESEARCH"|"DECISION"|"PRODUCTION";
export type HealthState="Healthy"|"Watch"|"Revalidation Required"|"Critical";
export type ProductionConfig={schemaVersion:1;mode:PlatformMode;selectedTicker:string|null;selectedStrategy:string|null;strategyVersion:string|null;approvedByHuman:boolean;approvalDate:string|null;effectiveDate:string|null;lastHealthReview:string|null;nextHealthReview:string|null;updatedAt:string};
export type ProductionSystem={ticker:"TQQQ"|"UPRO"|"SSO"|"QLD";strategy:string;version:string;config:StrategyConfig;track:"A"|"B1"|"B2"|"P5"};
const scaledStop=.13*2/3;
const spbt=(stop:number):StrategyConfig=>({...STRATEGIES.defensive,weights:{trend:.36,momentum:.16,volatility:.28,market:.20},confirmDays:3,minHold:8,trailStop:stop});
export const PRODUCTION_SYSTEMS:ProductionSystem[]=[
  {ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0",config:STRATEGIES.defensive,track:"A"},
  {ticker:"TQQQ",strategy:"Volatility Shield 12%",version:"VS12-v1.0",config:{...STRATEGIES.defensive,trailStop:.12},track:"A"},
  {ticker:"TQQQ",strategy:"30% Volatility Targeting",version:"VT30-v1.0",config:{...STRATEGIES.defensive,sizing:"volTarget",targetPortfolioVol:.30},track:"A"},
  {ticker:"UPRO",strategy:"UPRO + Common VS13",version:"UPRO-VS13-v1.0",config:STRATEGIES.defensive,track:"B1"},
  {ticker:"UPRO",strategy:"UPRO Native Broad Volatility Target",version:"UPRO-Native-v1.0",config:{...STRATEGIES.defensive,sizing:"volTarget",targetPortfolioVol:.25},track:"B2"},
  {ticker:"UPRO",strategy:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",config:spbt(.13),track:"P5"},
  {ticker:"SSO",strategy:"SSO + S&P Broad Trend + scaled stop",version:"SSO-SPBT-Scaled-v1.0",config:spbt(scaledStop),track:"P5"},
  {ticker:"QLD",strategy:"QLD + Common VS13 + scaled stop",version:"QLD-VS13-Scaled-v1.0",config:{...STRATEGIES.defensive,trailStop:scaledStop},track:"P5"},
];
export function resolveProductionSystem(ticker:string,version:string,strategy?:string|null):ProductionSystem{
  const found=PRODUCTION_SYSTEMS.find(x=>x.ticker===ticker&&x.version===version);
  if(!found)throw Error(`CONFIG-001: unregistered production system ${ticker} / ${version}`);
  if(strategy&&strategy!==found.strategy)throw Error(`CONFIG-002: strategy name does not match ${version}`);
  return found;
}
export const DEFAULT_PRODUCTION_CONFIG:ProductionConfig={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
export const HEALTH_POLICY={version:"health-policy-1.0",recommended:"Hybrid",operational:"Daily automated",strategy:"Quarterly",formal:"Annual",eventDriven:"Immediate",reason:"約10〜12注文/年の中期戦略ではMonthlyの成績判定は標本が少なく誤警報が多い。一方、レバレッジETFの商品・データ・流動性リスクは日次監視が必要。四半期は劣化傾向の観察、年次は十分な取引数で正式再検証する。",alternatives:[{frequency:"Monthly",benefit:"問題を早く発見",cost:"取引標本が1件前後でNoiseとForward overfittingが大きい",adopt:false},{frequency:"Quarterly",benefit:"運用劣化の早期傾向と標本量の妥協",cost:"単独では正式な戦略変更に弱い",adopt:true},{frequency:"Semiannual",benefit:"Noiseを抑えやすい",cost:"商品構造・実装問題への反応が遅い",adopt:false},{frequency:"Annual",benefit:"正式再検証に十分な取引標本を得やすい",cost:"運用監視には遅すぎる",adopt:true},{frequency:"Event-driven",benefit:"商品・データ・DD異常へ即応",cost:"客観的Triggerがないと恣意的",adopt:true},{frequency:"Hybrid",benefit:"日次運用監視、四半期傾向、年次判断を分離",cost:"状態管理が必要",adopt:true}]};
export const DEGRADATION_RULES=["Forward DDがHistorical Max DDより10pt以上悪化、またはStress envelopeを超過","12か月Rolling Sortinoが0未満、かつ単純Benchmarkへ15pt以上劣後","実コストが想定8bpsの2倍を3回連続で超過","ETF目的・leverage・指数Methodology・流動性に重大変更","データ汚染、重複約定、Look-ahead、実行不能を検出"];
export function transitionMode(current:ProductionConfig,next:PlatformMode,approval?:{system:string;ticker:string;version:string;date:string;evidence?:string;finalReviewComplete?:boolean}):ProductionConfig{
  if(current.mode==="RESEARCH"&&next==="PRODUCTION")throw Error("DECISION review is required before PRODUCTION");
  if(next==="PRODUCTION"&&!approval)throw Error("Human approval is required");
  if(next==="DECISION")return{...current,mode:next,approvedByHuman:false,updatedAt:new Date().toISOString()};
  if(next==="PRODUCTION"){
    const selected=resolveProductionSystem(approval!.ticker,approval!.version,approval!.system);
    if(approval!.evidence!=="Strong"||!approval!.finalReviewComplete)throw Error("Strong Forward evidence and completed Final Selection Review are required");
    return{...current,mode:next,selectedTicker:selected.ticker,selectedStrategy:selected.strategy,strategyVersion:selected.version,approvedByHuman:true,approvalDate:approval!.date,effectiveDate:approval!.date,nextHealthReview:addMonths(approval!.date,3),updatedAt:new Date().toISOString()};
  }
  return{...DEFAULT_PRODUCTION_CONFIG,updatedAt:new Date().toISOString()};
}
const addMonths=(date:string,n:number)=>{const d=new Date(date+"T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)};
export function assessHealth(x:{integrity:boolean;dataFresh:boolean;dd:number;historicalDd:number;rollingSortino:number;benchmarkGap:number;costRatio:number;structuralEvent?:boolean}):HealthState{
  if(!x.integrity||x.structuralEvent)return"Critical";
  if(!x.dataFresh||x.dd<x.historicalDd-.10||x.costRatio>2)return"Revalidation Required";
  if(x.rollingSortino<0&&x.benchmarkGap<-.15)return"Watch";
  return"Healthy";
}
