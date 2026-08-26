import { summarizeForward, type ForwardLedger, type ForwardSummary } from "./forward.ts";
import { summarizePhase5, type Phase5Ledger, type Phase5Summary } from "./phase5-forward.ts";
import { assessHealth, type ProductionConfig, type HealthState } from "./production.ts";
import {summarizeRegimeCoverage} from "./regime-coverage.ts";
import {compareCandidateToIncumbent,type ParetoMerit} from "./forward-pareto.ts";
import {marketDataLagSessions,upstreamWorkflowFresh} from "./market-calendar.ts";

export type LifecycleStage="ACCUMULATING"|"INTERIM"|"FORMAL"|"STRONGER";
export type CandidateDecision="CONTINUE_FORWARD"|"DATA_REVIEW_REQUIRED"|"REVALIDATION_REQUIRED"|"PHASE6_ELIGIBLE"|"INSUFFICIENT_EVIDENCE";
export type UserAction="NONE"|"CHECK_DATA_AND_ACTIONS"|"RUN_PHASE6_HUMAN_REVIEW"|"REVALIDATE_PRODUCTION"|"URGENT_INTEGRITY_REVIEW";
export type LifecycleInputStatus={status?:string;errors?:string[];generatedAt?:string;latestDates?:Record<string,string>};
export type RuntimeStatus={generatedAt?:string;actionStatus?:string;state?:string;marketDataDate?:string;errors?:string[]};
export type CandidateReview={
  version:string;ticker:string;decision:CandidateDecision;eligible:boolean;incumbent:boolean;promotionSelectable:boolean;promotionMerit:ParetoMerit|"INCUMBENT";reasons:string[];
  observations:number;liveObservations:number;missingRatio:number;executions:number;actionDaysPerYear:number;regimes:number;regimeFamilies:string[];regimeCoverageOk:boolean;
  totalReturn:number;sortino:number;calmar:number;maxDd:number;historicalDd:number;adverseDdFloor:number;evidence:string;paretoCommonDays:number;
};
export type ReviewEvent={key:string;stage:Exclude<LifecycleStage,"ACCUMULATING">;reviewDate:string;recordedAt:string;systemDecision:string;userAction:UserAction;candidateReviews:CandidateReview[]};
export type ProductionHealth={state:"NOT_IN_PRODUCTION"|HealthState;version:string|null;reasons:string[];nextHealthReview:string|null};
export type LifecycleLedger={schemaVersion:1;createdAt:string;updatedAt:string;appendOnly:true;schedule:{interim:string;formal:string;stronger:string};events:ReviewEvent[];current:{asOf:string;stage:LifecycleStage;systemDecision:string;userAction:UserAction;message:string;candidateReviews:CandidateReview[];productionHealth:ProductionHealth;nextReview:string|null}};

const HIST_DD:Record<string,number>={"VS13-v1.0":-.3816,"QLD-VS13-Scaled-v1.0":-.2705,"UPRO-SPBT-v1.0":-.3457,"SSO-SPBT-Scaled-v1.0":-.2416};
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const dateOnly=(iso:string)=>iso.slice(0,10);
const yearsObserved=(n:number)=>Math.max(n/252,1/252);

function minDate(values:string[]){return values.filter(Boolean).sort()[0]}
function phase5StatusQuality(status:LifecycleInputStatus|null|undefined,now:string,strictCurrent:boolean){
  const commonDate=status?.latestDates?minDate(Object.values(status.latestDates)):undefined;
  const lag=marketDataLagSessions(commonDate,now),fresh=Boolean(status?.status==="success"&&!(status?.errors?.length)&&upstreamWorkflowFresh(status?.generatedAt,now));
  const dataCurrent=strictCurrent?lag===0:lag<=1;
  return{ok:fresh&&dataCurrent,fresh,lag,commonDate,reasons:[...(!fresh?["Phase 5 workflow status is stale/failed"]:[]),...(!dataCurrent?[`Phase 5 common market data lags ${lag} completed NYSE session(s)`]:[])]};
}
function runtimeStatusQuality(status:RuntimeStatus|null|undefined,now:string,strictCurrent:boolean){
  const lag=marketDataLagSessions(status?.marketDataDate,now),fresh=Boolean(status?.actionStatus==="success"&&status?.state!=="failed"&&!(status?.errors?.length)&&upstreamWorkflowFresh(status?.generatedAt,now));
  const dataCurrent=strictCurrent?lag===0:lag<=1;
  return{ok:fresh&&dataCurrent,fresh,lag,reasons:[...(!fresh?["Daily workflow status is stale/failed"]:[]),...(!dataCurrent?[`Daily market data lags ${lag} completed NYSE session(s)`]:[])]};
}

