import test from "node:test";
import assert from "node:assert/strict";
import { emptyLifecycleLedger, productionEligibleVersions, updateLifecycleReview } from "../lib/lifecycle-review.ts";
import { emptyPhase5Ledger, type Phase5Ledger } from "../lib/phase5-forward.ts";
import { emptyForwardLedger, type ForwardLedger } from "../lib/forward.ts";
import { DEFAULT_PRODUCTION_CONFIG, transitionMode } from "../lib/production.ts";

const weekdays=(start:string,count:number)=>{const out:string[]=[];const d=new Date(`${start}T00:00:00Z`);while(out.length<count){if(![0,6].includes(d.getUTCDay()))out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out};
const regimes=["強い上昇","レンジ","高ボラ"];
const seedPhase5=(ledger:Phase5Ledger,version:string,n=252,executions=6,regimeSet=regimes)=>{
  const freeze=ledger.freezes.find(x=>x.version===version)!;let equity=1_000_000;
  for(const [i,date] of weekdays("2026-08-25",n).entries()){
    const trade=i<executions;equity*=1.0002;
    ledger.records.push({key:`${version}|${date}`,marketDataDate:date,recordedAt:`${date}T22:00:00Z`,recordMode:"LIVE",strategyId:freeze.id,ticker:freeze.ticker,strategyName:freeze.name,strategyVersion:version,score:70,components:{trend:70,momentum:70,volatility:70,market:70},regime:regimeSet[i%regimeSet.length],targetExposure:.75,previousExposure:trade?0:.75,signal:trade?"INCREASE":"HOLD",tradeReason:"test",intendedExecutionDate:date,execution:trade?{signalDate:date,intendedDate:date,recordedDate:date,price:100,before:0,after:.75,turnover:.75,commission:1,slippage:1,totalCost:2,status:"ON_TIME"}:null,assetClose:100,position:.75,quantity:7500,cash:250000,equity,dailyReturn:.0002,currentDrawdown:0,cumulativeCosts:2*Math.min(i+1,executions),dataSource:"test",dataStatus:"VALID",buildVersion:"test"});
  }
};
const seedIncumbent=(ledger:ForwardLedger,n=252,executions=6,regimeSet=regimes)=>{
  ledger.freezes=ledger.freezes.filter(x=>x.version==="VS13-v1.0");let equity=1_000_000;
  for(const [i,date] of weekdays("2026-08-25",n).entries()){
    const trade=i<executions;equity*=1.0002;
    ledger.records.push({key:`VS13-v1.0|${date}`,marketDataDate:date,recordedAt:`${date}T22:00:00Z`,recordMode:"LIVE",strategyId:"VS13",strategyName:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",score:70,components:{trend:70,momentum:70,volatility:70,market:70},regime:regimeSet[i%regimeSet.length],targetExposure:.75,previousExposure:trade?0:.75,signal:trade?"INCREASE":"HOLD",tradeReason:"test",intendedExecutionDate:date,execution:trade?{signalDate:date,intendedDate:date,recordedDate:date,price:100,before:0,after:.75,turnover:.75,commission:1,slippage:1,totalCost:2,status:"ON_TIME"}:null,assetClose:100,position:.75,quantity:7500,cash:250000,equity,dailyReturn:.0002,currentDrawdown:0,cumulativeCosts:2*Math.min(i+1,executions),dataSource:"test",dataStatus:"VALID",buildVersion:"test"});
  }
};
const base=(now="2027-08-25T21:30:00Z")=>{const phase5=emptyPhase5Ledger("2026-08-25T15:15:00Z"),forward=emptyForwardLedger();return{phase5,forward,production:DEFAULT_PRODUCTION_CONFIG,phase5Status:{status:"success",errors:[],generatedAt:"2027-08-25T21:10:00Z",latestDates:{UPRO:"2027-08-25",SSO:"2027-08-25",QLD:"2027-08-25",SPY:"2027-08-25",QQQ:"2027-08-25",VIX:"2027-08-25"}},runtimeStatus:{generatedAt:"2027-08-25T21:10:00Z",actionStatus:"success",state:"latest",marketDataDate:"2027-08-25",errors:[]},now}};

test("six-month interim review never promotes",()=>{
  const x=base("2027-02-25T22:00:00Z");x.phase5Status.generatedAt="2027-02-25T21:30:00Z";for(const k of Object.keys(x.phase5Status.latestDates))x.phase5Status.latestDates[k]="2027-02-24";x.runtimeStatus.generatedAt="2027-02-25T21:30:00Z";x.runtimeStatus.marketDataDate="2027-02-24";
  for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,133,6);seedIncumbent(x.forward,133,6);
  const r=updateLifecycleReview({...x,prior:emptyLifecycleLedger(x.phase5.reviewSchedule,"2026-08-25T00:00:00Z")});
  assert.equal(r.current.stage,"INTERIM");assert.equal(r.current.userAction,"NONE");assert.equal(productionEligibleVersions(r).length,0);assert.equal(r.events.length,1);
});

test("formal review makes incumbent and non-dominated challengers human-selectable but never auto-produces",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);
  const r=updateLifecycleReview({...x,prior:emptyLifecycleLedger(x.phase5.reviewSchedule,"2026-08-25T00:00:00Z")});
  assert.equal(r.current.systemDecision,"PHASE6_HUMAN_DECISION_REQUIRED");assert.equal(r.current.userAction,"RUN_PHASE6_HUMAN_REVIEW");assert.equal(productionEligibleVersions(r).length,4);assert.equal(x.production.mode,"RESEARCH");
});

