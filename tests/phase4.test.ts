import test from "node:test";
import assert from "node:assert/strict";
import { phase4Bundle } from "../lib/phase4.ts";

const bar=(date:string,close:number)=>({date,open:close,high:close,low:close,close,adjClose:close,volume:1});
const dates=Array.from({length:3200},(_,i)=>{const d=new Date(Date.UTC(2016,0,4));d.setUTCDate(d.getUTCDate()+i);return d}).filter(d=>![0,6].includes(d.getUTCDay())).map(d=>d.toISOString().slice(0,10));
const series=(base:number,growth:number)=>dates.map((d,i)=>bar(d,base*Math.pow(1+growth,i)));
const payload={source:"test",crossSeries:{TQQQ:series(10,.00055),QLD:series(20,.00040),QQQ:series(100,.00025),UPRO:series(30,.00048),SSO:series(40,.00035),SPY:series(100,.00020),VIX:dates.map(d=>bar(d,18))}} satisfies Parameters<typeof phase4Bundle>[0];

test("phase4 preserves one allocator across A/B and operational accounting",()=>{
  const b=phase4Bundle(payload);
  assert.equal(b.results.length,2);
  assert.deepEqual(b.results.map(x=>x.variant),["PHASE_4A_COMMON","PHASE_4B_NATIVE_ENHANCED"]);
  for(const r of b.results){
    assert.ok(Number.isFinite(r.oos.cagr),`${r.variant} CAGR must be finite`);
    assert.ok(Number.isFinite(r.oos.calmar),`${r.variant} Calmar must be finite`);
    assert.ok(r.oos.actionDaysPerYear>=0);
    assert.ok(r.oos.brokerOrdersPerYear>=r.oos.actionDaysPerYear);
    assert.ok(r.maxYearActionDays>=0);
  }
  assert.ok(b.comparators.some(x=>x.ticker==="UPRO"&&x.logic==="SP_BROAD_TREND"));
  assert.ok(Number.isFinite(b.attribution.cagrDelta));
});