function baseDecision(args:{version:string;ticker:string;incumbent:boolean;observations:number;liveObservations:number;missing:number;executions:number;actionDays:number;regimes:string[];totalReturn:number;sortino:number;calmar:number;maxDd:number;evidence:string;stage:LifecycleStage;integrity:boolean;integrityReasons:string[]}):CandidateReview{
  const {version,ticker,incumbent,observations,liveObservations,missing,executions,actionDays,regimes,totalReturn,sortino,calmar,maxDd,evidence,stage,integrity,integrityReasons}=args;
  const missingRatio=missing/Math.max(1,observations),apy=actionDays/yearsObserved(liveObservations),historicalDd=HIST_DD[version]??-.40,adverseDdFloor=historicalDd-.10,reasons=[...integrityReasons],coverage=summarizeRegimeCoverage(regimes);
  if(missingRatio>.01)reasons.push(`Missing/invalid ratio ${(missingRatio*100).toFixed(2)}% > 1%`);
  if(apy>40&&liveObservations>=63)reasons.push(`Action Days/year ${apy.toFixed(1)} > 40`);
  if(maxDd<adverseDdFloor)reasons.push(`Forward Max DD ${(maxDd*100).toFixed(1)}% breached revalidation floor ${(adverseDdFloor*100).toFixed(1)}%`);
  if(stage==="FORMAL"||stage==="STRONGER"){
    if(liveObservations<252)reasons.push(`Only ${liveObservations} live observations; 12-month evidence not complete`);
    if(executions<6)reasons.push(`Only ${executions} non-zero-turnover executions; continue Forward rather than optimize activity`);
    if(!coverage.formalCoverage)reasons.push(`Semantic regime coverage insufficient: ${coverage.families.join(",")||"none"}; uninterrupted risk-on evidence cannot pass`);
  }
  const common={version,ticker,incumbent,eligible:false,promotionSelectable:false,promotionMerit:incumbent?"INCUMBENT" as const:"NOT_EVALUATED" as const,reasons,observations,liveObservations,missingRatio,executions,actionDaysPerYear:apy,regimes:coverage.labels.length,regimeFamilies:coverage.families,regimeCoverageOk:coverage.formalCoverage,totalReturn,sortino,calmar,maxDd,historicalDd,adverseDdFloor,evidence,paretoCommonDays:0};
  if(stage==="ACCUMULATING")return{...common,decision:"CONTINUE_FORWARD"};
  if(stage==="INTERIM")return{...common,decision:!integrity||missingRatio>.01?"DATA_REVIEW_REQUIRED":"CONTINUE_FORWARD"};
  const severe=!integrity||missingRatio>.01||maxDd<adverseDdFloor||(apy>40&&liveObservations>=63),evidenceEnough=liveObservations>=252&&executions>=6&&coverage.formalCoverage,eligible=!severe&&evidenceEnough;
  return{...common,decision:severe?"REVALIDATION_REQUIRED":eligible?"PHASE6_ELIGIBLE":"INSUFFICIENT_EVIDENCE",eligible};
}

function reviewCandidate(summary:Phase5Summary,ledger:Phase5Ledger,stage:LifecycleStage,status:LifecycleInputStatus|null|undefined,now:string):CandidateReview{
  const strict=stage==="FORMAL"||stage==="STRONGER",q=phase5StatusQuality(status,now,strict),labels=ledger.records.filter(r=>r.strategyVersion===summary.version&&r.dataStatus==="VALID").map(r=>r.regime);
  return baseDecision({version:summary.version,ticker:summary.ticker,incumbent:false,observations:summary.observations,liveObservations:summary.liveObservations,missing:summary.missing,executions:summary.executions,actionDays:summary.actionDays,regimes:labels,totalReturn:summary.totalReturn,sortino:summary.metrics.sortino,calmar:summary.metrics.calmar,maxDd:summary.metrics.maxDd,evidence:summary.evidence,stage,integrity:q.ok,integrityReasons:q.reasons});
}
function reviewIncumbent(summary:ForwardSummary|undefined,ledger:ForwardLedger,stage:LifecycleStage,status:RuntimeStatus|null|undefined,now:string):CandidateReview{
  const strict=stage==="FORMAL"||stage==="STRONGER",q=runtimeStatusQuality(status,now,strict),labels=ledger.records.filter(r=>r.strategyVersion==="VS13-v1.0"&&r.dataStatus==="VALID").map(r=>r.regime);
  if(!summary)return baseDecision({version:"VS13-v1.0",ticker:"TQQQ",incumbent:true,observations:0,liveObservations:0,missing:1,executions:0,actionDays:0,regimes:labels,totalReturn:0,sortino:0,calmar:0,maxDd:0,evidence:"Insufficient",stage,integrity:false,integrityReasons:[...q.reasons,"Incumbent Forward summary missing"]});
  return baseDecision({version:summary.version,ticker:"TQQQ",incumbent:true,observations:summary.observations,liveObservations:summary.observations,missing:summary.missing,executions:summary.orders,actionDays:summary.orders,regimes:labels,totalReturn:summary.totalReturn,sortino:summary.metrics.sortino,calmar:summary.metrics.calmar,maxDd:summary.metrics.maxDd,evidence:summary.evidence,stage,integrity:q.ok,integrityReasons:q.reasons});
}

