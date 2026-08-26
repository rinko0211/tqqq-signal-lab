import { summarizeForward, type ForwardLedger, type ForwardSummary } from "./forward.ts";
import { summarizePhase5, type Phase5Ledger, type Phase5Summary } from "./phase5-forward.ts";
import { assessHealth, type ProductionConfig, type HealthState } from "./production.ts";

export type LifecycleStage="ACCUMULATING"|"INTERIM"|"FORMAL"|"STRONGER";
export type CandidateDecision="CONTINUE_FORWARD"|"DATA_REVIEW_REQUIRED"|"REVALIDATION_REQUIRED"|"PHASE6_ELIGIBLE"|"INSUFFICIENT_EVIDENCE";
export type UserAction="NONE"|"CHECK_DATA_AND_ACTIONS"|"RUN_PHASE6_HUMAN_REVIEW"|"REVALIDATE_PRODUCTION"|"URGENT_INTEGRITY_REVIEW";

export type LifecycleInputStatus={status?:string;errors?:string[];generatedAt?:string;latestDates?:Record<string,string>};
export type RuntimeStatus={actionStatus?:string;state?:string;marketDataDate?:string;errors?:string[]};

export type CandidateReview={
  version:string;ticker:string;decision:CandidateDecision;eligible:boolean;incumbent:boolean;reasons:string[];
  observations:number;liveObservations:number;missingRatio:number;executions:number;actionDaysPerYear:number;regimes:number;
  maxDd:number;historicalDd:number;adverseDdFloor:number;evidence:string;
};
export type ReviewEvent={key:string;stage:Exclude<LifecycleStage,"ACCUMULATING">;reviewDate:string;recordedAt:string;systemDecision:string;userAction:UserAction;candidateReviews:CandidateReview[]};
export type ProductionHealth={state:"NOT_IN_PRODUCTION"|HealthState;version:string|null;reasons:string[];nextHealthReview:string|null};
export type LifecycleLedger={
  schemaVersion:1;createdAt:string;updatedAt:string;appendOnly:true;
  schedule:{interim:string;formal:string;stronger:string};events:ReviewEvent[];
  current:{asOf:string;stage:LifecycleStage;systemDecision:string;userAction:UserAction;message:string;candidateReviews:CandidateReview[];productionHealth:ProductionHealth;nextReview:string|null};
};

const HIST_DD:Record<string,number>={
  "VS13-v1.0":-.3816,
  "QLD-VS13-Scaled-v1.0":-.2705,
  "UPRO-SPBT-v1.0":-.3457,
  "SSO-SPBT-Scaled-v1.0":-.2416,
};
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const dateOnly=(iso:string)=>iso.slice(0,10);
const yearsObserved=(n:number)=>Math.max(n/252,1/252);
const countRegimes=(ledger:Phase5Ledger,version:string)=>new Set(ledger.records.filter(r=>r.strategyVersion===version&&r.dataStatus==="VALID"&&!/Missing live observation/i.test(r.regime)).map(r=>r.regime)).size;
const phase5Integrity=(status?:LifecycleInputStatus|null)=>status?.status==="success"&&!(status.errors?.length);

export function lifecycleStage(asOf:string,schedule:LifecycleLedger["schedule"]):LifecycleStage{
  if(asOf>=schedule.stronger)return"STRONGER";
  if(asOf>=schedule.formal)return"FORMAL";
  if(asOf>=schedule.interim)return"INTERIM";
  return"ACCUMULATING";
}

