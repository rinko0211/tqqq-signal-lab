import { summarizeForward, type ForwardLedger, type ForwardSummary } from "./forward.ts";
import { summarizePhase5, type Phase5Ledger, type Phase5Summary } from "./phase5-forward.ts";
import { assessHealth, hasActiveProduction, type ProductionConfig, type HealthState } from "./production.ts";
import {summarizeRegimeCoverage} from "./regime-coverage.ts";
import {compareCandidateToIncumbent,type ParetoMerit} from "./forward-pareto.ts";
import {marketDataLagSessions,marketDate,nyseReviewBoundaryReached,upstreamWorkflowFresh} from "./market-calendar.ts";

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
export type LifecycleLedger={schemaVersion:1;createdAt:string;updatedAt:string;appendOnly:true;schedule:{interim:string;formal:string;stronger:string};events:ReviewEvent[];current:{asOf:string;stage:LifecycleStage;systemDecision:string;userAction:UserAction;message:string;candidateReviews:CandidateReview[];productionHealth:ProductionHealth;nextReview:string|null;incumbentVersion?:string;reviewCycleDate?:string|null;reviewResolved?:boolean;reviewResolvedAt?:string|null}};

const HIST_DD:Record<string,number>={"VS13-v1.0":-.3816,"QLD-VS13-Scaled-v1.0":-.2705,"UPRO-SPBT-v1.0":-.3457,"SSO-SPBT-Scaled-v1.0":-.2416};
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const yearsObserved=(n:number)=>Math.max(n/252,1/252);
const addYears=(date:string,n=1)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCFullYear(d.getUTCFullYear()+n);return d.toISOString().slice(0,10)};

function minDate(values:string[]){return values.filter(Boolean).sort()[0]}
function phase5StatusQuality(status:LifecycleInputStatus|null|undefined,now:string,strictCurrent:boolean){
  const commonDate=status?.latestDates?minDate(Object.values(status.latestDates)):undefined;
  const lag=marketDataLagSessions(commonDate,now),fresh=Boolean(status?.status==="success"&&!(status?.errors?.length)&&upstreamWorkflowFresh(status?.generatedAt,now));
  const dataCurrent=strictCurrent?lag===0:lag<=1;
  return{ok:fresh&&dataCurrent,fresh,lag,commonDate,reasons:[...(!fresh?["Phase 5 workflow status is stale/failed"]:[]),...(!dataCurrent?[`Phase 5 common market data lags ${lag} completed NYSE session(s)`]:[])]};
}
function runtimeStatusQuality(status:RuntimeStatus|null|undefined,now:string){
  const fresh=Boolean(status?.actionStatus==="success"&&status?.state!=="failed"&&!(status?.errors?.length)&&upstreamWorkflowFresh(status?.generatedAt,now));
  return{fresh,reasons:[...(!fresh?["Daily workflow status is stale/failed"]:[])]};
}
function legacyStatusQuality(status:RuntimeStatus|null|undefined,ledger:ForwardLedger,now:string,strictCurrent:boolean){
  const workflow=runtimeStatusQuality(status,now),lastDate=ledger.records.filter(r=>r.strategyVersion==="VS13-v1.0"&&r.dataStatus==="VALID").sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)).at(-1)?.marketDataDate;
  const lag=marketDataLagSessions(lastDate,now),dataCurrent=strictCurrent?lag===0:lag<=1;
  return{ok:workflow.fresh&&dataCurrent,fresh:workflow.fresh,lag,reasons:[...workflow.reasons,...(!dataCurrent?[`TQQQ reference Forward data lags ${lag} completed NYSE session(s)`]:[])]};
}