function applyPareto(reviews:CandidateReview[],phase5:Phase5Ledger,forward:ForwardLedger){
  const incumbent=reviews.find(x=>x.incumbent)!;incumbent.promotionSelectable=incumbent.eligible;incumbent.promotionMerit="INCUMBENT";
  for(const r of reviews.filter(x=>!x.incumbent)){
    const c=compareCandidateToIncumbent(phase5,forward,r.version);r.promotionMerit=c.merit;r.paretoCommonDays=c.commonDays;
    r.reasons.push(...c.reasons);
    r.promotionSelectable=r.eligible&&incumbent.eligible&&(c.merit==="PARETO_SUPPORTED"||c.merit==="MIXED");
    if(r.eligible&&c.merit==="DOMINATED_BY_INCUMBENT")r.reasons.push("Operationally eligible but not selectable for Production because incumbent strictly Pareto-dominates it on the frozen common-period dimensions");
  }
  return reviews;
}

function healthForProduction(production:ProductionConfig,phase5:Phase5Ledger,phase5Status:LifecycleInputStatus|null|undefined,runtimeStatus:RuntimeStatus|null|undefined,forward:ForwardLedger,now:string):ProductionHealth{
  if(production.mode!=="PRODUCTION"||!production.approvedByHuman||!production.strategyVersion)return{state:"NOT_IN_PRODUCTION",version:null,reasons:["No human-approved Production system is active"],nextHealthReview:production.nextHealthReview};
  const version=production.strategyVersion,p5=summarizePhase5(phase5).find(x=>x.version===version),legacy=summarizeForward(forward).find(x=>x.version===version),row=p5||legacy;
  if(!row)return{state:"Critical",version,reasons:["Selected Production version has no matching Forward ledger"],nextHealthReview:production.nextHealthReview};
  const quality=p5?phase5StatusQuality(phase5Status,now,false):runtimeStatusQuality(runtimeStatus,now,false),historicalDd=HIST_DD[version]??-.40,dd=(row as any).metrics?.maxDd??(row as any).currentDd??0,live=(row as any).liveObservations??(row as any).observations??0,actionDays=(row as any).actionDays??(row as any).orders??0,apy=actionDays/yearsObserved(live);
  const state=assessHealth({integrity:quality.fresh,dataFresh:quality.ok,dd,historicalDd,actionDaysPerYear:apy});
  const reasons=[...quality.reasons];if(dd<historicalDd-.10)reasons.push("Forward drawdown is >10pt worse than frozen historical Max DD");if(apy>40)reasons.push(`Action Days/year ${apy.toFixed(1)} exceeds hard cap 40`);else if(apy>24)reasons.push(`Action Days/year ${apy.toFixed(1)} is above preferred 24 upper watch boundary`);if(state==="Healthy")reasons.push("Measured automated health controls are healthy; broker cost/tax/FX remain manual-review items");
  return{state,version,reasons,nextHealthReview:production.nextHealthReview};
}

export function emptyLifecycleLedger(schedule:LifecycleLedger["schedule"],now=new Date().toISOString()):LifecycleLedger{
  const asOf=dateOnly(now);return{schemaVersion:1,createdAt:now,updatedAt:now,appendOnly:true,schedule,events:[],current:{asOf,stage:lifecycleStage(asOf,schedule),systemDecision:"ACCUMULATING",userAction:"NONE",message:"Forward evidence is accumulating. No user action is required.",candidateReviews:[],productionHealth:{state:"NOT_IN_PRODUCTION",version:null,reasons:[],nextHealthReview:null},nextReview:schedule.interim}};
}
export function lifecycleStage(asOf:string,schedule:LifecycleLedger["schedule"]):LifecycleStage{if(asOf>=schedule.stronger)return"STRONGER";if(asOf>=schedule.formal)return"FORMAL";if(asOf>=schedule.interim)return"INTERIM";return"ACCUMULATING"}

