import test from "node:test";
import assert from "node:assert/strict";
import {demoDataset} from "../lib/engine.ts";
import {countNyseSessions} from "../lib/market-calendar.ts";
import {emptyForwardLedger,updateForwardLedger} from "../lib/forward.ts";
import {emptyPhase5Ledger,summarizePhase5,updatePhase5Ledger} from "../lib/phase5-forward.ts";

function forwardDataset(extra=0){
  const base=demoDataset(),days=base.days.slice(0,201+extra).map((d,i)=>({...d,date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10)}));
  days[200]={...days[200],date:"2026-08-21"};
  if(extra>=1)days[201]={...days[201],date:"2026-08-24"};
  if(extra>=2)days[202]={...days[202],date:"2026-08-25"};
  return{...base,days};
}

test("incumbent catch-up execution records the actual processed market date",()=>{
  const first=updateForwardLedger(forwardDataset(),emptyForwardLedger("2026-08-21T22:00:00Z"),"test","2026-08-21T22:00:00Z");
  const caught=updateForwardLedger(forwardDataset(2),first,"test","2026-08-25T22:00:00Z");
  const row=caught.records.find(x=>x.strategyId==="TQQQ_BH"&&x.marketDataDate==="2026-08-24")!;
  assert.equal(row.execution?.signalDate,"2026-08-21");
  assert.equal(row.execution?.intendedDate,"2026-08-24");
  assert.equal(row.execution?.recordedDate,"2026-08-24");
  assert.equal(row.execution?.status,"SCHEDULED_CATCHUP");
});

const weekdays=(start:string,end:string)=>{const out:string[]=[],d=new Date(`${start}T12:00:00Z`);while(d.toISOString().slice(0,10)<=end){if(![0,6].includes(d.getUTCDay()))out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out};
const bar=(date:string,close:number)=>({date,open:close*.999,high:close*1.01,low:close*.99,close,adjClose:close,volume:1_000_000});

test("Phase 5 missing ratio counts an omitted common NYSE session and missed-live backfill",()=>{
  const pre=weekdays("2025-05-01","2026-08-24"),post=["2026-08-25","2026-08-26","2026-08-27"],all=[...pre,...post];
  const make=(base:number,dates=all)=>dates.map((d,i)=>bar(d,base+i*.01));
  const payload:any={source:"test",retrievedAt:"2026-08-27T22:00:00Z",series:{
    UPRO:make(40,all.filter(d=>d!=="2026-08-26")),SSO:make(50),QLD:make(60),SPY:make(100),QQQ:make(120),VIX:make(18),
  }};
  const ledger=updatePhase5Ledger(payload,emptyPhase5Ledger("2026-08-25T15:15:00Z"),"2026-08-27T22:00:00Z");
  const upro=summarizePhase5(ledger).find(x=>x.ticker==="UPRO")!;
  assert.equal(countNyseSessions("2026-08-25","2026-08-27"),3);
  assert.equal(upro.liveObservations,1);
  assert.equal(upro.missing,2);
});
