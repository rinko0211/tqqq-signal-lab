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
export function hasActiveProduction(p:ProductionConfig){return p.mode!=="RESEARCH"&&p.approvedByHuman&&Boolean(p.selectedTicker&&p.selectedStrategy&&p.strategyVersion)}
export const HEALTH_POLICY={version:"health-policy-1.1",recommended:"Hybrid",operational:"Daily automated",strategy:"Quarterly",formal:"Annual",eventDriven:"Immediate",reason:"低頻度の中期戦略では短期成績だけで戦略変更しない。自動Healthは実際に観測できるIntegrity・データ鮮度・DD・Action Daysを監視し、四半期Reviewでbroker実約定コスト・税・FX・商品構造など自動取得できない項目を人間が確認する。",alternatives:[{frequency:"Monthly",benefit:"問題を早く発見",cost:"取引標本が少なくNoiseが大きい",adopt:false},{frequency:"Quarterly",benefit:"運用劣化と手動確認項目の定期レビュー",cost:"単独で戦略変更は行わない",adopt:true},{frequency:"Annual",benefit:"Forward比較と正式再検証",cost:"日常障害の検知には遅い",adopt:true},{frequency:"Event-driven",benefit:"Integrity・商品構造異常へ即応",cost:"客観Triggerが必要",adopt:true},{frequency:"Hybrid",benefit:"日次自動監視＋四半期手動確認＋年次判断",cost:"状態管理が必要",adopt:true}]};
export const DEGRADATION_RULES=[
  "Forward DDがFrozen Historical Max DDより10pt以上悪化したらRevalidation Required",
  "実現Action Daysが40/年を超えたらRevalidation Required、24/年を超えたらWatch",
  "Daily/Phase5 upstream statusがNYSE営業日ベースで古い、またはIntegrity/Look-ahead/重複実行異常なら新規リスク追加を停止",
  "ETF目的・leverage・指数Methodology・流動性等の構造変更はEvent-drivenで人間が確認",
  "実broker約定コスト・税・FXはPaperから自動観測できないためQuarterly/Phase6で明示的に手動確認"
];
export function transitionMode(current:ProductionConfig,next:PlatformMode,approval?:{system:string;ticker:string;version:string;date:string;evidence?:string;finalReviewComplete?:boolean}):ProductionConfig{
  if(next==="DECISION")return{...current,mode:"DECISION",updatedAt:new Date().toISOString()};
  if(next==="PRODUCTION"){
    if(current.mode!=="DECISION")throw Error("DECISION review is required immediately before PRODUCTION");
    if(!approval)throw Error("Human approval is required");
    const selected=resolveProductionSystem(approval.ticker,approval.version,approval.system);
    if(approval.evidence!=="Strong"||!approval.finalReviewComplete)throw Error("Strong Forward evidence and completed Final Selection Review are required");
    return{...current,mode:"PRODUCTION",selectedTicker:selected.ticker,selectedStrategy:selected.strategy,strategyVersion:selected.version,approvedByHuman:true,approvalDate:approval.date,effectiveDate:approval.date,nextHealthReview:addMonths(approval.date,3),updatedAt:new Date().toISOString()};
  }
  return{...DEFAULT_PRODUCTION_CONFIG,updatedAt:new Date().toISOString()};
}
export function cancelDecision(current:ProductionConfig):ProductionConfig{
  if(current.mode!=="DECISION")throw Error("No DECISION state is active");
  if(hasActiveProduction(current))return{...current,mode:"PRODUCTION",updatedAt:new Date().toISOString()};
  return{...DEFAULT_PRODUCTION_CONFIG,updatedAt:new Date().toISOString()};
}
const addMonths=(date:string,n:number)=>{const d=new Date(date+"T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)};
export function assessHealth(x:{integrity:boolean;dataFresh:boolean;dd:number;historicalDd:number;actionDaysPerYear:number;structuralEvent?:boolean}):HealthState{
  if(!x.integrity||x.structuralEvent)return"Critical";
  if(!x.dataFresh||x.dd<x.historicalDd-.10||x.actionDaysPerYear>40)return"Revalidation Required";
  if(x.actionDaysPerYear>24)return"Watch";
  return"Healthy";
}