test("uninterrupted bull labels cannot satisfy semantic regime coverage",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6,["強い上昇","弱い上昇"]);seedIncumbent(x.forward,262,6,["強い上昇","弱い上昇"]);
  const r=updateLifecycleReview({...x,prior:null});assert.equal(r.current.systemDecision,"CONTINUE_FORWARD_INSUFFICIENT_EVIDENCE");assert.equal(productionEligibleVersions(r).length,0);assert.ok(r.current.candidateReviews.every(z=>!z.regimeCoverageOk));
});

test("insufficient execution sample continues Forward when incumbent is also insufficient",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,2);seedIncumbent(x.forward,262,2);
  const r=updateLifecycleReview({...x,prior:null});assert.equal(r.current.systemDecision,"CONTINUE_FORWARD_INSUFFICIENT_EVIDENCE");assert.equal(r.current.userAction,"NONE");assert.equal(productionEligibleVersions(r).length,0);
});

test("one failed challenger feed does not dead-end a healthy incumbent decision",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);x.phase5Status.status="failed";x.phase5Status.errors=["provider"];
  const r=updateLifecycleReview({...x,prior:null});assert.equal(r.current.systemDecision,"PHASE6_HUMAN_DECISION_REQUIRED");assert.deepEqual(productionEligibleVersions(r),["VS13-v1.0"]);
});

test("stale/failed incumbent upstream status blocks all Production selection",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);x.runtimeStatus.generatedAt="2027-08-20T22:00:00Z";
  const r=updateLifecycleReview({...x,prior:null});assert.equal(r.current.systemDecision,"REVALIDATION_REQUIRED");assert.equal(r.current.userAction,"CHECK_DATA_AND_ACTIONS");assert.equal(productionEligibleVersions(r).length,0);
});

test("strictly incumbent-dominated challenger is operationally eligible but not Production-selectable",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);
  // Make UPRO common-period returns strictly lower while leaving its operational gates intact.
  for(const r of x.phase5.records.filter(r=>r.strategyVersion==="UPRO-SPBT-v1.0")){r.dailyReturn=-.0001;r.equity*=.8;}
  const out=updateLifecycleReview({...x,prior:null}),u=out.current.candidateReviews.find(z=>z.version==="UPRO-SPBT-v1.0")!;
  assert.equal(u.eligible,true);assert.equal(u.promotionMerit,"DOMINATED_BY_INCUMBENT");assert.equal(u.promotionSelectable,false);assert.ok(!productionEligibleVersions(out).includes(u.version));
});

test("review events are append-only and not duplicated after due date",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);
  const a=updateLifecycleReview({...x,prior:null}),b=updateLifecycleReview({...x,prior:a,now:"2027-08-26T12:00:00Z",phase5Status:{...x.phase5Status,generatedAt:"2027-08-26T11:00:00Z",latestDates:Object.fromEntries(Object.keys(x.phase5Status.latestDates).map(k=>[k,"2027-08-25"]))},runtimeStatus:{...x.runtimeStatus,generatedAt:"2027-08-26T11:00:00Z",marketDataDate:"2027-08-25"}});
  assert.equal(a.events.length,b.events.length);assert.deepEqual(a.events,b.events);
});


test("transient incumbent failure at a scheduled review is retryable after current data recovers",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);
  x.runtimeStatus.generatedAt="2027-08-20T22:00:00Z";
  const blocked=updateLifecycleReview({...x,prior:null});
  assert.equal(blocked.current.userAction,"CHECK_DATA_AND_ACTIONS");assert.equal(blocked.current.nextReview,"2027-08-25");assert.equal(blocked.current.reviewResolved,false);assert.equal(blocked.events.length,1);
  const recovered=updateLifecycleReview({...x,prior:blocked,now:"2027-08-26T12:00:00Z",runtimeStatus:{...x.runtimeStatus,generatedAt:"2027-08-26T11:00:00Z",marketDataDate:"2027-08-25"},phase5Status:{...x.phase5Status,generatedAt:"2027-08-26T11:00:00Z"}});
  assert.equal(recovered.current.systemDecision,"PHASE6_HUMAN_DECISION_REQUIRED");assert.equal(recovered.current.userAction,"RUN_PHASE6_HUMAN_REVIEW");assert.equal(recovered.current.nextReview,"2027-08-25");assert.equal(recovered.events.length,2);assert.match(recovered.events[1].key,/RECOVERY/);
});


test("failed unrelated Phase5 challenger does not poison healthy Phase5 Production",()=>{
  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);
  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION"),p=transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true});x.production=p;
  x.phase5Status={...x.phase5Status,status:"partial",systems:{"UPRO-SPBT-v1.0":{status:"success",latestDate:"2027-08-25",errors:[]},"SSO-SPBT-Scaled-v1.0":{status:"failed",latestDate:"2027-08-24",errors:["SSO feed failed"]},"QLD-VS13-Scaled-v1.0":{status:"success",latestDate:"2027-08-25",errors:[]}}};
  const r=updateLifecycleReview({...x,prior:null});const incumbent=r.current.candidateReviews.find(c=>c.incumbent)!;
  assert.equal(incumbent.version,"UPRO-SPBT-v1.0");assert.equal(incumbent.eligible,true);assert.ok(!incumbent.reasons.some(s=>s.includes("stale/failed")));assert.notEqual(r.current.productionHealth.state,"Critical");assert.notEqual(r.current.productionHealth.state,"Revalidation Required");
});