export function updateLifecycleReview(args:{phase5:Phase5Ledger;forward:ForwardLedger;production:ProductionConfig;phase5Status?:LifecycleInputStatus|null;runtimeStatus?:RuntimeStatus|null;prior?:LifecycleLedger|null;now?:string}):LifecycleLedger{
  const now=args.now??new Date().toISOString(),asOf=dateOnly(now);if(!DATE_RE.test(asOf))throw Error("Invalid lifecycle review date");
  const schedule={interim:args.phase5.reviewSchedule.interim,formal:args.phase5.reviewSchedule.formal,stronger:args.phase5.reviewSchedule.stronger},out=args.prior?.schemaVersion===1?structuredClone(args.prior):emptyLifecycleLedger(schedule,now);if(JSON.stringify(out.schedule)!==JSON.stringify(schedule))throw Error("Lifecycle review schedule drift blocked");
  const stage=lifecycleStage(asOf,schedule),p5Summaries=summarizePhase5(args.phase5),incSummary=summarizeForward(args.forward).find(x=>x.id==="VS13"),inc=reviewIncumbent(incSummary,args.forward,stage,args.runtimeStatus,now),reviews=applyPareto([inc,...p5Summaries.map(s=>reviewCandidate(s,args.phase5,stage,args.phase5Status,now))],args.phase5,args.forward),prodHealth=healthForProduction(args.production,args.phase5,args.phase5Status,args.runtimeStatus,args.forward,now);
  const incumbent=reviews.find(x=>x.incumbent)!,challengers=reviews.filter(x=>!x.incumbent),selectable=reviews.filter(x=>x.promotionSelectable),candidateIssues=challengers.some(x=>x.decision==="DATA_REVIEW_REQUIRED"||x.decision==="REVALIDATION_REQUIRED"),incumbentIssue=incumbent.decision==="DATA_REVIEW_REQUIRED"||incumbent.decision==="REVALIDATION_REQUIRED";
  let systemDecision="ACCUMULATING",userAction:UserAction="NONE",message="Forward evidence is accumulating. No user action is required.";
  if(prodHealth.state==="Critical"){systemDecision="PRODUCTION_INTEGRITY_CRITICAL";userAction="URGENT_INTEGRITY_REVIEW";message="Production integrity requires immediate review. Do not change strategy automatically.";}
  else if(prodHealth.state==="Revalidation Required"){systemDecision="PRODUCTION_REVALIDATION_REQUIRED";userAction="REVALIDATE_PRODUCTION";message="Production measured-health trigger fired. Keep automatic strategy replacement disabled and perform revalidation.";}
  else if(stage==="INTERIM"){
    if(incumbentIssue||candidateIssues){systemDecision="INTERIM_DATA_REVIEW_REQUIRED";userAction="CHECK_DATA_AND_ACTIONS";message="Interim review found a data/integrity issue in at least one tracked system. No promotion is permitted; inspect the affected row(s).";}else{systemDecision="INTERIM_CONTINUE_FORWARD";message="Six-month interim review completed. Continue Forward; promotion remains prohibited.";}
  }else if(stage==="FORMAL"||stage==="STRONGER"){
    if(incumbentIssue){systemDecision="REVALIDATION_REQUIRED";userAction="CHECK_DATA_AND_ACTIONS";message="Incumbent/common comparison integrity is not healthy. Production selection is blocked until the baseline is current and valid.";}
    else if(selectable.length){systemDecision="PHASE6_HUMAN_DECISION_REQUIRED";userAction="RUN_PHASE6_HUMAN_REVIEW";message=`${selectable.map(x=>x.ticker).join(" / ")} are selectable after operational and Pareto gates. Human Phase 6 review is required; affected non-selectable challengers remain excluded without blocking healthy alternatives.`;}
    else if(candidateIssues){systemDecision="REVALIDATION_REQUIRED";userAction="CHECK_DATA_AND_ACTIONS";message="No system is currently selectable and at least one challenger has a data/integrity breach. Resolve data issues without changing strategy parameters.";}
    else{systemDecision="CONTINUE_FORWARD_INSUFFICIENT_EVIDENCE";message="Formal review completed but no system has sufficient selectable Forward evidence. Continue Forward without changing parameters.";}
  }
  const milestone=stage==="INTERIM"?schedule.interim:stage==="FORMAL"?schedule.formal:stage==="STRONGER"?schedule.stronger:null;if(milestone&&asOf>=milestone&&!out.events.some(e=>e.reviewDate===milestone))out.events.push({key:`${stage}|${milestone}`,stage:stage as Exclude<LifecycleStage,"ACCUMULATING">,reviewDate:milestone,recordedAt:now,systemDecision,userAction,candidateReviews:structuredClone(reviews)});
  const nextReview=asOf<schedule.interim?schedule.interim:asOf<schedule.formal?schedule.formal:asOf<schedule.stronger?schedule.stronger:null;out.updatedAt=now;out.current={asOf,stage,systemDecision,userAction,message,candidateReviews:reviews,productionHealth:prodHealth,nextReview};return out;
}

export function productionEligibleVersions(lifecycle:LifecycleLedger):string[]{if(lifecycle.current.systemDecision!=="PHASE6_HUMAN_DECISION_REQUIRED")return[];return lifecycle.current.candidateReviews.filter(x=>x.promotionSelectable).map(x=>x.version)}