function baseDecision(args:{version:string;ticker:string;incumbent:boolean;observations:number;liveObservations:number;missing:number;executions:number;actionDays:number;regimes:string[];totalReturn:number;sortino:number;calmar:number;maxDd:number;evidence:string;stage:LifecycleStage;integrity:boolean;integrityReasons:string[]}):CandidateReview{
  const {version,ticker,incumbent,observations,liveObservations,missing,executions,actionDays,regimes,totalReturn,sortino,calmar,maxDd,evidence,stage,integrity,integrityReasons}=args;
  const missingRatio=missing/Math.max(1,liveObservations+missing),apy=actionDays/yearsObserved(liveObservations),historicalDd=HIST_DD[version]??-.40,adverseDdFloor=historicalDd-.10,reasons=[...integrityReasons],coverage=summarizeRegimeCoverage(regimes);
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

function reviewPhase5(summary:Phase5Summary,ledger:Phase5Ledger,stage:LifecycleStage,status:LifecycleInputStatus|null|undefined,now:string,incumbent:boolean):CandidateReview{
  const strict=stage==="FORMAL"||stage==="STRONGER",q=phase5StatusQuality(status,now,strict),labels=ledger.records.filter(r=>r.strategyVersion===summary.version&&r.dataStatus==="VALID").map(r=>r.regime);
  return baseDecision({version:summary.version,ticker:summary.ticker,incumbent,observations:summary.observations,liveObservations:summary.liveObservations,missing:summary.missing,executions:summary.executions,actionDays:summary.actionDays,regimes:labels,totalReturn:summary.totalReturn,sortino:summary.metrics.sortino,calmar:summary.metrics.calmar,maxDd:summary.metrics.maxDd,evidence:summary.evidence,stage,integrity:q.ok,integrityReasons:q.reasons});
}
function reviewLegacy(summary:ForwardSummary|undefined,ledger:ForwardLedger,stage:LifecycleStage,status:RuntimeStatus|null|undefined,now:string,incumbent:boolean):CandidateReview{
  const strict=stage==="FORMAL"||stage==="STRONGER",q=legacyStatusQuality(status,ledger,now,strict),labels=ledger.records.filter(r=>r.strategyVersion==="VS13-v1.0"&&r.dataStatus==="VALID").map(r=>r.regime);
  if(!summary)return baseDecision({version:"VS13-v1.0",ticker:"TQQQ",incumbent,observations:0,liveObservations:0,missing:1,executions:0,actionDays:0,regimes:labels,totalReturn:0,sortino:0,calmar:0,maxDd:0,evidence:"Insufficient",stage,integrity:false,integrityReasons:[...q.reasons,"TQQQ reference Forward summary missing"]});
  return baseDecision({version:summary.version,ticker:"TQQQ",incumbent,observations:summary.observations,liveObservations:summary.observations,missing:summary.missing,executions:summary.orders,actionDays:summary.orders,regimes:labels,totalReturn:summary.totalReturn,sortino:summary.metrics.sortino,calmar:summary.metrics.calmar,maxDd:summary.metrics.maxDd,evidence:summary.evidence,stage,integrity:q.ok,integrityReasons:q.reasons});
}

function applyPareto(reviews:CandidateReview[],phase5:Phase5Ledger,forward:ForwardLedger){
  const incumbent=reviews.find(x=>x.incumbent);if(!incumbent)throw Error("Lifecycle incumbent is missing");
  incumbent.promotionSelectable=incumbent.eligible;incumbent.promotionMerit="INCUMBENT";
  for(const r of reviews.filter(x=>!x.incumbent)){
    const c=compareCandidateToIncumbent(phase5,forward,r.version,incumbent.version);r.promotionMerit=c.merit;r.paretoCommonDays=c.commonDays;
    r.reasons.push(...c.reasons);
    r.promotionSelectable=r.eligible&&incumbent.eligible&&(c.merit==="PARETO_SUPPORTED"||c.merit==="MIXED");
    if(r.eligible&&c.merit==="DOMINATED_BY_INCUMBENT")r.reasons.push("Operationally eligible but not selectable for Production because the current incumbent strictly Pareto-dominates it on the frozen common-period dimensions");
  }
  return reviews;
}

function healthForProduction(production:ProductionConfig,phase5:Phase5Ledger,phase5Status:LifecycleInputStatus|null|undefined,runtimeStatus:RuntimeStatus|null|undefined,forward:ForwardLedger,now:string):ProductionHealth{
  if(!hasActiveProduction(production)||!production.strategyVersion)return{state:"NOT_IN_PRODUCTION",version:null,reasons:["No human-approved Production system is active"],nextHealthReview:production.nextHealthReview};
  const version=production.strategyVersion,p5=summarizePhase5(phase5).find(x=>x.version===version),legacy=summarizeForward(forward).find(x=>x.version===version);
  if(!p5&&!legacy)return{state:"Critical",version,reasons:["Selected Production version has no matching Forward ledger"],nextHealthReview:production.nextHealthReview};
  const quality=p5?phase5StatusQuality(phase5Status,now,false):legacyStatusQuality(runtimeStatus,forward,now,false),historicalDd=HIST_DD[version]??-.40;
  const dd=p5?p5.metrics.maxDd:legacy!.metrics.maxDd,live=p5?p5.liveObservations:legacy!.observations,actionDays=p5?p5.actionDays:legacy!.orders,apy=actionDays/yearsObserved(live);
  const state=assessHealth({integrity:quality.fresh,dataFresh:quality.ok,dd,historicalDd,actionDaysPerYear:apy});
  const reasons=[...quality.reasons];if(dd<historicalDd-.10)reasons.push("Forward drawdown is >10pt worse than frozen historical Max DD");if(apy>40)reasons.push(`Action Days/year ${apy.toFixed(1)} exceeds hard cap 40`);else if(apy>24)reasons.push(`Action Days/year ${apy.toFixed(1)} is above preferred 24 upper watch boundary`);if(state==="Healthy")reasons.push("Measured automated health controls are healthy; broker cost/tax/FX remain manual-review items");
  return{state,version,reasons,nextHealthReview:production.nextHealthReview};
}

export function lifecycleStage(asOf:string,schedule:LifecycleLedger["schedule"]):LifecycleStage{if(asOf>=schedule.stronger)return"STRONGER";if(asOf>=schedule.formal)return"FORMAL";if(asOf>=schedule.interim)return"INTERIM";return"ACCUMULATING"}
export function lifecycleStageAt(now:string,schedule:LifecycleLedger["schedule"]):LifecycleStage{if(nyseReviewBoundaryReached(schedule.stronger,now))return"STRONGER";if(nyseReviewBoundaryReached(schedule.formal,now))return"FORMAL";if(nyseReviewBoundaryReached(schedule.interim,now))return"INTERIM";return"ACCUMULATING"}
function latestSelectionCycle(now:string,schedule:LifecycleLedger["schedule"]):string|null{
  if(!nyseReviewBoundaryReached(schedule.formal,now))return null;
  if(!nyseReviewBoundaryReached(schedule.stronger,now))return schedule.formal;
  let cycle=schedule.stronger,next=addYears(cycle);
  while(nyseReviewBoundaryReached(next,now)){cycle=next;next=addYears(cycle)}
  return cycle;
}
function nextSelectionCycle(cycle:string|null,schedule:LifecycleLedger["schedule"]){if(!cycle)return schedule.formal;if(cycle===schedule.formal)return schedule.stronger;return addYears(cycle)}

export function emptyLifecycleLedger(schedule:LifecycleLedger["schedule"],now=new Date().toISOString()):LifecycleLedger{
  const asOf=marketDate(now),stage=lifecycleStageAt(now,schedule);return{schemaVersion:1,createdAt:now,updatedAt:now,appendOnly:true,schedule,events:[],current:{asOf,stage,systemDecision:"ACCUMULATING",userAction:"NONE",message:"Forward evidence is accumulating. No user action is required.",candidateReviews:[],productionHealth:{state:"NOT_IN_PRODUCTION",version:null,reasons:[],nextHealthReview:null},nextReview:schedule.interim,incumbentVersion:"VS13-v1.0",reviewCycleDate:null,reviewResolved:false,reviewResolvedAt:null}};
}

function selectionDecision(reviews:CandidateReview[]){
  const incumbent=reviews.find(x=>x.incumbent)!,challengers=reviews.filter(x=>!x.incumbent),selectable=reviews.filter(x=>x.promotionSelectable),candidateIssues=challengers.some(x=>x.decision==="DATA_REVIEW_REQUIRED"||x.decision==="REVALIDATION_REQUIRED"),incumbentIssue=incumbent.decision==="DATA_REVIEW_REQUIRED"||incumbent.decision==="REVALIDATION_REQUIRED";
  if(incumbentIssue)return{systemDecision:"REVALIDATION_REQUIRED",userAction:"CHECK_DATA_AND_ACTIONS" as UserAction,message:"Current incumbent comparison integrity is not healthy. Production selection is blocked until the incumbent is current and valid."};
  if(selectable.length)return{systemDecision:"PHASE6_HUMAN_DECISION_REQUIRED",userAction:"RUN_PHASE6_HUMAN_REVIEW" as UserAction,message:`${selectable.map(x=>x.ticker).join(" / ")} are selectable after operational and Pareto gates. Human Phase 6 review is required; affected non-selectable challengers remain excluded without blocking healthy alternatives.`};
  if(candidateIssues)return{systemDecision:"REVALIDATION_REQUIRED",userAction:"CHECK_DATA_AND_ACTIONS" as UserAction,message:"No system is currently selectable and at least one challenger has a data/integrity breach. Resolve data issues without changing strategy parameters."};
  return{systemDecision:"CONTINUE_FORWARD_INSUFFICIENT_EVIDENCE",userAction:"NONE" as UserAction,message:"Scheduled review completed but no system has sufficient selectable Forward evidence. Continue Forward without changing parameters until the next scheduled review."};
}

export function updateLifecycleReview(args:{phase5:Phase5Ledger;forward:ForwardLedger;production:ProductionConfig;phase5Status?:LifecycleInputStatus|null;runtimeStatus?:RuntimeStatus|null;prior?:LifecycleLedger|null;now?:string}):LifecycleLedger{
  const now=args.now??new Date().toISOString(),asOf=marketDate(now);if(!DATE_RE.test(asOf))throw Error("Invalid lifecycle review date");
  const schedule={interim:args.phase5.reviewSchedule.interim,formal:args.phase5.reviewSchedule.formal,stronger:args.phase5.reviewSchedule.stronger},out=args.prior?.schemaVersion===1?structuredClone(args.prior):emptyLifecycleLedger(schedule,now);if(JSON.stringify(out.schedule)!==JSON.stringify(schedule))throw Error("Lifecycle review schedule drift blocked");
  const stage=lifecycleStageAt(now,schedule),p5Summaries=summarizePhase5(args.phase5),legacySummary=summarizeForward(args.forward).find(x=>x.id==="VS13"),frontierVersions=new Set(["VS13-v1.0",...p5Summaries.map(x=>x.version)]),configuredIncumbent=hasActiveProduction(args.production)&&args.production.strategyVersion&&frontierVersions.has(args.production.strategyVersion)?args.production.strategyVersion:"VS13-v1.0";
  const reviews=applyPareto([
    reviewLegacy(legacySummary,args.forward,stage,args.runtimeStatus,now,configuredIncumbent==="VS13-v1.0"),
    ...p5Summaries.map(s=>reviewPhase5(s,args.phase5,stage,args.phase5Status,now,s.version===configuredIncumbent)),
  ],args.phase5,args.forward),prodHealth=healthForProduction(args.production,args.phase5,args.phase5Status,args.runtimeStatus,args.forward,now);
  const incumbent=reviews.find(x=>x.incumbent)!,challengers=reviews.filter(x=>!x.incumbent),candidateIssues=challengers.some(x=>x.decision==="DATA_REVIEW_REQUIRED"||x.decision==="REVALIDATION_REQUIRED"),incumbentIssue=incumbent.decision==="DATA_REVIEW_REQUIRED"||incumbent.decision==="REVALIDATION_REQUIRED";

  // Interim is informational. If the first run after a long outage is already
  // FORMAL/STRONGER we do not fabricate a missed historical interim event.
  if(stage==="INTERIM"&&!out.events.some(e=>e.reviewDate===schedule.interim)){
    const interimIssue=incumbentIssue||candidateIssues;
    out.events.push({key:`INTERIM|${schedule.interim}`,stage:"INTERIM",reviewDate:schedule.interim,recordedAt:now,systemDecision:interimIssue?"INTERIM_DATA_REVIEW_REQUIRED":"INTERIM_CONTINUE_FORWARD",userAction:interimIssue?"CHECK_DATA_AND_ACTIONS":"NONE",candidateReviews:structuredClone(reviews)});
  }

  const cycleDate=latestSelectionCycle(now,schedule),existingCycle=cycleDate?out.events.find(e=>e.reviewDate===cycleDate):undefined;
  if(cycleDate&&!existingCycle){
    const d=selectionDecision(reviews),cycleStage=cycleDate===schedule.formal?"FORMAL":"STRONGER";
    out.events.push({key:`${cycleStage}|${cycleDate}`,stage:cycleStage,reviewDate:cycleDate,recordedAt:now,systemDecision:d.systemDecision,userAction:d.userAction,candidateReviews:structuredClone(reviews)});
  }
  const cycle=cycleDate?out.events.find(e=>e.reviewDate===cycleDate):undefined;
  const approvalResolved=Boolean(cycle&&cycle.userAction==="RUN_PHASE6_HUMAN_REVIEW"&&hasActiveProduction(args.production)&&args.production.approvalDate&&args.production.approvalDate>=cycle.reviewDate);
  const cycleResolved=Boolean(cycle&&(cycle.userAction!=="RUN_PHASE6_HUMAN_REVIEW"||approvalResolved));
  let systemDecision="ACCUMULATING",userAction:UserAction="NONE",message="Forward evidence is accumulating. No user action is required.",currentReviews=reviews;

  if(prodHealth.state==="Critical"){systemDecision="PRODUCTION_INTEGRITY_CRITICAL";userAction="URGENT_INTEGRITY_REVIEW";message="Production integrity requires immediate review. Do not change strategy automatically.";}
  else if(prodHealth.state==="Revalidation Required"){systemDecision="PRODUCTION_REVALIDATION_REQUIRED";userAction="REVALIDATE_PRODUCTION";message="Production measured-health trigger fired. Keep automatic strategy replacement disabled and perform revalidation.";}
  else if(incumbentIssue||candidateIssues){systemDecision=stage==="INTERIM"?"INTERIM_DATA_REVIEW_REQUIRED":"REVALIDATION_REQUIRED";userAction="CHECK_DATA_AND_ACTIONS";message="A current data/integrity issue exists. Do not use an older review result for Production changes; restore current upstream state first.";}
  else if(cycle&&cycle.userAction==="RUN_PHASE6_HUMAN_REVIEW"&&!approvalResolved){
    // Freeze the selection snapshot at the scheduled review. Later data may
    // invalidate a frozen choice, but it cannot create a new opportunistic
    // candidate before the next scheduled review.
    const liveByVersion=new Map(reviews.map(r=>[r.version,r])),frozen=structuredClone(cycle.candidateReviews);
    for(const r of frozen){const live=liveByVersion.get(r.version);r.incumbent=r.version===configuredIncumbent;r.promotionSelectable=Boolean(r.promotionSelectable&&live?.eligible&&!incumbentIssue);}
    currentReviews=frozen;const safeSelectable=frozen.filter(r=>r.promotionSelectable);
    if(safeSelectable.length){systemDecision="PHASE6_HUMAN_DECISION_REQUIRED";userAction="RUN_PHASE6_HUMAN_REVIEW";message=`Scheduled review ${cycle.reviewDate} remains awaiting Human Approval. Only the frozen, still-operational candidates shown below may be selected.`;}
    else{systemDecision="REVALIDATION_REQUIRED";userAction="CHECK_DATA_AND_ACTIONS";message="The frozen scheduled-review candidates are no longer operationally safe. Do not approve Production; wait for the next scheduled review after restoring data integrity.";}
  }
  else if(cycle){
    systemDecision=approvalResolved?"POST_REVIEW_CONTINUE_FORWARD":cycle.systemDecision;
    userAction="NONE";
    message=approvalResolved?`Human review for ${cycle.reviewDate} is complete. Continue the approved incumbent and Forward observation until the next scheduled selection review.`:cycle.message??"Scheduled review completed. Continue Forward until the next scheduled review.";
  }
  else if(stage==="INTERIM"){systemDecision="INTERIM_CONTINUE_FORWARD";message="Six-month interim review is informational only. Continue Forward; Production promotion remains prohibited.";}

  const nextReview=cycle&&cycle.userAction==="RUN_PHASE6_HUMAN_REVIEW"&&!approvalResolved?cycle.reviewDate:cycle?nextSelectionCycle(cycle.reviewDate,schedule):stage==="ACCUMULATING"?schedule.interim:schedule.formal;
  out.updatedAt=now;out.current={asOf,stage,systemDecision,userAction,message,candidateReviews:currentReviews,productionHealth:prodHealth,nextReview,incumbentVersion:configuredIncumbent,reviewCycleDate:cycle?.reviewDate??null,reviewResolved:cycleResolved,reviewResolvedAt:approvalResolved?args.production.approvalDate:null};return out;
}

export function productionEligibleVersions(lifecycle:LifecycleLedger):string[]{if(lifecycle.current.systemDecision!=="PHASE6_HUMAN_DECISION_REQUIRED")return[];return lifecycle.current.candidateReviews.filter(x=>x.promotionSelectable).map(x=>x.version)}
