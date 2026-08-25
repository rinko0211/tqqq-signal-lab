import test from "node:test";
import assert from "node:assert/strict";
import { emptyPhase5Ledger, PHASE5_FORWARD_START, PHASE5_FREEZES, summarizePhase5, updatePhase5Ledger } from "../lib/phase5-forward.ts";

const weekdays=(start:string,count:number)=>{const out:string[]=[];const d=new Date(`${start}T00:00:00Z`);while(out.length<count){const day=d.getUTCDay();if(day!==0&&day!==6)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out};
const dates=weekdays("2025-01-02",430);
const bar=(date:string,close:number)=>({date,open:close*.999,high:close*1.01,low:close*.99,close,adjClose:close,volume:1_000_000});
const series=(base:number,growth:number)=>dates.map((d,i)=>bar(d,base*Math.pow(1+growth,i)));
const payload:any={source:"test",retrievedAt:"2026-08-26T21:00:00.000Z",series:{UPRO:series(40,.0012),SSO:series(50,.0008),QLD:series(60,.0009),SPY:series(100,.0004),QQQ:series(120,.0006),VIX:dates.map(d=>bar(d,18))}};

test("phase5 freezes exactly three new non-duplicate candidates",()=>{
  assert.deepEqual(PHASE5_FREEZES.map(x=>x.version),["UPRO-SPBT-v1.0","SSO-SPBT-Scaled-v1.0","QLD-VS13-Scaled-v1.0"]);
  assert.ok(PHASE5_FREEZES.every(x=>x.startDate===PHASE5_FORWARD_START));
  assert.equal(PHASE5_FREEZES.find(x=>x.ticker==="UPRO")!.config.trailStop,.13);
  assert.ok(Math.abs(PHASE5_FREEZES.find(x=>x.ticker==="SSO")!.config.trailStop-.13*2/3)<1e-12);
  assert.ok(Math.abs(PHASE5_FREEZES.find(x=>x.ticker==="QLD")!.config.trailStop-.13*2/3)<1e-12);
});

test("phase5 never creates pre-start records and remains append-only",()=>{
  const first=updatePhase5Ledger(payload,emptyPhase5Ledger("2026-08-25T15:15:00.000Z"),"2026-08-26T21:00:00.000Z");
  assert.ok(first.records.length>0);
  assert.ok(first.records.every(r=>r.marketDataDate>=PHASE5_FORWARD_START));
  const keys=new Set(first.records.map(r=>r.key));assert.equal(keys.size,first.records.length);
  const second=updatePhase5Ledger(payload,first,"2026-08-27T21:00:00.000Z");
  assert.deepEqual(second.records.map(r=>r.key),first.records.map(r=>r.key));
  assert.deepEqual(second.records.map(r=>r.equity),first.records.map(r=>r.equity));
});

test("phase5 blocks freeze drift",()=>{
  const ledger=emptyPhase5Ledger();
  ledger.freezes[0].config.trailStop=.12;
  assert.throws(()=>updatePhase5Ledger(payload,ledger,"2026-08-26T21:00:00.000Z"),/freeze drift blocked/);
});

test("phase5 summary starts awaiting first bar",()=>{
  const s=summarizePhase5(emptyPhase5Ledger());
  assert.equal(s.length,3);
  assert.ok(s.every(x=>x.status==="AWAITING_FIRST_BAR"&&x.observations===0));
});
