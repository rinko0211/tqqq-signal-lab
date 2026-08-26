import test from "node:test";
import assert from "node:assert/strict";
import { demoDataset } from "../lib/engine.ts";
import { earliestLegalExecutionDate } from "../lib/execution-integrity.ts";
import { updateForwardLedger } from "../lib/forward.ts";
import { emptyPhase5Ledger, updatePhase5Ledger } from "../lib/phase5-forward.ts";

test("earliest legal execution never uses an open that occurred before signal availability",()=>{
  assert.equal(earliestLegalExecutionDate("2026-08-24","2026-08-24T22:00:00Z"),"2026-08-25"); // prior evening ET
  assert.equal(earliestLegalExecutionDate("2026-08-24","2026-08-25T12:00:00Z"),"2026-08-25"); // 08:00 ET, before open
  assert.equal(earliestLegalExecutionDate("2026-08-24","2026-08-25T14:00:00Z"),"2026-08-26"); // 10:00 ET, open passed
  assert.equal(earliestLegalExecutionDate("2026-08-24","2026-08-26T12:00:00Z"),"2026-08-26"); // delayed, but known before open
  assert.equal(earliestLegalExecutionDate("2026-08-24","2026-08-26T22:00:00Z"),"2026-08-27"); // delayed until after close
});

function forwardDataset(extra=0){
  const base=demoDataset(),days=base.days.slice(0,201+extra).map((d,i)=>({...d,date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10)}));
  days[200]={...days[200],date:"2026-08-21"};
  if(extra>=1)days[201]={...days[201],date:"2026-08-24"};
  if(extra>=2)days[202]={...days[202],date:"2026-08-25"};
  return{...base,days};
}

test("Production Forward shifts a late-discovered signal instead of filling the passed open",()=>{
  // 10:00 ET on Aug 24: the Aug 24 open has already passed when the Aug 21 signal is first recorded.
  const first=updateForwardLedger(forwardDataset(),null,"test","2026-08-24T14:00:00Z");
  const signal=first.records.find(x=>x.strategyId==="TQQQ_BH"&&x.marketDataDate==="2026-08-21")!;
  assert.equal(signal.intendedExecutionDate,"2026-08-25");
  const second=updateForwardLedger(forwardDataset(1),first,"test","2026-08-24T22:00:00Z");
  const aug24=second.records.find(x=>x.strategyId==="TQQQ_BH"&&x.marketDataDate==="2026-08-24")!;
  assert.equal(aug24.execution,null);
  assert.equal(aug24.position,0);
});

const weekdaysEnding=(end:string,count:number)=>{
  const out:string[]=[];const d=new Date(`${end}T00:00:00Z`);
  while(out.length<count){const day=d.getUTCDay();if(day!==0&&day!==6)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()-1)}
  return out.reverse();
};
const bars=(dates:string[],base:number,growth:number)=>dates.map((date,i)=>{const close=base*Math.pow(1+growth,i);return{date,open:close*.999,high:close*1.01,low:close*.99,close,adjClose:close,volume:1_000_000}});
const phase5Payload=(end:string)=>{const dates=weekdaysEnding(end,320),v=dates.map(date=>({date,open:18,high:18,low:18,close:18,adjClose:18,volume:0}));return{source:"test",retrievedAt:"test",series:{UPRO:bars(dates,40,.0012),SSO:bars(dates,50,.0008),QLD:bars(dates,60,.0009),SPY:bars(dates,100,.0004),QQQ:bars(dates,120,.0006),VIX:v}} satisfies Parameters<typeof updatePhase5Ledger>[0]};

test("Phase 5 late provider data cannot create a retroactive t+1 fill",()=>{
  // Aug 25 close is first seen Aug 26 18:00 ET, after the Aug 26 open and close.
  const first=updatePhase5Ledger(phase5Payload("2026-08-25"),emptyPhase5Ledger("2026-08-25T15:15:00Z"),"2026-08-26T22:00:00Z");
  assert.equal(first.records.length,3);
  assert.ok(first.records.every(r=>r.intendedExecutionDate==="2026-08-27"));
  const second=updatePhase5Ledger(phase5Payload("2026-08-26"),first,"2026-08-27T22:00:00Z");
  const aug26=second.records.filter(r=>r.marketDataDate==="2026-08-26");
  assert.equal(aug26.length,3);
  assert.ok(aug26.every(r=>r.execution===null&&r.position===0));
});
