import test from "node:test";
import assert from "node:assert/strict";
import {demoDataset} from "../lib/engine.ts";
import {assertForwardLedgerInternalIntegrity,emptyForwardLedger,updateForwardLedger} from "../lib/forward.ts";
import {assertPhase5LedgerInternalIntegrity,emptyPhase5Ledger,updatePhase5Ledger} from "../lib/phase5-forward.ts";
import {assertLifecycleLedgerInternalIntegrity,emptyLifecycleLedger,updateLifecycleReview} from "../lib/lifecycle-review.ts";
import {assertProductionHealthLedgerInternalIntegrity,emptyProductionHealthLedger,updateProductionHealthLedger} from "../lib/production-health-review.ts";
import {DEFAULT_PRODUCTION_CONFIG} from "../lib/production.ts";

function forwardDataset(extra=0){
  const base=demoDataset(),days=base.days.slice(0,201+extra).map((d,i)=>({...d,date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10)}));
  days[200]={...days[200],date:"2026-08-21"};
  if(extra>=1)days[201]={...days[201],date:"2026-08-24"};
  return{...base,days};
}
const weekdays=(start:string,count:number)=>{const out:string[]=[];const d=new Date(`${start}T00:00:00Z`);while(out.length<count){const w=d.getUTCDay();if(w!==0&&w!==6)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out};
const dates=weekdays("2025-01-02",430),bar=(date:string,close:number)=>({date,open:close*.999,high:close*1.01,low:close*.99,close,adjClose:close,volume:1_000_000}),series=(base:number,growth:number)=>dates.map((d,i)=>bar(d,base*Math.pow(1+growth,i)));
const phase5Payload={source:"test",retrievedAt:"2026-08-26T21:00:00.000Z",series:{UPRO:series(40,.0012),SSO:series(50,.0008),QLD:series(60,.0009),SPY:series(100,.0004),QQQ:series(120,.0006),VIX:dates.map(d=>bar(d,18))}};

test("A7 FC-10/09: missing immutable Forward anchor fails closed instead of restarting at dataset index zero",()=>{
  const first=updateForwardLedger(forwardDataset(),null,"test","2026-08-24T00:00:00Z");
  const truncated=forwardDataset(1);truncated.days=truncated.days.filter(d=>d.date!=="2026-08-21");
  assert.throws(()=>updateForwardLedger(truncated,first,"test","2026-08-25T00:00:00Z"),/anchor|prior|pre-start/i);
});

test("A7 FC-10: duplicate Forward logical keys are rejected before update",()=>{
  const first=updateForwardLedger(forwardDataset(),null,"test","2026-08-24T00:00:00Z"),bad=structuredClone(first);bad.records.push(structuredClone(bad.records[0]));
  assert.throws(()=>updateForwardLedger(forwardDataset(),bad,"test","2026-08-24T01:00:00Z"),/duplicate|integrity/i);
});

test("A7 FC-10: duplicate Phase 5 logical keys are rejected before update",()=>{
  const first=updatePhase5Ledger(phase5Payload as any,emptyPhase5Ledger("2026-08-25T00:00:00Z"),"2026-08-26T21:00:00Z"),bad=structuredClone(first);bad.records.push(structuredClone(bad.records[0]));
  assert.throws(()=>updatePhase5Ledger(phase5Payload as any,bad,"2026-08-27T21:00:00Z"),/duplicate|integrity/i);
});

test("A7 FC-10: out-of-order Forward prior is rejected rather than silently re-sorted",()=>{
  const first=updateForwardLedger(forwardDataset(1),null,"test","2026-08-24T21:00:00Z"),bad=structuredClone(first);
  assert.ok(bad.records.length>2);[bad.records[0],bad.records[1]]=[bad.records[1],bad.records[0]];
  assert.throws(()=>assertForwardLedgerInternalIntegrity(bad),/order|chronology|integrity/i);
});

test("A7 FC-10: out-of-order Phase 5 prior is rejected rather than silently re-sorted",()=>{
  const first=updatePhase5Ledger(phase5Payload as any,emptyPhase5Ledger("2026-08-25T00:00:00Z"),"2026-08-26T21:00:00Z"),bad=structuredClone(first);
  assert.ok(bad.records.length>2);[bad.records[0],bad.records[1]]=[bad.records[1],bad.records[0]];
  assert.throws(()=>assertPhase5LedgerInternalIntegrity(bad),/order|chronology|integrity/i);
});

test("A7 FC-10/01: impossible Forward and Phase 5 record dates fail at the ledger boundary",()=>{
  const f=updateForwardLedger(forwardDataset(),null,"test","2026-08-24T00:00:00Z"),fb=structuredClone(f);fb.records[0].marketDataDate="2026-09-31";fb.records[0].key=`${fb.records[0].strategyVersion}|2026-09-31`;
  assert.throws(()=>assertForwardLedgerInternalIntegrity(fb),/date|chronology|integrity/i);
  const p=updatePhase5Ledger(phase5Payload as any,emptyPhase5Ledger(),"2026-08-26T21:00:00Z"),pb=structuredClone(p);pb.records[0].marketDataDate="2026-09-31";pb.records[0].key=`${pb.records[0].strategyVersion}|2026-09-31`;
  assert.throws(()=>assertPhase5LedgerInternalIntegrity(pb),/date|chronology|integrity/i);
});

test("A7 FC-10: duplicate Lifecycle event keys are rejected at the library boundary",()=>{
  const p5=emptyPhase5Ledger(),forward=emptyForwardLedger(),schedule={interim:p5.reviewSchedule.interim,formal:p5.reviewSchedule.formal,stronger:p5.reviewSchedule.stronger},prior=emptyLifecycleLedger(schedule,"2026-08-27T00:00:00Z");
  const event:any={key:"X",stage:"INTERIM",reviewDate:"2027-02-25",recordedAt:"2027-02-25T21:00:00Z",systemDecision:"X",userAction:"NONE",candidateReviews:[]};prior.events.push(event,structuredClone(event));
  assert.throws(()=>updateLifecycleReview({phase5:p5,forward,production:DEFAULT_PRODUCTION_CONFIG,prior,now:"2026-08-27T21:00:00Z"}),/duplicate|integrity/i);
});

test("A7 FC-10/01: Lifecycle rejects out-of-order and impossible review chronology",()=>{
  const p5=emptyPhase5Ledger(),schedule={interim:p5.reviewSchedule.interim,formal:p5.reviewSchedule.formal,stronger:p5.reviewSchedule.stronger},prior=emptyLifecycleLedger(schedule,"2026-08-27T00:00:00Z");
  prior.events.push(
    {key:"FORMAL|2027-08-25",stage:"FORMAL",reviewDate:"2027-08-25",recordedAt:"2027-08-25T21:00:00Z",systemDecision:"X",userAction:"NONE",candidateReviews:[]},
    {key:"INTERIM|2027-02-25",stage:"INTERIM",reviewDate:"2027-02-25",recordedAt:"2027-02-25T21:00:00Z",systemDecision:"X",userAction:"NONE",candidateReviews:[]},
  );
  assert.throws(()=>assertLifecycleLedgerInternalIntegrity(prior),/order|chronology|integrity/i);
  const impossible=emptyLifecycleLedger(schedule);impossible.events.push({key:"X",stage:"FORMAL",reviewDate:"2027-02-31",recordedAt:"2027-03-01T21:00:00Z",systemDecision:"X",userAction:"NONE",candidateReviews:[]});
  assert.throws(()=>assertLifecycleLedgerInternalIntegrity(impossible),/date|chronology|integrity/i);
});

test("A7 FC-10: duplicate Production Health version/dueDate keys are rejected even while Production is inactive",()=>{
  const prior=emptyProductionHealthLedger("2026-08-27T00:00:00Z"),event:any={key:"UPRO-SPBT-v1.0|2027-11-25",dueDate:"2027-11-25",recordedAt:"2027-11-26T21:01:00Z",version:"UPRO-SPBT-v1.0",state:"Healthy",timing:"ON_TIME",reasons:[]};prior.events.push(event,structuredClone(event));
  assert.throws(()=>updateProductionHealthLedger({production:DEFAULT_PRODUCTION_CONFIG,lifecycle:{} as any,prior,now:"2027-11-27T12:00:00Z"}),/duplicate|integrity/i);
});

test("A7 FC-10/01: Production Health rejects out-of-order and impossible due-date chronology",()=>{
  const prior=emptyProductionHealthLedger();prior.events.push(
    {key:"UPRO-SPBT-v1.0|2028-02-25",dueDate:"2028-02-25",recordedAt:"2028-02-25T21:00:00Z",version:"UPRO-SPBT-v1.0",state:"Healthy",timing:"ON_TIME",reasons:[]},
    {key:"UPRO-SPBT-v1.0|2027-11-25",dueDate:"2027-11-25",recordedAt:"2027-11-26T21:00:00Z",version:"UPRO-SPBT-v1.0",state:"Healthy",timing:"ON_TIME",reasons:[]},
  );
  assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(prior),/order|chronology|integrity/i);
  const impossible=emptyProductionHealthLedger();impossible.events.push({key:"UPRO-SPBT-v1.0|2027-02-31",dueDate:"2027-02-31",recordedAt:"2027-03-01T21:00:00Z",version:"UPRO-SPBT-v1.0",state:"Healthy",timing:"ON_TIME",reasons:[]});
  assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(impossible),/date|chronology|integrity/i);
});
