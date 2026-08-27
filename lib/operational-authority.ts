import {hasActiveProduction,productionConfigIsValid,type ProductionConfig} from "./production.ts";

export type OperationalSignalAuthority={
  generatedAt?:string;dataDate?:string;platformMode?:string;assetTicker?:string;strategy?:string;strategyVersion?:string;state?:string;
};
export type OperationalRuntimeAuthority={
  generatedAt?:string;actionStatus?:string;marketDataDate?:string;signalDate?:string;state?:string;errors?:string[];
};
export type OperationalForwardAuthority={schemaVersion?:number;appendOnly?:boolean;updatedAt?:string};
export type AuthorityBundleResult={ok:boolean;reasons:string[]};

const BASELINE={ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0"};
const validTimestamp=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));

/**
 * Pure user-facing authority contract. Every constituent may be individually
 * valid yet the bundle is unsafe when it belongs to different operational
 * generations or Production identities. Any mismatch is fail-closed.
 */
export function operationalAuthorityBundleIsCoherent(args:{
  signal:OperationalSignalAuthority|null|undefined;
  status:OperationalRuntimeAuthority|null|undefined;
  production:ProductionConfig|null|undefined;
  forward:OperationalForwardAuthority|null|undefined;
}):AuthorityBundleResult{
  const reasons:string[]=[];
  const {signal,status,production,forward}=args;
  if(!signal)reasons.push("Daily Signal authority is missing");
  if(!status)reasons.push("Daily runtime authority is missing");
  if(!productionConfigIsValid(production))reasons.push("Production authority is invalid");
  if(!forward||forward.schemaVersion!==1||forward.appendOnly!==true)reasons.push("Forward authority is missing or invalid");
  if(reasons.length||!signal||!status||!production)return{ok:false,reasons};

  if(status.actionStatus!=="success"||status.state==="failed"||(status.errors?.length??0)>0)reasons.push("Daily runtime status is failed or incomplete");
  if(!validTimestamp(signal.generatedAt)||!validTimestamp(status.generatedAt)||signal.generatedAt!==status.generatedAt)reasons.push("Signal and runtime generations do not match");
  if(!validTimestamp(forward.updatedAt)||forward.updatedAt!==signal.generatedAt||forward.updatedAt!==status.generatedAt)reasons.push("Forward generation does not match Signal/runtime generation");
  if(!signal.dataDate||signal.dataDate!==status.signalDate||signal.dataDate!==status.marketDataDate)reasons.push("Signal and runtime market-data dates do not match");
  if(signal.state!==status.state)reasons.push("Signal and runtime state do not match");
  if(signal.platformMode!==production.mode)reasons.push("Signal and Production control modes do not match");

  const active=hasActiveProduction(production),expected=active
    ?{ticker:production.selectedTicker!,strategy:production.selectedStrategy!,version:production.strategyVersion!}
    :BASELINE;
  if(signal.assetTicker!==expected.ticker||signal.strategyVersion!==expected.version||signal.strategy!==expected.strategy)reasons.push("Signal identity does not match current operational authority");

  return{ok:reasons.length===0,reasons};
}
