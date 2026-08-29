import {hasActiveProduction,type ProductionConfig, type HealthState } from "./production.ts";
import type { LifecycleLedger } from "./lifecycle-review.ts";
import {isValidIsoMarketDate,marketDate,nyseReviewBoundaryReached} from "./market-calendar.ts";

export type HealthReviewEvent={key:string;dueDate:string;recordedAt:string;version:string;state:HealthState;timing:"ON_TIME"|"LATE_CURRENT_STATE_ONLY";reasons:string[]};
export type ProductionHealthLedger={schemaVersion:1;createdAt:string;updatedAt:string;appendOnly:true;events:HealthReviewEvent[];current:{active:boolean;version:string|null;lastReview:string|null;nextReview:string|null;state:"NOT_ACTIVE"|HealthState;userAction:"NONE"|"REVALIDATE_PRODUCTION"|"URGENT_INTEGRITY_REVIEW";message:string}};
const addMonths=(date:string,n:number)=>{const d=new Date(`${date}T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)};
const daysBetween=(a:string,b:string)=>Math.floor((new Date(`${b}T00:00:00Z`).getTime()-new Date(`${a}T00:00:00Z`).getTime())/86400000);
export function emptyProductionHealthLedger(now=new Date().toISOString()):ProductionHealthLedger{return{schemaVersion:1,createdAt:now,updatedAt:now,appendOnly:true,events:[],current:{active:false,version:null,lastReview:null,nextReview:null,state:"NOT_ACTIVE",userAction:"NONE",message:"No human-approved Production system is active."}}}
export function assertProductionHealthLedgerInternalIntegrity(ledger:ProductionHealthLedger){
  if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Production Health prior ledger is invalid; refusing append-only reset");const keys=new Set<string>(),logical=new Set<string>();let previousRecordedAt=-Infinity;for(const e of ledger.events){const id=`${e.version}|${e.dueDate}`;if(!e.key||e.key!==id||keys.has(e.key)||logical.has(id))throw Error(`Production Health integrity: duplicate/invalid event ${e.key}`);if(!isValidIsoMarketDate(e.dueDate)||!Number.isFinite(Date.parse(e.recordedAt)))throw Error(`Production Health integrity: invalid event date/timestamp ${e.key}`);const recordedAt=Date.parse(e.recordedAt);if(recordedAt<previousRecordedAt)throw Error(`Production Health integrity: out-of-order event chronology ${e.key}`);previousRecordedAt=recordedAt;keys.add(e.key);logical.add(id);}
}
export function updateProductionHealthLedger(args:{production:ProductionConfig;lifecycle:LifecycleLedger;prior?:ProductionHealthLedger|null;now?:string}):ProductionHealthLedger{
  const now=args.now??new Date().toISOString(),asOf=marketDate(now);if(args.prior)assertProductionHealthLedgerInternalIntegrity(args.prior);const out=args.prior?structuredClone(args.prior):emptyProductionHealthLedger(now),p=args.production;
  if(!hasActiveProduction(p)||!p.strategyVersion){out.updatedAt=now;out.current={active:false,version:null,lastReview:out.events.at(-1)?.dueDate??null,nextReview:null,state:"NOT_ACTIVE",userAction:"NONE",message:"No human-approved Production system is active."};return out}
  const health=args.lifecycle.current.productionHealth;
  if(health.version!==p.strategyVersion)throw Error(`HEALTH-001: lifecycle health version ${health.version} does not match Production ${p.strategyVersion}`);
  const episodeStart=p.effectiveDate,episodeEvents=out.events.filter(x=>x.version===p.strategyVersion&&(!episodeStart||x.dueDate>=episodeStart));
  const last=episodeEvents.at(-1),firstDue=p.nextHealthReview??(p.effectiveDate?addMonths(p.effectiveDate,3):null);let due=last?addMonths(last.dueDate,3):firstDue;
  if(!due)throw Error("HEALTH-002: Production review schedule is missing");
  // A historical late-review label is evidence, not a permanent scheduler flag.
  // Collapse only quarters that were already missed at the instant that late
  // event was actually recorded. Future quarters become eligible normally.
  if(last?.timing==="LATE_CURRENT_STATE_ONLY")while(nyseReviewBoundaryReached(due,last.recordedAt))due=addMonths(due,3);
  if(nyseReviewBoundaryReached(due,now)&&!out.events.some(x=>x.version===p.strategyVersion&&x.dueDate===due)){
    const late=daysBetween(due,asOf)>7;
    out.events.push({key:`${p.strategyVersion}|${due}`,dueDate:due,recordedAt:now,version:p.strategyVersion,state:health.state==="NOT_IN_PRODUCTION"?"Critical":health.state,timing:late?"LATE_CURRENT_STATE_ONLY":"ON_TIME",reasons:[...health.reasons,...(late?["Scheduled health review was missed by more than 7 days; no retrospective health state was fabricated"]:[])]});
    due=addMonths(due,3);
    if(late)while(nyseReviewBoundaryReached(due,now))due=addMonths(due,3);
  }
  const latest=out.events.filter(x=>x.version===p.strategyVersion&&(!episodeStart||x.dueDate>=episodeStart)).at(-1),state=health.state==="NOT_IN_PRODUCTION"?"Critical":health.state,userAction=state==="Critical"?"URGENT_INTEGRITY_REVIEW":state==="Revalidation Required"?"REVALIDATE_PRODUCTION":"NONE";
  out.updatedAt=now;out.current={active:true,version:p.strategyVersion,lastReview:latest?.dueDate??null,nextReview:due,state,userAction,message:userAction==="NONE"?`Production health is ${state}. No user action is required.${p.mode==="DECISION"?" A human decision is pending; the previously approved Production system remains active until a new approval is atomically committed.":""}`:`Production health is ${state}. Review the lifecycle action center before adding risk.`};return out;
}