function baseDecision(args:{version:string;ticker:string;incumbent:boolean;observations:number;liveObservations:number;missing:number;executions:number;regimes:number;maxDd:number;evidence:string;stage:LifecycleStage;integrity:boolean;regimeMinimum:number}) : CandidateReview {
  const {version,ticker,incumbent,observations,liveObservations,missing,executions,regimes,maxDd,evidence,stage,integrity,regimeMinimum}=args;
  const missingRatio=missing/Math.max(1,observations),apy=executions/yearsObserved(liveObservations),historicalDd=HIST_DD[version]??-.40,adverseDdFloor=historicalDd-.10,reasons:string[]=[];
  if(!integrity)reasons.push("Workflow/status integrity is not healthy");
  if(missingRatio>.01)reasons.push(`Missing/invalid ratio ${(missingRatio*100).toFixed(2)}% > 1%`);
  if(apy>40&&liveObservations>=63)reasons.push(`Action/Execution Days per year ${apy.toFixed(1)} > 40`);
  if(maxDd<adverseDdFloor)reasons.push(`Forward Max DD ${(maxDd*100).toFixed(1)}% breached adverse floor ${(adverseDdFloor*100).toFixed(1)}%`);
  if(stage==="FORMAL"||stage==="STRONGER"){
    if(liveObservations<252)reasons.push(`Only ${liveObservations} live observations; 12-month evidence not complete`);
    if(executions<6)reasons.push(`Only ${executions} non-zero-turnover executions; continue Forward rather than optimize activity`);
    if(regimes<regimeMinimum)reasons.push(`Only ${regimes} observed regimes; multiple-regime evidence insufficient`);
  }
  if(stage==="ACCUMULATING")return{version,ticker,incumbent,decision:"CONTINUE_FORWARD",eligible:false,reasons,observations,liveObservations,missingRatio,executions,actionDaysPerYear:apy,regimes,maxDd,historicalDd,adverseDdFloor,evidence};
  if(stage==="INTERIM"){
    const bad=!integrity||missingRatio>.01;
    return{version,ticker,incumbent,decision:bad?"DATA_REVIEW_REQUIRED":"CONTINUE_FORWARD",eligible:false,reasons,observations,liveObservations,missingRatio,executions,actionDaysPerYear:apy,regimes,maxDd,historicalDd,adverseDdFloor,evidence};
  }
  const severe=!integrity||missingRatio>.01||maxDd<adverseDdFloor||(apy>40&&liveObservations>=63);
  const evidenceEnough=liveObservations>=252&&executions>=6&&regimes>=regimeMinimum;
  const eligible=!severe&&evidenceEnough;
  return{version,ticker,incumbent,decision:severe?"REVALIDATION_REQUIRED":eligible?"PHASE6_ELIGIBLE":"INSUFFICIENT_EVIDENCE",eligible,reasons,observations,liveObservations,missingRatio,executions,actionDaysPerYear:apy,regimes,maxDd,historicalDd,adverseDdFloor,evidence};
}

function reviewCandidate(summary:Phase5Summary,ledger:Phase5Ledger,stage:LifecycleStage,status?:LifecycleInputStatus|null):CandidateReview{
  return baseDecision({version:summary.version,ticker:summary.ticker,incumbent:false,observations:summary.observations,liveObservations:summary.liveObservations,missing:summary.missing,executions:summary.executions,regimes:countRegimes(ledger,summary.version),maxDd:summary.metrics.maxDd,evidence:summary.evidence,stage,integrity:phase5Integrity(status),regimeMinimum:3});
}
function reviewIncumbent(summary:ForwardSummary|undefined,stage:LifecycleStage,runtime?:RuntimeStatus|null):CandidateReview{
  if(!summary)return baseDecision({version:"VS13-v1.0",ticker:"TQQQ",incumbent:true,observations:0,liveObservations:0,missing:1,executions:0,regimes:0,maxDd:0,evidence:"Insufficient",stage,integrity:false,regimeMinimum:4});
  return baseDecision({version:summary.version,ticker:"TQQQ",incumbent:true,observations:summary.observations,liveObservations:summary.observations,missing:summary.missing,executions:summary.orders,regimes:summary.regimes,maxDd:summary.metrics.maxDd,evidence:summary.evidence,stage,integrity:runtime?.actionStatus==="success"&&runtime?.state!=="failed",regimeMinimum:4});
}

function healthForProduction(production:ProductionConfig,phase5:Phase5Ledger,phase5Status:LifecycleInputStatus|null|undefined,runtime:RuntimeStatus|null|undefined,forward:ForwardLedger):ProductionHealth{
  if(production.mode!=="PRODUCTION"||!production.approvedByHuman||!production.strategyVersion)return{state:"NOT_IN_PRODUCTION",version:null,reasons:["No human-approved Production system is active"],nextHealthReview:production.nextHealthReview};
  const version=production.strategyVersion,p5=summarizePhase5(phase5).find(x=>x.version===version),legacy=summarizeForward(forward).find(x=>x.version===version),row=p5||legacy;
  if(!row)return{state:"Critical",version,reasons:["Selected Production version has no matching Forward ledger"],nextHealthReview:production.nextHealthReview};
  const integrity=p5?phase5Integrity(phase5Status):runtime?.actionStatus==="success",dataFresh=p5?phase5Status?.status==="success":runtime?.actionStatus==="success"&&runtime?.state!=="failed",historicalDd=HIST_DD[version]??-.40,dd=(row as any).metrics?.maxDd??(row as any).currentDd??0,sortino=(row as any).metrics?.sortino??0;
  const state=assessHealth({integrity:Boolean(integrity),dataFresh:Boolean(dataFresh),dd,historicalDd,rollingSortino:sortino,benchmarkGap:0,costRatio:1});
  const reasons:string[]=[];if(!integrity)reasons.push("Integrity/status failure detected");if(!dataFresh)reasons.push("Market/Forward data is not fresh");if(dd<historicalDd-.10)reasons.push("Forward drawdown is >10pt worse than frozen historical Max DD");if(state==="Healthy")reasons.push("No automated degradation trigger is active");
  return{state,version,reasons,nextHealthReview:production.nextHealthReview};
}

