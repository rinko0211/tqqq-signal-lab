import {marketDataAvailability} from "./market-calendar.ts";

export const DAILY_REQUIRED_SERIES=["TQQQ","QQQ","SPY","VIX"] as const;
export type DailyRequiredSeries=typeof DAILY_REQUIRED_SERIES[number];

type Bar={date:string};
type Series=Partial<Record<DailyRequiredSeries,Bar[]>>;

export type ProviderAttemptState="CURRENT"|"PROVIDER_PENDING"|"FAILED";
export type ProviderAttempt={
  attemptedAt:string;
  state:ProviderAttemptState;
  source:string;
  priorDataDate:string|null;
  commonDataDate:string|null;
  latestDates:Record<DailyRequiredSeries,string|null>;
  missingCompletedSessions:number|null;
  catchupDates:string[];
  observationOnlyDates:string[];
  displayedSignalDate:string|null;
  message:string;
  errors:string[];
};

const latest=(rows:Bar[]|undefined)=>rows?.at(-1)?.date??null;

/**
 * A successful but stale official response is an external availability state,
 * not an internal pipeline failure.  Only dates present across every required
 * series may enter the Daily dataset.  Recovered dates are ordered, older ones
 * remain observation-only, and only the newest common date may be displayed as
 * the current (still fail-closed if stale) Signal.
 */
export function assessProviderAttempt(args:{
  series:Series;
  priorDataDate?:string|null;
  attemptedAt?:string;
  source?:string;
}):ProviderAttempt{
  const attemptedAt=args.attemptedAt??new Date().toISOString();
  const latestDates=Object.fromEntries(DAILY_REQUIRED_SERIES.map(k=>[k,latest(args.series[k])])) as Record<DailyRequiredSeries,string|null>;
  const completeSets=DAILY_REQUIRED_SERIES.map(k=>new Set((args.series[k]??[]).map(x=>x.date)));
  const commonDates=(args.series.TQQQ??[]).map(x=>x.date).filter(date=>completeSets.every(s=>s.has(date))).sort();
  const commonDataDate=commonDates.at(-1)??null,priorDataDate=args.priorDataDate??null;
  const catchupDates=commonDates.filter(date=>!priorDataDate||date>priorDataDate);
  const availability=marketDataAvailability(commonDataDate??undefined,attemptedAt);
  const state:ProviderAttemptState=availability.state==="CURRENT"?"CURRENT":"PROVIDER_PENDING";
  const observationOnlyDates=catchupDates.slice(0,-1),displayedSignalDate=commonDataDate;
  const lag=Number.isFinite(availability.lagSessions)?availability.lagSessions:null;
  return{
    attemptedAt,state,source:args.source??"official providers",priorDataDate,commonDataDate,latestDates,
    missingCompletedSessions:lag,catchupDates,observationOnlyDates,displayedSignalDate,
    message:state==="CURRENT"
      ?`公式データは${commonDataDate}まで揃っています。`
      :`EXTERNAL DATA PENDING：公式データ提供元の共通日足は${commonDataDate??"未取得"}までです。再取得を継続し、現在シグナルは使用しないでください。`,
    errors:[],
  };
}

export function unavailableProviderAttempt(args:{
  error:unknown;
  priorDataDate?:string|null;
  attemptedAt?:string;
  source?:string;
}):ProviderAttempt{
  const attemptedAt=args.attemptedAt??new Date().toISOString(),priorDataDate=args.priorDataDate??null;
  return{
    attemptedAt,state:"PROVIDER_PENDING",source:args.source??"official providers",priorDataDate,
    commonDataDate:priorDataDate,latestDates:{TQQQ:null,QQQ:null,SPY:null,VIX:null},
    missingCompletedSessions:null,catchupDates:[],observationOnlyDates:[],displayedSignalDate:priorDataDate,
    message:"EXTERNAL DATA PENDING：公式データ提供元へ接続できません。再取得を継続し、現在シグナルは使用しないでください。",
    errors:[args.error instanceof Error?args.error.message:String(args.error)],
  };
}

export function failedProviderAttempt(args:{
  error:unknown;
  priorDataDate?:string|null;
  attemptedAt?:string;
  source?:string;
}):ProviderAttempt{
  const pending=unavailableProviderAttempt(args);
  return{...pending,state:"FAILED",message:"データ取得後の検証または内部処理に失敗しました。現在シグナルは使用しないでください。"};
}
