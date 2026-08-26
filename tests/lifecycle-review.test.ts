import test from "node:test";
import assert from "node:assert/strict";
import { emptyLifecycleLedger, productionEligibleVersions, updateLifecycleReview } from "../lib/lifecycle-review.ts";
import { emptyPhase5Ledger, type Phase5Ledger } from "../lib/phase5-forward.ts";
import { emptyForwardLedger } from "../lib/forward.ts";
import { DEFAULT_PRODUCTION_CONFIG } from "../lib/production.ts";

const base=()=>({phase5:emptyPhase5Ledger("2026-08-25T15:15:00Z"),forward:emptyForwardLedger(),production:DEFAULT_PRODUCTION_CONFIG,phase5Status:{status:"success",errors:[]},runtimeStatus:{actionStatus:"success",state:"latest"}});
const seed=(ledger:Phase5Ledger,version:string,n=252,executions=6,regimes=3)=>{
  const freeze=ledger.freezes.find(x=>x.version===version)!;let equity=1_000_000;
  const names=["Bull","Bear","High Vol","Recovery"];
  for(let i=0;i<n;i++){
    const d=new Date("2026-08-25T00:00:00Z");d.setUTCDate(d.getUTCDate()+i);if([0,6].includes(d.getUTCDay())){i--;continue}
    const date=d.toISOString().slice(0,10),trade=i<executions;
    equity*=1.0002;
    ledger.records.push({key:`${version}|${date}`,marketDataDate:date,recordedAt:`${date}T22:00:00Z`,recordMode:"LIVE",strategyId:freeze.id,ticker:freeze.ticker,strategyName:freeze.name,strategyVersion:version,score:70,components:{trend:70,momentum:70,volatility:70,market:70},regime:names[i%regimes],targetExposure:trade?.75:.75,previousExposure:trade?0:.75,signal:trade?"INCREASE":"HOLD",tradeReason:"test",intendedExecutionDate:date,execution:trade?{signalDate:date,intendedDate:date,recordedDate:date,price:100,before:0,after:.75,turnover:.75,commission:1,slippage:1,totalCost:2,status:"ON_TIME"}:null,assetClose:100,position:.75,quantity:7500,cash:250000,equity,dailyReturn:.0002,currentDrawdown:0,cumulativeCosts:trade?2*(i+1):2*executions,dataSource:"test",dataStatus:"VALID",buildVersion:"test"});
  }
};

test("six-month interim review never promotes",()=>{
  const x=base();for(const f of x.phase5.freezes)seed(x.phase5,f.version,130,6,3);
  const prior=emptyLifecycleLedger(x.phase5.reviewSchedule,"2026-08-25T00:00:00Z");
  const r=updateLifecycleReview({...x,prior,now:"2027-02-25T12:00:00Z"});
  assert.equal(r.current.stage,"INTERIM");assert.equal(r.current.userAction,"NONE");assert.equal(productionEligibleVersions(r).length,0);assert.equal(r.events.length,1);
});

test("formal review exposes eligible candidates but never auto-produces",()=>{
  const x=base();for(const f of x.phase5.freezes)seed(x.phase5,f.version,260,6,3);
  const prior=emptyLifecycleLedger(x.phase5.reviewSchedule,"2026-08-25T00:00:00Z");
  const r=updateLifecycleReview({...x,prior,now:"2027-08-25T12:00:00Z"});
  assert.equal(r.current.systemDecision,"PHASE6_HUMAN_DECISION_REQUIRED");
  assert.equal(r.current.userAction,"RUN_PHASE6_HUMAN_REVIEW");
  assert.equal(productionEligibleVersions(r).length,3);
  assert.equal(x.production.mode,"RESEARCH");
});

test("formal review continues forward when action sample is insufficient",()=>{
  const x=base();for(const f of x.phase5.freezes)seed(x.phase5,f.version,260,2,3);
  const r=updateLifecycleReview({...x,prior:null,now:"2027-08-25T12:00:00Z"});
  assert.equal(r.current.systemDecision,"CONTINUE_FORWARD_INSUFFICIENT_EVIDENCE");assert.equal(r.current.userAction,"NONE");assert.equal(productionEligibleVersions(r).length,0);
});

test("data failure blocks promotion and requests user review",()=>{
  const x=base();for(const f of x.phase5.freezes)seed(x.phase5,f.version,260,6,3);x.phase5Status={status:"failed",errors:["provider"]};
  const r=updateLifecycleReview({...x,prior:null,now:"2027-08-25T12:00:00Z"});
  assert.equal(r.current.userAction,"CHECK_DATA_AND_ACTIONS");assert.equal(productionEligibleVersions(r).length,0);
});

test("review events are append-only and not duplicated after due date",()=>{
  const x=base();for(const f of x.phase5.freezes)seed(x.phase5,f.version,260,6,3);
  const a=updateLifecycleReview({...x,prior:null,now:"2027-08-25T12:00:00Z"});
  const b=updateLifecycleReview({...x,prior:a,now:"2027-08-26T12:00:00Z"});
  assert.equal(a.events.length,b.events.length);assert.deepEqual(a.events,b.events);
});