export function emptyLifecycleLedger(schedule:LifecycleLedger["schedule"],now=new Date().toISOString()):LifecycleLedger{
  const asOf=dateOnly(now);return{schemaVersion:1,createdAt:now,updatedAt:now,appendOnly:true,schedule,events:[],current:{asOf,stage:lifecycleStage(asOf,schedule),systemDecision:"ACCUMULATING",userAction:"NONE",message:"Forward evidence is accumulating. No user action is required.",candidateReviews:[],productionHealth:{state:"NOT_IN_PRODUCTION",version:null,reasons:[],nextHealthReview:null},nextReview:schedule.interim}};
}

export function updateLifecycleReview(args:{phase5:Phase5Ledger;forward:ForwardLedger;production:ProductionConfig;phase5Status?:LifecycleInputStatus|null;runtimeStatus?:RuntimeStatus|null;prior?:LifecycleLedger|null;now?:string}):LifecycleLedger{
  const now=args.now??new Date().toISOString(),asOf=dateOnly(now);if(!DATE_RE.test(asOf))throw Error("Invalid lifecycle review date");
  const schedule={interim:args.phase5.reviewSchedule.interim,formal:args.phase5.reviewSchedule.formal,stronger:args.phase5.reviewSchedule.stronger},out=args.prior?.schemaVersion===1?structuredClone(args.prior):emptyLifecycleLedger(schedule,now);if(JSON.stringify(out.schedule)!==JSON.stringify(schedule))throw Error("Lifecycle review schedule drift blocked");
  const stage=lifecycleStage(asOf,schedule),p5=summarizePhase5(args.phase5).map(s=>reviewCandidate(s,args.phase5,stage,args.phase5Status)),inc=reviewIncumbent(summarizeForward(args.forward).find(x=>x.id==="VS13"),stage,args.runtimeStatus),reviews=[inc,...p5],prodHealth=healthForProduction(args.production,args.phase5,args.phase5Status,args.runtimeStatus,args.forward),anyData=reviews.some(x=>x.decision==="DATA_REVIEW_REQUIRED"||x.decision==="REVALIDATION_REQUIRED"),eligible=reviews.filter(x=>x.eligible);
  let systemDecision="ACCUMULATING",userAction:UserAction="NONE",message="Forward evidence is accumulating. No user action is required.";
  if(prodHealth.state==="Critical"){systemDecision="PRODUCTION_INTEGRITY_CRITICAL";userAction="URGENT_INTEGRITY_REVIEW";message="Production integrity requires immediate review. Do not change strategy automatically.";}
  else if(prodHealth.state==="Revalidation Required"){systemDecision="PRODUCTION_REVALIDATION_REQUIRED";userAction="REVALIDATE_PRODUCTION";message="Production health trigger fired. Keep automatic strategy replacement disabled and perform revalidation.";}
  else if(stage==="INTERIM"){if(anyData){systemDecision="INTERIM_DATA_REVIEW_REQUIRED";userAction="CHECK_DATA_AND_ACTIONS";message="Interim review found a data/integrity issue. Check System Status; no promotion is permitted.";}else{systemDecision="INTERIM_CONTINUE_FORWARD";message="Six-month interim review completed. Continue Forward; promotion remains prohibited.";}}
  else if(stage==="FORMAL"||stage==="STRONGER"){if(anyData){systemDecision="REVALIDATION_REQUIRED";userAction="CHECK_DATA_AND_ACTIONS";message="Review found an integrity, drawdown, or turnover breach. No Production promotion is allowed.";}else if(eligible.length){systemDecision="PHASE6_HUMAN_DECISION_REQUIRED";userAction="RUN_PHASE6_HUMAN_REVIEW";message=`${eligible.map(x=>x.ticker).join(" / ")} passed the automated Forward gate. Human Phase 6 review is required before any Production change.`;}else{systemDecision="CONTINUE_FORWARD_INSUFFICIENT_EVIDENCE";message="Formal review completed but evidence is insufficient for Production approval. Continue Forward without changing parameters.";}}
  const milestone=stage==="INTERIM"?schedule.interim:stage==="FORMAL"?schedule.formal:stage==="STRONGER"?schedule.stronger:null;if(milestone&&asOf>=milestone&&!out.events.some(e=>e.reviewDate===milestone))out.events.push({key:`${stage}|${milestone}`,stage:stage as Exclude<LifecycleStage,"ACCUMULATING">,reviewDate:milestone,recordedAt:now,systemDecision,userAction,candidateReviews:reviews});
  const nextReview=asOf<schedule.interim?schedule.interim:asOf<schedule.formal?schedule.formal:asOf<schedule.stronger?schedule.stronger:null;out.updatedAt=now;out.current={asOf,stage,systemDecision,userAction,message,candidateReviews:reviews,productionHealth:prodHealth,nextReview};return out;
}

export function productionEligibleVersions(lifecycle:LifecycleLedger):string[]{if(lifecycle.current.systemDecision!=="PHASE6_HUMAN_DECISION_REQUIRED")return[];return lifecycle.current.candidateReviews.filter(x=>x.eligible).map(x=>x.version)}
