import test from "node:test";
import assert from "node:assert/strict";
import {demoDataset} from "../lib/engine.ts";
import {emptyForwardLedger,updateForwardLedger} from "../lib/forward.ts";
import {emptyPhase5Ledger,updatePhase5Ledger} from "../lib/phase5-forward.ts";
import {emptyLifecycleLedger,updateLifecycleReview} from "../lib/lifecycle-review.ts";
import {emptyProductionHealthLedger,updateProductionHealthLedger} from "../lib/production-health-review.ts";
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

test("A7 FC-10: duplicate Lifecycle event keys are rejected at the library boundary",()=>{
  const p5=emptyPhase5Ledger(),forward=emptyForwardLedger(),schedule={interim:p5.reviewSchedule.interim,formal:p5.reviewSchedule.formal,stronger:p5.reviewSchedule.stronger},prior=emptyLifecycleLedger(schedule,"2026-08-27T00:00:00Z");
  const event:any={key:"X",stage:"INTERIM",reviewDate:"2027-02-25",recordedAt:"2027-02-25T21:00:00Z",systemDecision:"X",userAction:"NONE",candidateReviews:[]};prior.events.push(event,structuredClone(event));
  assert.throws(()=>updateLifecycleReview({phase5:p5,forward,production:DEFAULT_PRODUCTION_CONFIG,prior,now:"2026-08-27T21:00:00Z"}),/duplicate|integrity/i);
});

test("A7 FC-10: duplicate Production Health version/dueDate keys are rejected even while Production is inactive",()=>{
  const prior=emptyProductionHealthLedger("2026-08-27T00:00:00Z"),event:any={key:"UPRO-SPBT-v1.0|2027-11-25",dueDate:"2027-11-25",recordedAt:"2027-11-26T21:01:00Z",version:"UPRO-SPBT-v1.0",state:"Healthy",timing:"ON_TIME",reasons:[]};prior.events.push(event,structuredClone(event));
  assert.throws(()=>updateProductionHealthLedger({production:DEFAULT_PRODUCTION_CONFIG,lifecycle:{} as any,prior,now:"2027-11-27T12:00:00Z"}),/duplicate|integrity/i);
});
